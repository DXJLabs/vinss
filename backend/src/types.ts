export type DiscoverKind = "message" | "offer" | "escrow";

export interface DiscoverRequest {
  /**
   * Public discovery parameters only.
   *
   * IMPORTANT: channel keys, room secrets, viewing keys, plaintext and any
   * other decryption material must never be sent to the backend.
   */
  kind: DiscoverKind;
  /** Optional: narrow the scan window to speed up discovery. */
  fromBlock?: number;
  toBlock?: number | "latest";
}

export interface DiscoveredAction<TPayload = unknown> {
  actionLocator: string;
  payloadCommitment: string;
  senderTag?: string;
  recipientTag?: string;
  ciphertextChunks: string[];
  blockNumber: number;
  transactionHash: string;
}
