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

export type MessageScope = "group" | "direct";

export interface MessageSenderIdentity {
  address: string;
  messagingPublicKey: string;
}

export interface AttachmentRef {
  version: 1;
  id: string;
  accessToken: string;
  iv: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
}

export interface WorkEvidence {
  type: "work_submission";

  // Links this submission to the funded Rekber without exposing it outside
  // the encrypted Message payload.
  custodyCommitment: string;

  note: string;

  // File bytes stay on user devices. Only the fingerprint and metadata are
  // encrypted into the on-chain message ciphertext.
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileSha256?: string;
}

export interface MessagePayload {
  kind: MessageKind;
  scope?: MessageScope;
  body: string;

  /**
   * Encrypted application metadata.
   * None of these fields are exposed by MessageHelper V2.
   */
  senderIdentity?: MessageSenderIdentity;
  recipientAddress?: string;

  // Group id is encrypted with the payload. The public helper still sees only
  // opaque routing tags and ciphertext.
  groupId?: string;

  attachmentUri?: string;
  attachment?: AttachmentRef;
  workEvidence?: WorkEvidence;
  sentAt: string; // ISO timestamp, part of the encrypted payload by choice —
  // block timestamp is already public, but an app-level timestamp lets the
  // UI show "sent at" without depending on indexer latency.
}

export type DealType =
  | "otc"
  | "freelance"
  | "goods"
  | "digital_goods"
  | "bounty"
  | "nft"
  | "other";

export type OfferActionKind =
  | "create"
  | "counter"
  | "accept"
  | "reject"
  | "cancel"
  | "expire";

export interface OfferActionPayload {
  kind: OfferActionKind;

  // These participant fields live only inside encrypted Offer ciphertext.
  // They let the client reconstruct a direct Alice<->Bob lifecycle without
  // exposing reusable wallet identities in the helper contract state.
  senderAddress?: string;
  recipientAddress?: string;

  // Keep application ordering inside ciphertext instead of guessing from a
  // Starknet block number, which is not a timestamp.
  sentAt?: string;

  // Encrypted deal classification. Never exposed by OfferHelper.
  dealType?: DealType;
  rootOfferLocator?: string; // hex string of a prior actionLocator, if any.
  parentOfferLocator?: string;
  asset: string;
  amount: string; // decimal string, kept out of felt math until encrypted.
  paymentTerms: string;
  conditions?: string;
  expiresAt?: string;
  reason?: string;

  // Used locally when an accepted Offer is associated with Rekber custody.
  custodyCommitment?: string;
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

/**
 * Immutable private snapshot of the accepted Offer used to prepare Rekber.
 *
 * All fields stay inside encrypted Private Escrow coordination ciphertext.
 * The public Rekber custody contract does not need to know the deal type or
 * plaintext business terms.
 */
export interface EscrowOfferSnapshot {
  acceptedOfferLocator: string;
  termsOfferLocator: string;
  rootOfferLocator?: string;
  dealType?: DealType;
  asset: string;
  amount: string;
  paymentTerms: string;
  conditions?: string;
  expiresAt?: string;
}

export interface EscrowActionPayload {
  kind: EscrowActionKind;

  // Pairwise encryption provides confidentiality, while these SNIP-12 fields
  // prove which wallet authored the Rekber setup or acceptance. Signatures are
  // themselves encrypted inside the direct coordination payload.
  coordinationVersion?: 2;
  coordinationSignature?: string[];

  // Exact create/counter action whose terms became the accepted agreement.
  dealOfferLocator: string;

  // Hash of the exact private Offer fields shown during Rekber review. It is
  // signed by both wallets and stays inside encrypted coordination payloads.
  dealTermsCommitment?: string;

  // Direct Escrow coordination follows the same encrypted participant model
  // as Direct Chat and Offer. These values are never public helper fields.
  senderAddress?: string;
  recipientAddress?: string;
  sentAt?: string;

  // Immutable accepted Offer snapshot. This lets every Offer template flow
  // into one generic Rekber mechanism without exposing template semantics.
  offerSnapshot?: EscrowOfferSnapshot;

  rootEscrowLocator?: string;
  parentEscrowLocator?: string;
  custodyCommitment?: string;
  // Rekber uses two independent settlement preimages. The payer keeps the
  // release authorization secret; the payee keeps the claim secret. Only the
  // commitments are shared before funding.
  releaseAuthorizationCommitment?: string;
  payeeClaimCommitment?: string;
  refundCommitment?: string;

  // Each party prepares an address-bound certificate claim before funding.
  // Claiming later is optional because ERC-721 ownership is public.
  payerCertificateCommitment?: string;
  payeeCertificateCommitment?: string;

  // This secret is only ever present inside an encrypted direct coordination
  // payload after the payer approves release. It must never enter logs,
  // analytics, Agent context, or plaintext backend storage.
  releaseAuthorizationSecret?: string;

  fundingTransactionHash?: string;
  settlementTransactionHash?: string;
  settlementOutcome?: "released" | "refunded";
  releaseSecretHint?: string;
  refundAfter?: string;
  reason?: string;
}
