/**
 * Reads helper-contract events directly — NOT the transaction `sender`.
 *
 * Per references/concepts.md: a private transaction's on-chain `sender` is
 * the Privacy Pool/relayer, the same account for every user with a very
 * high nonce. Any per-user attribution must come from event data instead.
 * Here that's simpler than the pool's own `Deposit` event case, because
 * VINSS's own events (`MessageCommitted`, `OfferActionCommitted`, …) key on
 * `*_locator`, not on an address at all — there is no address to
 * misattribute. We still never read `tx.sender` for anything user-facing.
 */

import { RpcProvider, hash } from "starknet";
import { config } from "../config.js";
import type { DiscoverKind } from "../types.js";

let provider: RpcProvider | null = null;
function getProvider(): RpcProvider {
  if (!provider) provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  return provider;
}

const CONTRACT_BY_KIND: Record<DiscoverKind, string> = {
  message: config.contracts.messageHelper,
  offer: config.contracts.offerHelper,
  escrow: config.contracts.privateEscrowHelper,
};

const EVENT_KEY_BY_KIND: Record<DiscoverKind, string> = {
  // Event selectors match the committed-action events declared by VINSS helpers.
  message: hash.getSelectorFromName("MessageCommitted"),
  offer: hash.getSelectorFromName("OfferActionCommitted"),
  escrow: hash.getSelectorFromName("PrivateEscrowActionCommitted"),
};

export interface RawCommittedAction {
  actionLocator: string; // hex felt
  payloadCommitment: string; // hex felt
  senderTag?: string;
  recipientTag?: string;
  blockNumber: number;
  transactionHash: string;
}

/**
 * Scan a block range for *Committed events on the relevant helper. Every
 * event surfaces every locator that has ever been committed — filtering
 * down to "does this belong to my channel" happens client-side in
 * local decryption, not by any on-chain filter (there
 * is nothing on-chain to filter on beyond the contract address itself).
 */
export async function scanCommittedActions(
  kind: DiscoverKind,
  fromBlock: number,
  toBlock: number | "latest",
): Promise<RawCommittedAction[]> {
  const contractAddress = CONTRACT_BY_KIND[kind];
  if (!contractAddress) {
    throw new Error(
      `No contract address configured for kind "${kind}" — check backend/.env`,
    );
  }

  const rp = getProvider();

  let effectiveFromBlock = fromBlock;
  let effectiveToBlock: number | "latest" = toBlock;

  // Live discovery uses a bounded recent block range by default.
  // Large genesis-to-latest event scans can exceed RPC provider limits.
  // Explicit caller-provided ranges still keep their requested bounds.
  if (fromBlock === 0 && toBlock === "latest") {
    const latest = await rp.getBlockNumber();
    effectiveFromBlock = Math.max(0, latest - 10_000);
    effectiveToBlock = latest;
  }

  const events = await rp.getEvents({
    address: contractAddress,
    from_block: { block_number: effectiveFromBlock },
    to_block:
      effectiveToBlock === "latest"
        ? "latest"
        : { block_number: effectiveToBlock },
    keys: [[EVENT_KEY_BY_KIND[kind]]],
    chunk_size: 100,
  });

  const results: RawCommittedAction[] = [];
  for (const event of events.events) {
    // keys[0] = event selector, keys[1] = the #[key] felt (the locator).
    const actionLocator = event.keys[1];
    const payloadCommitment = event.data[0];

    if (!actionLocator || !payloadCommitment) continue;

    // V2 Message, Offer, and Private Escrow events all expose:
    // data[0] payload_commitment
    // data[1] sender_tag
    // data[2] recipient_tag
    const senderTag = event.data[1];
    const recipientTag = event.data[2];

    if (!senderTag || !recipientTag) {
      continue;
    }

    results.push({
      actionLocator,
      payloadCommitment,
      senderTag,
      recipientTag,
      blockNumber: event.block_number ?? 0,
      transactionHash: event.transaction_hash,
    });
  }
  return results;
}

/** Fetch every ciphertext chunk for one action via the helper's getters. */
export async function fetchCiphertextChunks(
  kind: DiscoverKind,
  actionLocator: string,
): Promise<bigint[]> {
  const contractAddress = CONTRACT_BY_KIND[kind];
  const getterByKind: Record<DiscoverKind, string> = {
    message: "get_message",
    offer: "get_offer_action",
    escrow: "get_private_escrow_action",
  };
  const chunkGetterByKind: Record<DiscoverKind, string> = {
    message: "get_payload_chunk",
    offer: "get_offer_payload_chunk",
    escrow: "get_private_escrow_payload_chunk",
  };

  const rp = getProvider();

  const record = await rp.callContract({
    contractAddress,
    entrypoint: getterByKind[kind],
    calldata: [actionLocator],
  });
  // The payload chunk count remains the final field for every action
  // record. Messaging V2 additionally stores sender_tag + recipient_tag
  // before payload_commitment.
  const chunkCount = Number(BigInt(record[record.length - 1] ?? "0"));

  const chunks: bigint[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunk = await rp.callContract({
      contractAddress,
      entrypoint: chunkGetterByKind[kind],
      calldata: [actionLocator, String(i)],
    });
    chunks.push(BigInt(chunk[0] ?? "0"));
  }
  return chunks;
}
