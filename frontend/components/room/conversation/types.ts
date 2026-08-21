import type { OfferActionPayload, WorkEvidence } from "@/types/deal-room";

export interface ConversationEntry {
  id: string;
  kind: "message" | "offer";
  summary: string;
  transactionHash: string;
  actionLocator: string;
  sentAt: string;
  scope?: "group" | "direct";
  recipientAddress?: string;
  senderAddress?: string;
  groupId?: string;
  offerAction?: OfferActionPayload;
  workEvidence?: WorkEvidence;
  readAt?: string;
}

export interface ConversationParticipant {
  address: string;
}
