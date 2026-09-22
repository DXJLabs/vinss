/**
 * VINSS application keys for existing rooms/groups. These are not STRK20
 * viewing keys or pool channel keys. The wallet owns native registration,
 * ephemeral ECDH, channel setup and note discovery via strk20InvokeTransaction.
 *
 * The unused deriveChannelKeyViaEcdh scaffold was removed: it hashed an ECDH
 * mask into an AES key, which is NOT the pool channel-key derivation. The
 * Wallet API in starknet 10.4.0 does not export the pool's channel keys.
 * See docs/SEPOLIA_SHIELD_STATUS.md for the verified SDK source and blocker.
 */
import { NETWORK, CONTRACTS } from "../starknet/constants";

function scopedSecret(domain: string, secret: string): string {
  // Retain existing mainnet application keys; fresh Sepolia rooms are isolated.
  return NETWORK === "mainnet" ? `${domain}:${secret}` :
    `${domain}:${NETWORK}:${CONTRACTS.privacyPool}:${secret}`;
}

export async function deriveChannelKeyFromRoomSecret(
  roomSecret: string,
): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(scopedSecret("VINSS_ROOM_KEY_V1", roomSecret));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return new Uint8Array(digest);
}

export function generateRoomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Group keys use their own domain separator so a Group secret never produces
 * the same symmetric key as a room secret with identical bytes.
 */
export async function deriveGroupKeyFromSecret(
  groupSecret: string,
): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(
    scopedSecret("VINSS_GROUP_KEY_V1", groupSecret),
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  );
  return new Uint8Array(digest);
}
