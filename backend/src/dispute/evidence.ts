import { createHash } from "node:crypto";

import type {
  DisputeAcceptedTerms,
  DisputeCase,
  DisputeEvidenceItem,
  DisputeEvidenceKind,
  DisputeOnChainSnapshot,
  DisputePartyPacket,
  DisputePrincipalSnapshot,
  DisputeRole,
  DisputeVerificationClass,
} from "./types.js";

const MAX_SHORT = 160;
const MAX_TEXT = 8_000;
const FELT_PRIME =
  2n ** 251n +
  17n * 2n ** 192n +
  1n;
const MAX_EVIDENCE_ITEMS = 20;
const MAX_OBLIGATIONS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }

  const clean = value.trim();

  if (!clean) {
    throw new Error(`${label} is required.`);
  }

  return clean.slice(0, maxLength);
}

function optionalString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const clean = value.trim();
  return clean
    ? clean.slice(0, maxLength)
    : undefined;
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    return undefined;
  }

  return value;
}

function parseRole(
  value: unknown,
): DisputeRole {
  if (
    value !== "payer" &&
    value !== "payee"
  ) {
    throw new Error(
      "Dispute packet role must be payer or payee.",
    );
  }

  return value;
}

function parseVerificationClass(
  value: unknown,
): DisputeVerificationClass {
  if (
    value !== "objective" &&
    value !== "digital_review" &&
    value !== "offchain"
  ) {
    throw new Error(
      "verificationClass is invalid.",
    );
  }

  return value;
}

function parseEvidenceKind(
  value: unknown,
): DisputeEvidenceKind {
  switch (value) {
    case "statement":
    case "attachment":
    case "transaction":
    case "tracking":
    case "test":
    case "other":
      return value;
    default:
      return "other";
  }
}

function sanitizeEvidenceItem(
  value: unknown,
): DisputeEvidenceItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const label =
    optionalString(
      value.label,
      MAX_SHORT,
    );
  const evidenceValue =
    optionalString(
      value.value,
      MAX_TEXT,
    );

  if (
    !label ||
    !evidenceValue
  ) {
    return null;
  }

  return {
    kind:
      parseEvidenceKind(
        value.kind,
      ),
    label,
    value: evidenceValue,
    commitment:
      optionalString(
        value.commitment,
        MAX_SHORT,
      ),
  };
}

function sanitizePartyPacket(
  value: unknown,
  expectedRole: DisputeRole,
): DisputePartyPacket {
  if (!isRecord(value)) {
    throw new Error(
      `${expectedRole} evidence packet is required.`,
    );
  }

  const role =
    parseRole(value.role);

  if (role !== expectedRole) {
    throw new Error(
      `${expectedRole} evidence packet has the wrong role.`,
    );
  }

  if (
    value.consentToAgentReview !== true
  ) {
    throw new Error(
      `${expectedRole} must explicitly consent to Dispute Agent review.`,
    );
  }

  const evidence =
    (
      Array.isArray(value.evidence)
        ? value.evidence
        : []
    )
      .slice(0, MAX_EVIDENCE_ITEMS)
      .map(sanitizeEvidenceItem)
      .filter(
        (
          item,
        ): item is DisputeEvidenceItem =>
          item !== null,
      );

  const statement =
    requiredString(
      value.statement,
      `${expectedRole}.statement`,
      MAX_TEXT,
    );

  if (evidence.length === 0) {
    throw new Error(
      `${expectedRole} must submit at least one dispute evidence item.`,
    );
  }

  return {
    role,
    walletAddress:
      requiredString(
        value.walletAddress,
        `${expectedRole}.walletAddress`,
        MAX_SHORT,
      ),
    consentToAgentReview: true,
    statement,
    evidence,
    submittedAt:
      requiredString(
        value.submittedAt,
        `${expectedRole}.submittedAt`,
        MAX_SHORT,
      ),
  };
}

function sanitizeTerms(
  value: unknown,
): DisputeAcceptedTerms {
  if (!isRecord(value)) {
    throw new Error(
      "acceptedTerms are required.",
    );
  }

  const obligations =
    (
      Array.isArray(value.obligations)
        ? value.obligations
        : []
    )
      .slice(0, MAX_OBLIGATIONS)
      .map(
        (item) =>
          optionalString(
            item,
            MAX_TEXT,
          ),
      )
      .filter(
        (item): item is string =>
          Boolean(item),
      );

  const criteria =
    (
      Array.isArray(
        value.completionCriteria,
      )
        ? value.completionCriteria
        : []
    )
      .slice(0, MAX_OBLIGATIONS)
      .map(
        (item) =>
          optionalString(
            item,
            MAX_TEXT,
          ),
      )
      .filter(
        (item): item is string =>
          Boolean(item),
      );

  if (
    obligations.length === 0 ||
    criteria.length === 0
  ) {
    throw new Error(
      "Accepted dispute terms need obligations and completion criteria.",
    );
  }

  return {
    dealType:
      requiredString(
        value.dealType,
        "acceptedTerms.dealType",
        MAX_SHORT,
      ),
    summary:
      requiredString(
        value.summary,
        "acceptedTerms.summary",
        MAX_TEXT,
      ),
    obligations,
    completionCriteria:
      criteria,
    deadline:
      optionalString(
        value.deadline,
        MAX_SHORT,
      ),
    reviewPeriodSeconds:
      boundedInteger(
        value.reviewPeriodSeconds,
        60,
        30 * 24 * 60 * 60,
      ),
  };
}

