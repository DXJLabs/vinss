import {
  Account,
  RpcProvider,
  num,
} from "starknet";
import {
  createHash,
} from "node:crypto";

import type {
  AppConfig,
} from "../config.js";
import type {
  VerifiedRekberCustody,
} from "./chain.js";
import type {
  DisputeAgentDecision,
} from "./types.js";

const FELT_PRIME =
  2n ** 251n +
  17n * 2n ** 192n +
  1n;

export interface DisputeExecutionResult {
  status:
    | "authorized"
    | "already_authorized"
    | "not_enabled"
    | "not_eligible";
  transactionHash?: string;
  payerAmount?: string;
  payeeAmount?: string;
}

export function computeResolutionAmounts(
  principal: bigint,
  payerBps: number,
  payeeBps: number,
): {
  payerAmount: bigint;
  payeeAmount: bigint;
} {
  if (
    principal <= 0n ||
    payerBps < 0 ||
    payeeBps < 0 ||
    payerBps +
      payeeBps !==
      10_000
  ) {
    throw new Error(
      "Invalid dispute resolution split.",
    );
  }

  const payerAmount =
    (
      principal *
      BigInt(payerBps)
    ) /
    10_000n;

  return {
    payerAmount,

    // Exact remainder prevents rounding from losing a principal unit.
    payeeAmount:
      principal -
      payerAmount,
  };
}

function computeResolutionCommitment(
  caseCommitment: string,
  decision: DisputeAgentDecision,
): string {
  const digest =
    BigInt(
      "0x" +
        createHash(
          "sha256",
        )
          .update(
            [
              caseCommitment,
              decision.decision,
              decision.payerBps,
              decision.payeeBps,
              decision.evidenceCommitment,
            ].join(":"),
          )
          .digest("hex"),
    ) %
    FELT_PRIME;

  return digest === 0n
    ? "0x1"
    : `0x${digest.toString(16)}`;
}

function sameFelt(
  left: string,
  right: string,
): boolean {
  try {
    return (
      BigInt(left) ===
      BigInt(right)
    );
  } catch {
    return false;
  }
}

async function readAuthorizedSplit(
  provider: RpcProvider,
  config: AppConfig,
  custodyCommitment: string,
) {
  const result =
    await provider.callContract({
      contractAddress:
        config.contracts
          .escrowRekber,
      entrypoint:
        "get_custody",
      calldata: [
        num.toHex(
          custodyCommitment,
        ),
      ],
    });

  return {
    authorized:
      BigInt(
        result[31] ?? "0",
      ) !== 0n,
    payerAmount:
      BigInt(
        result[25] ?? "0",
      ),
    payeeAmount:
      BigInt(
        result[26] ?? "0",
      ),
  };
}

/*
 * The LLM has no signer. Only this policy-gated executor can use the dedicated
 * resolver account, and its only financial operation is authorizing an exact
 * Payer/Payee split already bounded by the Rekber contract.
 */
export async function authorizeDisputeResolution(
  config: AppConfig,
  custody: VerifiedRekberCustody,
  caseCommitment: string,
  decision: DisputeAgentDecision,
): Promise<DisputeExecutionResult> {
  if (
    !config.dispute
      ?.autoResolveEnabled
  ) {
    return {
      status: "not_enabled",
    };
  }

  const {
    resolverAddress,
    resolverPrivateKey,
  } = config.dispute;

  if (
    !resolverAddress ||
    !resolverPrivateKey
  ) {
    throw new Error(
      "Dispute resolver signer is not configured.",
    );
  }

  const provider =
    new RpcProvider({
      nodeUrl:
        config.rpcUrl,
    });

  const expectedResolver =
    await provider.callContract({
      contractAddress:
        config.contracts
          .escrowRekber,
      entrypoint:
        "get_dispute_resolver",
      calldata: [],
    });

  if (
    !sameFelt(
      expectedResolver[0] ?? "0",
      resolverAddress,
    )
  ) {
    throw new Error(
      "Backend resolver does not match the immutable Rekber resolver.",
    );
  }

  const existing =
    await readAuthorizedSplit(
      provider,
      config,
      custody.custodyCommitment,
    );

  if (existing.authorized) {
    return {
      status:
        "already_authorized",
      payerAmount:
        existing.payerAmount
          .toString(),
      payeeAmount:
        existing.payeeAmount
          .toString(),
    };
  }

  const {
    payerAmount,
    payeeAmount,
  } =
    computeResolutionAmounts(
      BigInt(
        custody.amount,
      ),
      decision.payerBps,
      decision.payeeBps,
    );

  const resolver =
    new Account({
      provider,
      address:
        resolverAddress,
      signer:
        resolverPrivateKey,
    });

  try {
    const response =
      await resolver.execute({
        contractAddress:
          config.contracts
            .escrowRekber,
        entrypoint:
          "authorize_dispute_resolution",
        calldata: [
          num.toHex(
            custody
              .custodyCommitment,
          ),
          computeResolutionCommitment(
            caseCommitment,
            decision,
          ),
          payerAmount
            .toString(),
          payeeAmount
            .toString(),
        ],
      });

    await provider
      .waitForTransaction(
        response
          .transaction_hash,
      );

    return {
      status:
        "authorized",
      transactionHash:
        response
          .transaction_hash,
      payerAmount:
        payerAmount.toString(),
      payeeAmount:
        payeeAmount.toString(),
    };
  } catch (error) {
    /*
     * A refresh/retry can race an already-submitted resolver transaction.
     * Rekber state is the authority: if the split is now authorized, succeed.
     */
    const after =
      await readAuthorizedSplit(
        provider,
        config,
        custody.custodyCommitment,
      );

    if (after.authorized) {
      return {
        status:
          "already_authorized",
        payerAmount:
          after.payerAmount
            .toString(),
        payeeAmount:
          after.payeeAmount
            .toString(),
      };
    }

    throw error;
  }
}
