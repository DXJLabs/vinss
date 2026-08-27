import type { VinssLlmSelection } from "../agent/providers/types.js";

export type DisputeRole = "payer" | "payee";
export type DisputeVerificationClass =
  | "objective"
  | "digital_review"
  | "offchain";

export type DisputeEvidenceKind =
  | "statement"
  | "attachment"
  | "transaction"
  | "tracking"
  | "test"
  | "other";

export interface DisputeEvidenceItem {
  kind: DisputeEvidenceKind;
  label: string;
  value: string;
  commitment?: string;
}

export interface DisputePartyPacket {
  role: DisputeRole;
  walletAddress: string;

  /*
   * Explicit consent to disclose only this packet to the Dispute Agent.
   * Stage D2 will bind this packet cryptographically to the wallet before any
   * resolver executor exists.
   */
  consentToAgentReview: true;

  statement: string;
  evidence: DisputeEvidenceItem[];
  submittedAt: string;
}

export interface DisputeAcceptedTerms {
  dealType: string;
  summary: string;
  obligations: string[];
  completionCriteria: string[];
  deadline?: string;
  reviewPeriodSeconds?: number;
}

export interface DisputeFulfillmentSnapshot {
  submitted: boolean;
  confirmed: boolean;
  evidenceCommitment: string;
  submittedAt?: string;
}

export interface DisputeOnChainSnapshot {
  disputed: boolean;
  consumed: boolean;
  resolutionAuthorized: boolean;
  fulfillmentSubmitted: boolean;
  fulfillmentConfirmed: boolean;
}

export interface DisputePrincipalSnapshot {
  asset: string;
  rawAmount: string;

  /*
   * Trusted caller/oracle snapshot used only for the automation value cap.
   * Policy fails closed when it is absent.
   */
  usdMicros?: number;
}

export interface DisputeCase {
  custodyCommitment: string;
  verificationClass: DisputeVerificationClass;
  principal: DisputePrincipalSnapshot;
  acceptedTerms: DisputeAcceptedTerms;
  fulfillment: DisputeFulfillmentSnapshot;
  payer: DisputePartyPacket;
  payee: DisputePartyPacket;
  onChain: DisputeOnChainSnapshot;
}

export type DisputeDecisionKind =
  | "payer"
  | "payee"
  | "split"
  | "needs_review";

export interface DisputeAgentDecision {
  decision: DisputeDecisionKind;
  payerBps: number;
  payeeBps: number;
  confidence: number;
  reason: string;
  evidenceCommitment: string;
  flags: string[];
}

export type DisputePolicyStatus =
  | "AUTO_RESOLVE"
  | "NEEDS_REVIEW"
  | "REJECTED";

export interface DisputePolicyResult {
  status: DisputePolicyStatus;
  reasons: string[];
}

export interface DisputePolicyConfig {
  minAgentConfidence: number;
  maxAutoResolveUsdMicros: number;
}

/**
 * Values in this object must come from backend verification, never from the
 * browser's dispute payload.
 */
export interface DisputePolicyTrust {
  partyBindingVerified: boolean;
  verifiedPrincipalUsdMicros?: number;
}

export interface EvaluateDisputeOptions {
  provider?: VinssLlmSelection;
  policy?: Partial<DisputePolicyConfig>;
}
