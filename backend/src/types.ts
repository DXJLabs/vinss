import type { StarknetNetwork } from "./config.js";

export type DiscoverKind = "message" | "offer" | "escrow";

export interface DiscoverRequest {
  /**
   * Public discovery parameters only.
   *
   * Decryption material, room identifiers, room secrets and plaintext are
   * deliberately not part of this API.
   */
  kind: DiscoverKind;
  fromBlock?: number;
  toBlock?: number | "latest";
}

export interface DiscoveredAction {
  actionLocator: string;
  payloadCommitment: string;
  senderTag?: string;
  recipientTag?: string;
  ciphertextChunks: string[];
  blockNumber: number;
  transactionHash: string;
}

export interface IndexedAction extends DiscoveredAction {
  network: StarknetNetwork;
  kind: DiscoverKind;
  contractAddress: string;
  indexedAt: string;
}

export type RekberEventKind = "funded" | "released" | "refunded";

export type ActivityKind = DiscoverKind | `rekber_${RekberEventKind}`;

export interface IndexedRekberEvent {
  network: StarknetNetwork;
  eventKind: RekberEventKind;
  contractAddress: string;
  custodyCommitment: string;
  token?: string;
  amount?: string;
  refundAfter?: number;
  outputNoteId?: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  indexedAt: string;
}

export interface GlobalActivityItem {
  network: StarknetNetwork;
  kind: ActivityKind;
  contractAddress: string;
  actionLocator: string;
  blockNumber: number;
  transactionHash: string;
  indexedAt: string;
  rekber?: {
    eventKind: RekberEventKind;
    custodyCommitment: string;
    token?: string;
    amount?: string;
    refundAfter?: number;
    outputNoteId?: string;
    timestamp: number;
  };
}

export type IndexerCheckpointStatus =
  "idle" | "syncing" | "caught_up" | "error";

export interface IndexerCheckpointView {
  identity: string;
  kind: DiscoverKind;
  contractAddress: string;
  startBlock: number;
  nextBlock: number;
  lastIndexedBlock: number | null;
  latestObservedBlock: number | null;
  status: IndexerCheckpointStatus;
  updatedAt: string;
}

export interface RekberIndexerCheckpointView {
  identity: string;
  contractAddress: string;
  startBlock: number;
  nextBlock: number;
  lastIndexedBlock: number | null;
  latestObservedBlock: number | null;
  status: IndexerCheckpointStatus;
  updatedAt: string;
}
