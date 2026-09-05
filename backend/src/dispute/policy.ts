import type {
  DisputeAgentDecision,
  DisputeCase,
  DisputePolicyConfig,
  DisputePolicyResult,
  DisputePolicyTrust,
} from "./types.js";

export const DEFAULT_DISPUTE_POLICY:
  DisputePolicyConfig = {
  minAgentConfidence: 0.9,

  // $500.00 in USD micros.
  maxAutoResolveUsdMicros:
    500 * 1_000_000,
};

function decisionShapeIsConsistent(
  decision: DisputeAgentDecision,
): boolean {
  if (
    decision.payerBps +
      decision.payeeBps !==
    10_000
  ) {
    return false;
  }

  switch (decision.decision) {
    case "payer":
      return (
        decision.payerBps ===
          10_000 &&
        decision.payeeBps ===
          0
      );
    case "payee":
      return (
        decision.payerBps ===
          0 &&
        decision.payeeBps ===
          10_000
      );
    case "split":
      return (
        decision.payerBps > 0 &&
        decision.payeeBps > 0
      );
    case "needs_review":
      return true;
  }
}

/**
 * The Agent recommends. This deterministic gate decides whether a later
 * executor may even consider the recommendation.
 *
 * No private key, RPC signer, or contract call belongs here.
 */
export function evaluateDisputePolicy(
  disputeCase: DisputeCase,
  caseCommitment: string,
  decision: DisputeAgentDecision,
  config: DisputePolicyConfig =
    DEFAULT_DISPUTE_POLICY,
  trust: DisputePolicyTrust = {
    partyBindingVerified: false,
  },
): DisputePolicyResult {
  const rejected: string[] = [];
  const hardStop: string[] = [];
  const fallback: string[] = [];

  if (
    decision.evidenceCommitment !==
    caseCommitment
  ) {
    rejected.push(
      "CASE_COMMITMENT_MISMATCH",
    );
  }

  if (
    !decisionShapeIsConsistent(
      decision,
    )
  ) {
    rejected.push(
      "INVALID_SPLIT",
    );
  }

  if (
    !disputeCase.onChain.disputed
  ) {
    rejected.push(
      "CUSTODY_NOT_DISPUTED",
    );
  }

  if (
    disputeCase.onChain.consumed
  ) {
    rejected.push(
      "CUSTODY_ALREADY_CONSUMED",
    );
  }

  if (
    disputeCase.onChain
      .resolutionAuthorized
  ) {
    rejected.push(
      "RESOLUTION_ALREADY_AUTHORIZED",
    );
  }

  if (
    !disputeCase.onChain
      .fulfillmentSubmitted
  ) {
    rejected.push(
      "FULFILLMENT_NOT_SUBMITTED",
    );
  }

  if (
    rejected.length > 0
  ) {
    return {
      status: "REJECTED",
      reasons: rejected,
    };
  }

  /*
   * Hard trust failures must never become automatic financial authority.
   * These conditions mean VINSS cannot safely prove who/what is being
   * resolved, so execution remains fail-closed.
   */
  if (
    !trust.partyBindingVerified
  ) {
    hardStop.push(
      "PARTY_BINDING_NOT_VERIFIED",
    );
  }

  /*
   * Objective disputes belong to their deterministic verifier rather than
   * the subjective Agent / AutoSplit fallback.
   */
  if (
    disputeCase
      .verificationClass ===
    "objective"
  ) {
    hardStop.push(
      "OBJECTIVE_VERIFICATION_REQUIRED",
    );
  }

  /*
   * Subjective uncertainty is not an operator-review workflow.
   *
   * Both parties explicitly sign Execution=AutoSplit for the exact case.
   * When the Agent cannot justify a directional award, VINSS deterministically
   * falls back to 50/50 instead of requiring a human operator to choose.
   */
  if (
    decision.decision ===
    "needs_review"
  ) {
    fallback.push(
      "AGENT_REQUESTED_REVIEW",
    );
  }

  if (
    decision.confidence <
    config.minAgentConfidence
  ) {
    fallback.push(
      "CONFIDENCE_BELOW_GATE",
    );
  }

  if (
    decision.flags.some(
      (flag) =>
        flag ===
          "evidence_conflict" ||
        flag ===
          "missing_evidence",
    )
  ) {
    fallback.push(
      "EVIDENCE_REQUIRES_FALLBACK",
    );
  }

  /*
   * Identity uncertainty is different from weak evidence about the deal.
   * Do not resolve automatically when the evidence itself may belong to the
   * wrong identity/context.
   */
  if (
    decision.flags.includes(
      "identity_uncertain",
    )
  ) {
    hardStop.push(
      "IDENTITY_UNCERTAIN",
    );
  }

  /*
   * Browser-provided USD values have no authority. Automation uses only the
   * backend/oracle-derived valuation.
   */
  const usdMicros =
    trust
      .verifiedPrincipalUsdMicros;

  if (
    usdMicros === undefined
  ) {
    hardStop.push(
      "USD_VALUE_NOT_VERIFIED",
    );
  } else if (
    usdMicros >
    config
      .maxAutoResolveUsdMicros
  ) {
    hardStop.push(
      "AUTO_RESOLVE_VALUE_CAP_EXCEEDED",
    );
  }

  if (
    hardStop.length > 0
  ) {
    return {
      status: "NEEDS_REVIEW",
      reasons:
        Array.from(
          new Set([
            ...hardStop,
            ...fallback,
          ]),
        ),
    };
  }

  if (
    fallback.length > 0
  ) {
    return {
      status: "AUTO_RESOLVE",
      reasons: [
        "AUTOMATIC_50_50_FALLBACK",
        ...Array.from(
          new Set(fallback),
        ),
      ],
    };
  }

  return {
    status: "AUTO_RESOLVE",
    reasons: [],
  };
}

/*
 * Convert a soft Agent uncertainty into the exact deterministic settlement
 * authorized by the parties' AutoSplit consent.
 *
 * The original Agent decision remains persisted as first-decision-wins.
 * Only the financial execution decision is normalized to 50/50.
 */
export function decisionForDisputeExecution(
  decision: DisputeAgentDecision,
  policy: DisputePolicyResult,
): DisputeAgentDecision {
  if (
    policy.status !==
      "AUTO_RESOLVE" ||
    !policy.reasons.includes(
      "AUTOMATIC_50_50_FALLBACK",
    )
  ) {
    return decision;
  }

  return {
    ...decision,
    decision: "split",
    payerBps: 5_000,
    payeeBps: 5_000,
    reason:
      "Evidence did not justify a directional award. VINSS applied the deterministic AutoSplit fallback: 50% Payer / 50% Payee.",
    flags:
      Array.from(
        new Set([
          ...decision.flags,
          "automatic_50_50_fallback",
        ]),
      ),
  };
}
