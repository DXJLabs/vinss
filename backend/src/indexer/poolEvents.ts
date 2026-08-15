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
  message: config.contracts.channelHelper,
  offer: config.contracts.offerHelper,
  escrow: config.contracts.privateEscrowHelper,
};

const EVENT_KEY_BY_KIND: Record<DiscoverKind, string> = {
  // Event selector = starknet_keccak(event name), matching the Cairo event
  // struct names in contracts/*/{messaging,offer}_events.cairo. The escrow
  // coordination contract's event name should be confirmed against
  // contracts/private_escrow/private_escrow_events.cairo before relying on
  // this in production — filled in as a best-effort placeholder here.
  message: hash.getSelectorFromName("MessageCommitted"),
  offer: hash.getSelectorFromName("OfferActionCommitted"),
  escrow: hash.getSelectorFromName("PrivateEscrowActionCommitted"),
};

export interface RawCommittedAction {
  actionLocator: string; // hex felt
  payloadCommitment: string; // hex felt
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

  const events = await getProvider().getEvents({
    address: contractAddress,
    from_block: { block_number: fromBlock },
    to_block: toBlock === "latest" ? "latest" : { block_number: toBlock },
    keys: [[EVENT_KEY_BY_KIND[kind]]],
    chunk_size: 100,
  });

  const results: RawCommittedAction[] = [];
  for (const event of events.events) {
    // keys[0] = event selector, keys[1] = the #[key] felt (the locator).
    const actionLocator = event.keys[1];
    const payloadCommitment = event.data[0];
    if (!actionLocator || !payloadCommitment) continue;
    results.push({
      actionLocator,
      payloadCommitment,
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
  // Record layout matches *ActionRecord structs: [envelope_version,
  // locator, payload_commitment, payload_chunk_count].
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
