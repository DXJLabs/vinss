/**
 * Shared encrypted-envelope helpers.
 *
 * Every VINSS helper contract (messaging, offer, private_escrow,
 * escrow_rekber) shares the same public calldata shape:
 *
 *   [envelope_version, action_locator, claimed_payload_commitment,
 *    payload_chunk_count, ...ciphertext_chunks]
 *
 * and the same commitment rule: a domain-separated Poseidon hash over the
 * header fields and every ciphertext chunk, matching
 * contracts/utils/constants.cairo's VINSS_MESSAGE_COMMITMENT_DOMAIN pattern.
 *
 * IMPORTANT: this file never sees a viewing key. It accepts an already-derived
 * application symmetric key. Current direct Chat/Offer pairwise key agreement
 * is implemented client-side in participantKeys.ts; do not describe it as the
 * Privacy Pool viewing-key ECDH path.
 */

import { hash, num } from "starknet";
import { CONTRACTS, NETWORK } from "../starknet/constants";
import { packCiphertext, unpackCiphertext, PACKING_V2 } from "./ciphertextPacking";

export const ENVELOPE_VERSION = 1;
export const MAX_PAYLOAD_CHUNKS = 64;

export type ChannelKey = Uint8Array; // 32-byte application symmetric key.

export interface EncryptedEnvelope {
  envelopeVersion: number;
  actionLocator: bigint;
  payloadCommitment: bigint;
  payloadChunkCount: number;
  ciphertextChunks: bigint[];
}

/**
 * Poseidon-commit to the envelope header + every ciphertext chunk, matching
 * the contract's commitment domain and field order exactly. The domain
 * separator string must match the Cairo short-string constant
 * (e.g. 'VINSS_MSG_COMMIT_V1' for messaging) — pass it in per module so a
 * copy/paste mistake can't silently reuse another module's domain.
 */
export function commitPayload(
  domainSeparator: string,
  envelopeVersion: number,
  actionLocator: bigint,
  payloadChunkCount: number,
  ciphertextChunks: bigint[],
): bigint {
  const domainFelt = shortStringToFelt(domainSeparator);
  const inputs = [
    domainFelt,
    BigInt(envelopeVersion),
    actionLocator,
    BigInt(payloadChunkCount),
    ...ciphertextChunks,
  ];
  return BigInt(hash.computePoseidonHashOnElements(inputs.map(String)));
}

export function shortStringToFelt(value: string): bigint {
  if (value.length > 31) {
    throw new Error("Short string domain separators must be <= 31 bytes.");
  }
  let result = 0n;
  for (let i = 0; i < value.length; i++) {
    result = (result << 8n) | BigInt(value.charCodeAt(i));
  }
  return result;
}

/**
 * One-time locator generation. Locators must never be reused as a stable
 * offer/conversation/channel/participant/escrow id — every action gets its
 * own, derived from randomness plus the acting channel key so a discovery
 * client can re-derive candidates without a public index existing on-chain.
 */
export function generateActionLocator(channelKey: ChannelKey): bigint {
  const random = crypto.getRandomValues(new Uint8Array(31));
  const combined = new Uint8Array(channelKey.length + random.length);
  combined.set(channelKey, 0);
  combined.set(random, channelKey.length);
  const asFelts = Array.from(combined).map((b) => BigInt(b));
  return (
    BigInt(hash.computePoseidonHashOnElements(asFelts.map(String))) % FELT_PRIME
  );
}

const FELT_PRIME = 2n ** 251n + 17n * 2n ** 192n + 1n; // Starknet field prime.

/**
 * Convert any calldata item (bigint / number / already-hex string) into the
 * 0x-prefixed FELT string the STRK20 Wallet API requires
 * (pattern ^0x(0|[a-fA-F1-9][a-fA-F0-9]{0,62})$ — see
 * @starknet-io/starknet-types-0104's wallet-api/components.d.ts). Plain
 * `.map(String)` on a bigint produces a decimal string, which the wallet
 * rejects with INVALID_REQUEST_PAYLOAD — always send calldata through this
 * before handing it to strk20InvokeTransaction.
 */
export function toFelt(value: bigint | number | string): string {
  return num.toHex(value);
}

/**
 * AES-GCM encrypt a JSON-serializable payload with the channel key, then
 * split the ciphertext into felt-sized (< 2**251) chunks for calldata.
 *
 * This is VINSS application encryption, separate from the pool's native note
 * encryption managed by the wallet. V2 packing preserves all bytes and binds
 * new ciphertext to the selected network and pool with authenticated data.
 */
function channelKeyToArrayBuffer(channelKey: ChannelKey): ArrayBuffer {
  const copy = new Uint8Array(channelKey);
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
}

function payloadContext(): Uint8Array<ArrayBuffer> {
  if (!CONTRACTS.privacyPool) throw new Error("Privacy pool is not configured.");
  return new TextEncoder().encode(`VINSS_PAYLOAD_V2:${NETWORK}:${BigInt(CONTRACTS.privacyPool).toString(16)}`);
}

export async function encryptPayload(
  channelKey: ChannelKey,
  payload: unknown,
): Promise<bigint[]> {
  const key = await crypto.subtle.importKey(
    "raw",
    channelKeyToArrayBuffer(channelKey),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: payloadContext() }, key, plaintext),
  );

  const withIv = new Uint8Array(iv.length + ciphertext.length);
  withIv.set(iv, 0);
  withIv.set(ciphertext, iv.length);

  return packCiphertext(withIv, MAX_PAYLOAD_CHUNKS);
}

export async function decryptPayload(
  channelKey: ChannelKey,
  chunks: bigint[],
): Promise<unknown> {
  const bytes = unpackCiphertext(chunks, MAX_PAYLOAD_CHUNKS);
  if (bytes.length < 28) throw new Error("Ciphertext is missing its IV or authentication tag.");
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const key = await crypto.subtle.importKey(
    "raw",
    channelKeyToArrayBuffer(channelKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, ...(chunks[0] === PACKING_V2 ? { additionalData: payloadContext() } : {}) },
    key,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
