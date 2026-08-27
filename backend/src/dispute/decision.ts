import type {
  DisputeAgentDecision,
  DisputeDecisionKind,
} from "./types.js";

const MAX_REASON = 4_000;
const MAX_FLAGS = 12;
const MAX_FLAG = 120;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function parseDecisionKind(
  value: unknown,
): DisputeDecisionKind {
  if (
    value === "payer" ||
    value === "payee" ||
    value === "split" ||
    value === "needs_review"
  ) {
    return value;
  }

  throw new Error(
    "Dispute Agent returned an invalid decision.",
  );
}

function parseBps(
  value: unknown,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 10_000
  ) {
    throw new Error(
      `${label} must be an integer between 0 and 10000.`,
    );
  }

  return value;
}

function extractJson(
  answer: string,
): unknown {
  const clean =
    answer
      .trim()
      .replace(
        /^```(?:json)?\s*/i,
        "",
      )
      .replace(
        /\s*```$/,
        "",
      )
      .trim();

  const first =
    clean.indexOf("{");
  const last =
    clean.lastIndexOf("}");

  if (
    first < 0 ||
    last <= first
  ) {
    throw new Error(
      "Dispute Agent did not return a JSON object.",
    );
  }

  return JSON.parse(
    clean.slice(
      first,
      last + 1,
    ),
  );
}

/**
 * LLM prose never becomes executable state. Only this exact bounded structure
 * can reach the deterministic Policy Engine.
 */
export function parseDisputeAgentDecision(
  answer: string,
): DisputeAgentDecision {
  const value =
    extractJson(answer);

  if (!isRecord(value)) {
    throw new Error(
      "Dispute Agent decision must be an object.",
    );
  }

  const reason =
    typeof value.reason ===
      "string"
      ? value.reason
          .trim()
          .slice(0, MAX_REASON)
      : "";

  const evidenceCommitment =
    typeof value
      .evidenceCommitment ===
      "string"
      ? value
          .evidenceCommitment
          .trim()
      : "";

  const confidence =
    typeof value.confidence ===
      "number"
      ? value.confidence
      : NaN;

  if (
    !Number.isFinite(
      confidence,
    ) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error(
      "confidence must be between 0 and 1.",
    );
  }

  if (
    !reason ||
    !evidenceCommitment
  ) {
    throw new Error(
      "reason and evidenceCommitment are required.",
    );
  }

  const flags =
    Array.isArray(value.flags)
      ? value.flags
          .slice(0, MAX_FLAGS)
          .filter(
            (
              item,
            ): item is string =>
              typeof item ===
              "string",
          )
          .map(
            (item) =>
              item
                .trim()
                .slice(
                  0,
                  MAX_FLAG,
                ),
          )
          .filter(Boolean)
      : [];

  return {
    decision:
      parseDecisionKind(
        value.decision,
      ),
    payerBps:
      parseBps(
        value.payerBps,
        "payerBps",
      ),
    payeeBps:
      parseBps(
        value.payeeBps,
        "payeeBps",
      ),
    confidence,
    reason,
    evidenceCommitment,
    flags,
  };
}
