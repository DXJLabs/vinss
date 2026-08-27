import type {
  DealType,
  OfferSettlementPlan,
  RekberVerificationPolicy,
} from "@/types/deal-room";
import {
  canonicalStarknetAddress,
} from "@/lib/privacy/participantKeys";

export const REKBER_PLAN_VERSION = 1 as const;

export const REKBER_MAX_FULFILLMENT_ROUNDS = 8;
export const REKBER_MAX_REVISION_ROUNDS = 7;

export function verificationPolicyCode(
  policy: RekberVerificationPolicy,
): number {
  switch (policy) {
    case "submission_review":
      return 1;
    case "counterparty_confirm":
      return 2;
    case "external_verify":
      return 3;
    default:
      throw new Error(
        `Unsupported Rekber verification policy: ${String(policy)}`,
      );
  }
}

export function verificationPolicyFromCode(
  code: number,
): RekberVerificationPolicy | null {
  if (code === 1) return "submission_review";
  if (code === 2) return "counterparty_confirm";
  if (code === 3) return "external_verify";
  return null;
}

/**
 * Policy defaults are deliberately conservative.
 *
 * `external_verify` is supported by Rekber but no current Offer template
 * selects it automatically. NFT can move to that policy only after an audited
 * verifier adapter is actually deployed/configured.
 */
export function defaultVerificationPolicy(
  dealType?: DealType,
): RekberVerificationPolicy {
  switch (dealType) {
    case "goods":
    case "otc":
      return "counterparty_confirm";

    case "freelance":
    case "digital_goods":
    case "bounty":
    case "nft":
    case "other":
    default:
      return "submission_review";
  }
}

export function defaultReviewWindowHours(
  dealType?: DealType,
): number {
  switch (dealType) {
    case "goods":
      return 24;
    case "digital_goods":
      return 24;
    case "nft":
      return 12;
    case "otc":
      return 1;
    case "freelance":
    case "bounty":
    case "other":
    default:
      return 72;
  }
}

export function defaultFulfillmentType(
  dealType?: DealType,
): DealType {
  return dealType ?? "other";
}

/**
 * VINSS currently settles one principal between two wallets.
 *
 * Therefore:
 * - payerAddress = wallet that locks the settlement asset;
 * - payeeAddress = wallet that receives that asset on successful settlement;
 * - fulfillerAddress = payeeAddress;
 * - beneficiaryAddress = payeeAddress.
 *
 * The explicit fields make the business model readable and future-proof while
 * preserving the current two-party custody invariant.
 */
export function buildOfferSettlementPlan(input: {
  dealType?: DealType;
  payerAddress: string;
  payeeAddress: string;
  reviewWindowHours?: number;
  maxFulfillmentRounds?: number;
  maxRevisionRounds?: number;
}): OfferSettlementPlan {
  const payerAddress =
    canonicalStarknetAddress(
      input.payerAddress,
    );
  const payeeAddress =
    canonicalStarknetAddress(
      input.payeeAddress,
    );

  if (
    !payerAddress ||
    !payeeAddress ||
    payerAddress === payeeAddress
  ) {
    throw new Error(
      "Rekber requires two different wallet roles.",
    );
  }

  const policy =
    defaultVerificationPolicy(
      input.dealType,
    );

  const reviewWindowHours =
    input.reviewWindowHours ??
    defaultReviewWindowHours(
      input.dealType,
    );

  if (
    !Number.isFinite(
      reviewWindowHours,
    ) ||
    reviewWindowHours <
      1 / 60 ||
    reviewWindowHours >
      24 * 30
  ) {
    throw new Error(
      "Rekber review window must be between 1 minute and 30 days.",
    );
  }

  const requestedFulfillmentRounds =
    Math.trunc(
      input.maxFulfillmentRounds ??
        (policy ===
        "submission_review"
          ? 2
          : 1),
    );

  const maxFulfillmentRounds =
    Math.max(
      1,
      Math.min(
        REKBER_MAX_FULFILLMENT_ROUNDS,
        requestedFulfillmentRounds,
      ),
    );

  // Physical/off-chain confirmation policies do not use "revision" as a
  // substitute for a delivery/payment dispute. They get zero revision rounds.
  const requestedRevisionRounds =
    policy ===
    "submission_review"
      ? Math.trunc(
          input.maxRevisionRounds ??
            Math.min(
              1,
              maxFulfillmentRounds -
                1,
            ),
        )
      : 0;

  const maxRevisionRounds =
    Math.max(
      0,
      Math.min(
        REKBER_MAX_REVISION_ROUNDS,
        maxFulfillmentRounds -
          1,
        requestedRevisionRounds,
      ),
    );

  return {
    version:
      REKBER_PLAN_VERSION,
    payerAddress,
    payeeAddress,
    fulfillerAddress:
      payeeAddress,
    beneficiaryAddress:
      payeeAddress,
    fulfillmentType:
      defaultFulfillmentType(
        input.dealType,
      ),
    verificationPolicy:
      policy,
    reviewWindowSeconds:
      Math.max(
        60,
        Math.round(
          reviewWindowHours *
            3600,
        ),
      ),
    maxFulfillmentRounds,
    maxRevisionRounds,
  };
}

export function isValidOfferSettlementPlan(
  plan:
    | OfferSettlementPlan
    | undefined,
): plan is OfferSettlementPlan {
  if (
    !plan ||
    plan.version !==
      REKBER_PLAN_VERSION
  ) {
    return false;
  }

  try {
    const payer =
      canonicalStarknetAddress(
        plan.payerAddress,
      );
    const payee =
      canonicalStarknetAddress(
        plan.payeeAddress,
      );
    const fulfiller =
      canonicalStarknetAddress(
        plan.fulfillerAddress,
      );
    const beneficiary =
      canonicalStarknetAddress(
        plan.beneficiaryAddress,
      );

    return (
      Boolean(payer) &&
      Boolean(payee) &&
      payer !== payee &&
      fulfiller === payee &&
      beneficiary === payee &&
      [
        "otc",
        "freelance",
        "goods",
        "digital_goods",
        "bounty",
        "nft",
        "other",
      ].includes(
        plan.fulfillmentType,
      ) &&
      Number.isInteger(
        plan.reviewWindowSeconds,
      ) &&
      plan.reviewWindowSeconds >=
        60 &&
      plan.reviewWindowSeconds <=
        30 * 24 * 3600 &&
      Number.isInteger(
        plan.maxFulfillmentRounds,
      ) &&
      plan.maxFulfillmentRounds >=
        1 &&
      plan.maxFulfillmentRounds <=
        REKBER_MAX_FULFILLMENT_ROUNDS &&
      Number.isInteger(
        plan.maxRevisionRounds,
      ) &&
      plan.maxRevisionRounds >=
        0 &&
      plan.maxRevisionRounds <
        plan.maxFulfillmentRounds &&
      [
        "submission_review",
        "counterparty_confirm",
        "external_verify",
      ].includes(
        plan.verificationPolicy,
      )
    );
  } catch {
    return false;
  }
}
