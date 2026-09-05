import {
  Account,
  RpcProvider,
  num,
} from "starknet";
import {
  createHash,
} from "node:crypto";

import {
  loadConfig,
} from "../config.js";
import {
  createDatabase,
} from "../database.js";
import {
  parseRekberCustodyResult,
} from "../dispute/chain.js";
import {
  parseDisputeAgentDecision,
} from "../dispute/decision.js";

const FELT_PRIME =
  2n ** 251n +
  17n * 2n ** 192n +
  1n;

function sameFelt(
  left: string,
  right: string,
): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

function requireFelt(
  value: string | undefined,
  label: string,
): string {
  if (
    !value ||
    !/^0x[0-9a-fA-F]+$/.test(value)
  ) {
    throw new Error(
      `${label} must be a 0x-prefixed felt.`,
    );
  }

  return num.toHex(value);
}

function resolutionCommitment(
  custodyCommitment: string,
  caseCommitment: string,
  payerBps: number,
  payeeBps: number,
): string {
  const digest =
    BigInt(
      "0x" +
        createHash("sha256")
          .update(
            [
              "VINSS_MANUAL_REVIEW_V1",
              custodyCommitment,
              caseCommitment,
              payerBps,
              payeeBps,
            ].join(":"),
          )
          .digest("hex"),
    ) % FELT_PRIME;

  return num.toHex(
    digest === 0n ? 1n : digest,
  );
}

