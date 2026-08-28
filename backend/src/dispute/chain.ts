import {
  RpcProvider,
  num,
  shortString,
} from "starknet";

import type {
  AppConfig,
} from "../config.js";
import type {
  DisputeCase,
  DisputeVerificationClass,
} from "./types.js";

export interface VerifiedRekberCustody {
  custodyCommitment: string;
  releaseAuthorizationCommitment: string;
  payeeClaimCommitment: string;
  refundCommitment: string;
  payerConfirmationCommitment: string;
  payerDisputeCommitment: string;
  payeeDisputeCommitment: string;
  payeeRefundConsentCommitment: string;
  fulfillmentChainHead: string;
  revisionChainHead: string;
  payerCertificateCommitment: string;
  payeeCertificateCommitment: string;
  token: string;
  amount: string;
  fulfillmentDeadline: string;
  verificationPolicy: number;
  fulfillmentEvidenceCommitment: string;
  fulfillmentSubmitted: boolean;
  fulfillmentConfirmed: boolean;
  disputed: boolean;
  resolutionAuthorized: boolean;
  consumed: boolean;
}

function boolAt(
  result: readonly string[],
  index: number,
): boolean {
  return BigInt(
    result[index] ?? "0",
  ) !== 0n;
}

function feltAt(
  result: readonly string[],
  index: number,
): string {
  return num.toHex(
    result[index] ?? "0",
  );
}

export function parseRekberCustodyResult(
  result: readonly string[],
): VerifiedRekberCustody {
  if (result.length < 39) {
    throw new Error(
      "Rekber get_custody returned an incomplete record.",
    );
  }

  return {
    custodyCommitment:
      feltAt(result, 0),
    releaseAuthorizationCommitment:
      feltAt(result, 1),
    payeeClaimCommitment:
      feltAt(result, 2),
    refundCommitment:
      feltAt(result, 3),
    payerConfirmationCommitment:
      feltAt(result, 4),
    payerDisputeCommitment:
      feltAt(result, 5),
    payeeDisputeCommitment:
      feltAt(result, 6),
    payeeRefundConsentCommitment:
      feltAt(result, 7),
    fulfillmentChainHead:
      feltAt(result, 8),
    revisionChainHead:
      feltAt(result, 9),
    payerCertificateCommitment:
      feltAt(result, 10),
    payeeCertificateCommitment:
      feltAt(result, 11),
    token:
      feltAt(result, 12),
    amount:
      BigInt(
        result[13] ?? "0",
      ).toString(),
    fulfillmentDeadline:
      BigInt(
        result[15] ?? "0",
      ).toString(),
    verificationPolicy:
      Number(
        BigInt(
          result[19] ?? "0",
        ),
      ),
    fulfillmentEvidenceCommitment:
      feltAt(result, 22),
    fulfillmentSubmitted:
      boolAt(result, 27),
    fulfillmentConfirmed:
      boolAt(result, 28),
    disputed:
      boolAt(result, 30),
    resolutionAuthorized:
      boolAt(result, 31),
    consumed:
      boolAt(result, 34),
  };
}

