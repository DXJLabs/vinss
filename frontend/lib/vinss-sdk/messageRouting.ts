import { hash } from "starknet";
import {
  shortStringToFelt,
  type ChannelKey,
} from "./envelope";

export const MESSAGE_ENVELOPE_VERSION = 2;
export const MESSAGE_COMMITMENT_DOMAIN = "VINSS_MSG_COMMIT_V2";
export const GROUP_RECIPIENT_IDENTITY = "group";

export interface MessageRoute {
  /**
   * GROUP:
   *   recipientIdentity = "group"
   *
   * DIRECT later:
   *   recipientIdentity = recipient messaging identity/address
   *   encryptionKey/routingKey = pairwise Alice<->Bob key
   */
  recipientIdentity: string;
  encryptionKey?: ChannelKey;
  routingKey?: ChannelKey;
}

function keyToArrayBuffer(key: ChannelKey): ArrayBuffer {
  const copy = new Uint8Array(key);
  return copy.buffer.slice(
    copy.byteOffset,
    copy.byteOffset + copy.byteLength,
  );
}

/**
 * Per-message opaque routing tag.
 *
 * HMAC means an observer cannot derive sender/recipient identity without the
 * secret routing key. Including actionLocator makes the tag change for every
 * message even when the same participant sends repeatedly.
 */
export async function deriveMessageRoutingTag(
  routingKey: ChannelKey,
  role: "sender" | "recipient",
  identity: string,
  actionLocator: bigint,
): Promise<bigint> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyToArrayBuffer(routingKey),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const canonicalIdentity = identity.trim().toLowerCase();

  if (!canonicalIdentity) {
    throw new Error("Message routing identity cannot be empty.");
  }

  const input = new TextEncoder().encode(
    `VINSS_MSG_ROUTE_V2:${role}:${canonicalIdentity}:${actionLocator.toString(16)}`,
  );

  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, input),
  );

  // 31 bytes = 248 bits, safely inside a Starknet felt.
  let tag = 0n;
  for (const byte of digest.slice(0, 31)) {
    tag = (tag << 8n) | BigInt(byte);
  }

  // Contract explicitly rejects zero tags.
  return tag === 0n ? 1n : tag;
}

/**
 * Must match contracts/src/messaging/timeline_payload_hash.cairo V2 exactly:
 *
 * Poseidon(
 *   VINSS_MSG_COMMIT_V2,
 *   version,
 *   locator,
 *   sender_tag,
 *   recipient_tag,
 *   chunk_count,
 *   ...ciphertext
 * )
 */
export function commitMessagePayloadV2(
  actionLocator: bigint,
  senderTag: bigint,
  recipientTag: bigint,
  ciphertextChunks: bigint[],
): bigint {
  const inputs = [
    shortStringToFelt(MESSAGE_COMMITMENT_DOMAIN),
    BigInt(MESSAGE_ENVELOPE_VERSION),
    actionLocator,
    senderTag,
    recipientTag,
    BigInt(ciphertextChunks.length),
    ...ciphertextChunks,
  ];

  return BigInt(
    hash.computePoseidonHashOnElements(inputs.map(String)),
  );
}
