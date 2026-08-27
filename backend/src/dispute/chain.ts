import {
  RpcProvider,
  num,
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
  token: string;
  amount: string;
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
    token:
      feltAt(result, 12),
    amount:
      BigInt(
        result[13] ?? "0",
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
