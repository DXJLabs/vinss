import type { WalletAccountV6 } from "starknet";

export interface SendActionResult {
  transactionHash: string;
  actionLocator: bigint;
  payloadCommitment: bigint;
}

export interface VinssSdkContext {
  account: WalletAccountV6;
  channelKey: Uint8Array;
}

// --- Application-level payload shapes (encrypted, never sent as-is) -------

export type MessageKind = "text" | "attachment_ref" | "system_note";

export interface MessagePayload {
  kind: MessageKind;
  body: string;
  attachmentUri?: string;
  sentAt: string; // ISO timestamp, part of the encrypted payload by choice —
  // block timestamp is already public, but an app-level timestamp lets the
  // UI show "sent at" without depending on indexer latency.
}

export type OfferActionKind =
  | "create"
  | "counter"
  | "accept"
  | "reject"
  | "cancel"
  | "expire"
  | "prepare_escrow";

export interface OfferActionPayload {
  kind: OfferActionKind;
  rootOfferLocator?: string; // hex string of a prior actionLocator, if any.
  parentOfferLocator?: string;
  asset: string;
  amount: string; // decimal string, kept out of felt math until encrypted.
  paymentTerms: string;
  conditions?: string;
  expiresAt?: string;
  reason?: string;
}

export type EscrowActionKind =
  | "create"
  | "fund_intent"
  | "accept"
  | "fund_confirm"
  | "cancel"
  | "refund"
  | "dispute"
  | "resolve";

export interface EscrowActionPayload {
  kind: EscrowActionKind;
  dealOfferLocator: string;
  custodyCommitment?: string;
  releaseSecretHint?: string;
  refundAfter?: string;
  reason?: string;
}