function expectedVerificationClass(
  policy: number,
): DisputeVerificationClass {
  switch (policy) {
    case 1:
      return "digital_review";
    case 2:
      return "offchain";
    case 3:
      return "objective";
    default:
      throw new Error(
        "Rekber custody has an unsupported verification policy.",
      );
  }
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

/**
 * Never trust lifecycle flags supplied by the browser for arbitration.
 * This comparison binds the disclosed case to the current public Rekber state.
 */
export function assertDisputeCaseMatchesCustody(
  disputeCase: DisputeCase,
  custody: VerifiedRekberCustody,
): void {
  if (
    !sameFelt(
      disputeCase.custodyCommitment,
      custody.custodyCommitment,
    )
  ) {
    throw new Error(
      "Dispute custody commitment does not match Rekber.",
    );
  }

  if (
    BigInt(
      disputeCase.principal.rawAmount,
    ) !==
    BigInt(custody.amount)
  ) {
    throw new Error(
      "Dispute principal does not match Rekber custody.",
    );
  }

  if (
    !sameFelt(
      disputeCase.fulfillment
        .evidenceCommitment,
      custody
        .fulfillmentEvidenceCommitment,
    )
  ) {
    throw new Error(
      "Fulfillment evidence commitment does not match Rekber.",
    );
  }

  if (
    disputeCase.verificationClass !==
    expectedVerificationClass(
      custody.verificationPolicy,
    )
  ) {
    throw new Error(
      "Dispute verification class does not match Rekber policy.",
    );
  }

  const supplied =
    disputeCase.onChain;

  for (
    const [label, left, right] of
    [
      [
        "disputed",
        supplied.disputed,
        custody.disputed,
      ],
      [
        "consumed",
        supplied.consumed,
        custody.consumed,
      ],
      [
        "resolutionAuthorized",
        supplied.resolutionAuthorized,
        custody.resolutionAuthorized,
      ],
      [
        "fulfillmentSubmitted",
        supplied.fulfillmentSubmitted,
        custody.fulfillmentSubmitted,
      ],
      [
        "fulfillmentConfirmed",
        supplied.fulfillmentConfirmed,
        custody.fulfillmentConfirmed,
      ],
      [
        "fulfillment.submitted",
        disputeCase.fulfillment
          .submitted,
        custody.fulfillmentSubmitted,
      ],
      [
        "fulfillment.confirmed",
        disputeCase.fulfillment
          .confirmed,
        custody.fulfillmentConfirmed,
      ],
    ] as const
  ) {
    if (left !== right) {
      throw new Error(
        `Client ${label} does not match current Rekber state.`,
      );
    }
  }

  if (!custody.disputed) {
    throw new Error(
      "Rekber custody is not currently disputed.",
    );
  }

  if (custody.consumed) {
    throw new Error(
      "Rekber custody is already consumed.",
    );
  }

  if (
    custody.resolutionAuthorized
  ) {
    throw new Error(
      "Rekber resolution is already authorized.",
    );
  }
}

/**
 * Browser USD values are not trusted for automated arbitration.
 *
 * Canonical USDC raw units already equal USD micros (6 decimals). STRK uses
 * the live Pragma median and Rekber's own freshness/source thresholds.
 */
export async function readVerifiedPrincipalUsdMicros(
  config: AppConfig,
  custody: VerifiedRekberCustody,
): Promise<number | undefined> {
  const provider =
    new RpcProvider({
      nodeUrl:
        config.rpcUrl,
    });

  try {
    const tokens =
      await provider.callContract({
        contractAddress:
          config.contracts.escrowRekber,
        entrypoint:
          "get_supported_tokens",
        calldata: [],
      });

    const strk =
      feltAt(tokens, 0);
    const usdc =
      feltAt(tokens, 1);

    if (
      sameFelt(
        custody.token,
        usdc,
      )
    ) {
      const micros =
        BigInt(
          custody.amount,
        );

      return micros <=
        BigInt(
          Number.MAX_SAFE_INTEGER,
        )
        ? Number(micros)
        : undefined;
    }

    if (
      !sameFelt(
        custody.token,
        strk,
      )
    ) {
      return undefined;
    }

    const [
      oracleResult,
      feePolicy,
    ] = await Promise.all([
      provider.callContract({
        contractAddress:
          config.contracts.escrowRekber,
        entrypoint:
          "get_pragma_oracle",
        calldata: [],
      }),
      provider.callContract({
        contractAddress:
          config.contracts.escrowRekber,
        entrypoint:
          "get_fee_policy",
        calldata: [],
      }),
    ]);

    const oracle =
      feltAt(
        oracleResult,
        0,
      );

    const quote =
      await provider.callContract({
        contractAddress:
          oracle,
        entrypoint:
          "get_data_median",
        // Pragma DataType::SpotEntry("STRK/USD").
        calldata: [
          "0x0",
          shortString
            .encodeShortString(
              "STRK/USD",
            ),
        ],
      });

    const price =
      BigInt(
        quote[0] ?? "0",
      );
    const decimals =
      BigInt(
        quote[1] ?? "0",
      );
    const updatedAt =
      Number(
        BigInt(
          quote[2] ?? "0",
        ),
      );
    const sources =
      Number(
        BigInt(
          quote[3] ?? "0",
        ),
      );

    const maxAge =
      Number(
        BigInt(
          feePolicy[1] ?? "0",
        ),
      );
    const minSources =
      Number(
        BigInt(
          feePolicy[2] ?? "0",
        ),
      );

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    if (
      price <= 0n ||
      decimals > 30n ||
      updatedAt <= 0 ||
      updatedAt > now ||
      now - updatedAt >
        maxAge ||
      sources < minSources
    ) {
      return undefined;
    }

    const numerator =
      BigInt(custody.amount) *
      price *
      1_000_000n;

    const denominator =
      (10n ** 18n) *
      (10n ** decimals);

    const micros =
      (
        numerator +
        denominator -
        1n
      ) /
      denominator;

    if (
      micros <= 0n ||
      micros >
        BigInt(
          Number.MAX_SAFE_INTEGER,
        )
    ) {
      return undefined;
    }

    return Number(micros);
  } catch {
    // Fail closed. Missing/stale oracle data prevents AUTO_RESOLVE.
    return undefined;
  }
}

export async function readAndVerifyDisputeCustody(
  config: AppConfig,
  disputeCase: DisputeCase,
): Promise<VerifiedRekberCustody> {
  const provider =
    new RpcProvider({
      nodeUrl:
        config.rpcUrl,
    });

  const result =
    await provider.callContract({
      contractAddress:
        config.contracts
          .escrowRekber,
      entrypoint:
        "get_custody",
      calldata: [
        num.toHex(
          disputeCase
            .custodyCommitment,
        ),
      ],
    });

  const custody =
    parseRekberCustodyResult(
      result,
    );

  assertDisputeCaseMatchesCustody(
    disputeCase,
    custody,
  );

  return custody;
}