function sanitizePrincipal(
  value: unknown,
): DisputePrincipalSnapshot {
  if (!isRecord(value)) {
    throw new Error(
      "principal is required.",
    );
  }

  const usdMicros =
    boundedInteger(
      value.usdMicros,
      1,
      Number.MAX_SAFE_INTEGER,
    );

  return {
    asset:
      requiredString(
        value.asset,
        "principal.asset",
        MAX_SHORT,
      ),
    rawAmount:
      requiredString(
        value.rawAmount,
        "principal.rawAmount",
        MAX_SHORT,
      ),
    ...(usdMicros !== undefined
      ? { usdMicros }
      : {}),
  };
}

function sanitizeOnChain(
  value: unknown,
): DisputeOnChainSnapshot {
  if (!isRecord(value)) {
    throw new Error(
      "onChain snapshot is required.",
    );
  }

  return {
    disputed:
      value.disputed === true,
    consumed:
      value.consumed === true,
    resolutionAuthorized:
      value.resolutionAuthorized ===
      true,
    fulfillmentSubmitted:
      value.fulfillmentSubmitted ===
      true,
    fulfillmentConfirmed:
      value.fulfillmentConfirmed ===
      true,
  };
}

/**
 * Dedicated dispute disclosure boundary.
 *
 * Normal Agent context must keep stripping private plaintext. This allowlist
 * exposes only dispute fields both parties explicitly chose to disclose.
 * Unknown keys (roomSecret, channelKey, private keys, unrelated chat) drop.
 */
export function sanitizeDisputeCase(
  value: unknown,
): DisputeCase {
  if (!isRecord(value)) {
    throw new Error(
      "Dispute case is required.",
    );
  }

  const fulfillment =
    isRecord(value.fulfillment)
      ? value.fulfillment
      : {};

  return {
    custodyCommitment:
      requiredString(
        value.custodyCommitment,
        "custodyCommitment",
        MAX_SHORT,
      ),
    verificationClass:
      parseVerificationClass(
        value.verificationClass,
      ),
    principal:
      sanitizePrincipal(
        value.principal,
      ),
    acceptedTerms:
      sanitizeTerms(
        value.acceptedTerms,
      ),
    fulfillment: {
      submitted:
        fulfillment.submitted ===
        true,
      confirmed:
        fulfillment.confirmed ===
        true,
      evidenceCommitment:
        requiredString(
          fulfillment
            .evidenceCommitment,
          "fulfillment.evidenceCommitment",
          MAX_SHORT,
        ),
      submittedAt:
        optionalString(
          fulfillment.submittedAt,
          MAX_SHORT,
        ),
    },
    payer:
      sanitizePartyPacket(
        value.payer,
        "payer",
      ),
    payee:
      sanitizePartyPacket(
        value.payee,
        "payee",
      ),
    onChain:
      sanitizeOnChain(
        value.onChain,
      ),
  };
}

function stableValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(
          (key) => [
            key,
            stableValue(
              value[key],
            ),
          ],
        ),
    );
  }

  return value;
}

function canonicalDisputeCase(
  disputeCase: DisputeCase,
): string {
  return JSON.stringify(
    stableValue(
      disputeCase,
    ),
  );
}

export function computeDisputeCaseCommitment(
  disputeCase: DisputeCase,
): string {
  return (
    "0x" +
    createHash("sha256")
      .update(
        canonicalDisputeCase(
          disputeCase,
        ),
      )
      .digest("hex")
  );
}

/*
 * SNIP-12 felt fields must fit Starknet's field prime. The full SHA-256
 * commitment above remains the public Agent/policy identity; this felt is only
 * the signature-friendly representation of that same canonical case.
 */
export function computeDisputeCaseFeltCommitment(
  disputeCase: DisputeCase,
): string {
  const digest =
    BigInt(
      computeDisputeCaseCommitment(
        disputeCase,
      ),
    ) % FELT_PRIME;

  return `0x${digest.toString(16)}`;
}