async function main() {
  const [
    custodyRaw,
    caseRaw,
    payerBpsRaw,
    payeeBpsRaw,
    acknowledgement,
  ] = process.argv.slice(2);

  if (
    acknowledgement !==
    "MANUAL_REVIEW_APPROVED"
  ) {
    throw new Error(
      "Explicit MANUAL_REVIEW_APPROVED acknowledgement is required.",
    );
  }

  const custodyCommitment =
    requireFelt(
      custodyRaw,
      "Custody commitment",
    );

  const caseCommitment =
    requireFelt(
      caseRaw,
      "Case commitment",
    );

  const payerBps =
    Number(payerBpsRaw);
  const payeeBps =
    Number(payeeBpsRaw);

  if (
    !Number.isInteger(payerBps) ||
    !Number.isInteger(payeeBps) ||
    payerBps < 0 ||
    payeeBps < 0 ||
    payerBps + payeeBps !== 10_000
  ) {
    throw new Error(
      "Manual split must total exactly 10000 bps.",
    );
  }

  const config =
    loadConfig();

  if (
    config.network !== "mainnet"
  ) {
    throw new Error(
      "This operator command is restricted to the current VINSS mainnet review workflow.",
    );
  }

  const manualResolverAddress =
    process.env.MANUAL_DISPUTE_RESOLVER_ADDRESS
      ?.trim();

  if (!manualResolverAddress) {
    throw new Error(
      "MANUAL_DISPUTE_RESOLVER_ADDRESS is required for manual review.",
    );
  }

  const database =
    createDatabase(config);

  try {
    /*
     * Manual resolution is allowed only for a case that was already
     * evaluated and persisted by the Dispute Agent pipeline.
     */
    const evaluation =
      await database.query<{
        state: string;
        decision: unknown;
      }>(
        `
          SELECT
            state,
            decision
          FROM vinss_dispute_evaluations
          WHERE
            network = $1 AND
            case_commitment = $2
          LIMIT 1
        `,
        [
          config.network,
          caseCommitment,
        ],
      );

    const row =
      evaluation.rows[0];

    if (
      !row ||
      row.state !== "complete" ||
      !row.decision
    ) {
      throw new Error(
        "No completed persisted dispute evaluation exists for this case.",
      );
    }

    const agentDecision =
      parseDisputeAgentDecision(
        JSON.stringify(
          row.decision,
        ),
      );

    console.log(
      "Stored Agent decision:",
      agentDecision.decision,
      `${agentDecision.payerBps}/${agentDecision.payeeBps} bps`,
    );

    /*
     * A completed Case alone is not enough. Require a case/custody
     * association that was previously verified by the live dispute endpoint.
     * This prevents an operator typo from combining Case A with Custody B.
     */
    const verifiedBinding =
      await database.query<{
        custody_commitment: string;
      }>(
        `
          SELECT DISTINCT
            custody_commitment
          FROM vinss_dispute_attestations
          WHERE
            network = $1 AND
            case_commitment = $2 AND
            custody_commitment IS NOT NULL
        `,
        [
          config.network,
          caseCommitment,
        ],
      );

    if (
      verifiedBinding.rows.length !== 1 ||
      !sameFelt(
        verifiedBinding.rows[0]
          ?.custody_commitment ?? "0",
        custodyCommitment,
      )
    ) {
      throw new Error(
        "Verified dispute Case/Custody binding is missing or does not match.",
      );
    }

    console.log(
      "Verified Case/Custody binding:",
      custodyCommitment,
    );

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
        manualResolverAddress,
      )
    ) {
      throw new Error(
        "Manual resolver does not match Rekber's immutable resolver.",
      );
    }

    const rawCustody =
      await provider.callContract({
        contractAddress:
          config.contracts
            .escrowRekber,
        entrypoint:
          "get_custody",
        calldata: [
          custodyCommitment,
        ],
      });

    const custody =
      parseRekberCustodyResult(
        rawCustody,
      );

    if (
      !sameFelt(
        custody.custodyCommitment,
        custodyCommitment,
      )
    ) {
      throw new Error(
        "Loaded custody does not match the requested commitment.",
      );
    }

    if (!custody.disputed) {
      throw new Error(
        "Custody is not disputed.",
      );
    }

    if (custody.consumed) {
      throw new Error(
        "Custody is already consumed.",
      );
    }

    if (
      custody.resolutionAuthorized
    ) {
      throw new Error(
        "A dispute resolution is already authorized.",
      );
    }

    const principal =
      BigInt(custody.amount);

    if (principal <= 0n) {
      throw new Error(
        "Invalid custody principal.",
      );
    }

    const payerAmount =
      (
        principal *
        BigInt(payerBps)
      ) / 10_000n;

    const payeeAmount =
      principal -
      payerAmount;

    const commitment =
      resolutionCommitment(
        custodyCommitment,
        caseCommitment,
        payerBps,
        payeeBps,
      );

    console.log(
      "Manual review split:",
      `${payerBps / 100}% payer / ${payeeBps / 100}% payee`,
    );

    console.log(
      "Principal raw split:",
      payerAmount.toString(),
      "/",
      payeeAmount.toString(),
    );

    if (
      process.argv.includes(
        "--dry-run",
      )
    ) {
      console.log(
        "DRY RUN PASS: no resolver transaction submitted.",
      );
      return;
    }

    const manualResolverPrivateKey =
      process.env.MANUAL_DISPUTE_RESOLVER_PRIVATE_KEY
        ?.trim();

    if (!manualResolverPrivateKey) {
      throw new Error(
        "MANUAL_DISPUTE_RESOLVER_PRIVATE_KEY is required only for final execution.",
      );
    }

    const resolver =
      new Account({
        provider,
        address:
          manualResolverAddress,
        signer:
          manualResolverPrivateKey,
      });

    const response =
      await resolver.execute({
        contractAddress:
          config.contracts
            .escrowRekber,
        entrypoint:
          "authorize_dispute_resolution",
        calldata: [
          custodyCommitment,
          commitment,
          payerAmount.toString(),
          payeeAmount.toString(),
        ],
      });

    console.log(
      "Resolver tx submitted:",
      response.transaction_hash,
    );

    await provider.waitForTransaction(
      response.transaction_hash,
    );

    console.log(
      "Manual dispute resolution authorized.",
    );
    console.log(
      "Transaction:",
      response.transaction_hash,
    );
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exitCode = 1;
});
