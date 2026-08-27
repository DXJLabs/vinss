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
  const review: string[] = [];

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
   * Two arbitrary wallets can sign the same case. AUTO_RESOLVE is forbidden
   * until backend verification binds them to the Rekber payer/payee setup.
   */
  if (
    !trust.partyBindingVerified
  ) {
    review.push(
      "PARTY_BINDING_NOT_VERIFIED",
    );
  }

  /*
   * Objective truth should use a deterministic verifier whenever possible.
   * AI arbitration must not override an available on-chain truth source.
   */
  if (
    disputeCase
      .verificationClass ===
    "objective"
  ) {
    review.push(
      "OBJECTIVE_VERIFICATION_REQUIRED",
    );
  }

  if (
    decision.decision ===
    "needs_review"
  ) {
    review.push(
      "AGENT_REQUESTED_REVIEW",
    );
  }

  if (
    decision.confidence <
    config.minAgentConfidence
  ) {
    review.push(
      "CONFIDENCE_BELOW_GATE",
    );
  }

  if (
    decision.flags.some(
      (flag) =>
        flag ===
          "evidence_conflict" ||
        flag ===
          "missing_evidence" ||
        flag ===
          "identity_uncertain",
    )
  ) {
    review.push(
      "AGENT_FLAG_REQUIRES_REVIEW",
    );
  }

  /*
   * principal.usdMicros in a client payload is informational only. The value
   * cap must use a backend/oracle-derived valuation supplied through trust.
   */
  const usdMicros =
    trust
      .verifiedPrincipalUsdMicros;

  if (
    usdMicros === undefined
  ) {
    review.push(
      "USD_VALUE_NOT_VERIFIED",
    );
  } else if (
    usdMicros >
    config
      .maxAutoResolveUsdMicros
  ) {
    review.push(
      "AUTO_RESOLVE_VALUE_CAP_EXCEEDED",
    );
  }

  if (
    review.length > 0
  ) {
    return {
      status: "NEEDS_REVIEW",
      reasons: review,
    };
  }

  return {
    status: "AUTO_RESOLVE",
    reasons: [],
  };
}
