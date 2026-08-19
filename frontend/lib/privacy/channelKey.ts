/**
 * Channel key derivation.
 *
 * Two paths, deliberately kept separate:
 *
 * 1. `deriveChannelKeyFromRoomSecret` — WORKS TODAY. Both parties in a Deal
 *    Room already have to agree out-of-band that they're doing a deal
 *    together (that's the whole premise of a private negotiation). This
 *    derives a symmetric key from a shared room secret the two parties
 *    exchange once, however they like (a link, a QR code, reading it aloud
 *    on a call). It never touches a viewing key and needs no on-chain
 *    lookup, so it's what the UI uses right now.
 *
 * 2. `deriveChannelKeyViaEcdh` — the STRK20-native path described in
 *    references/concepts.md and https://strk20-by-example.org/viewing-keys:
 *    sender picks random r, computes shared = r·K against the recipient's
 *    registered viewing public key K, and channel_key falls out of that
 *    shared secret. This needs one piece this scaffold does NOT have yet: a
 *    confirmed on-chain/SDK getter for "fetch address X's registered
 *    viewing public key". Implemented below with that lookup left as an
 *    explicit TODO — wire it up once the getter is confirmed, then switch
 *    the Deal Room UI to this path and retire the room-secret one.
 */

import { ec, hash } from "starknet";

const ENC_CHANNEL_KEY_TAG = "ENC_CHANNEL_KEY_TAG"; // per strk20-by-example.org/viewing-keys

// --- Path 1: room-secret (active today) ------------------------------------

export async function deriveChannelKeyFromRoomSecret(
  roomSecret: string,
): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(`VINSS_ROOM_KEY_V1:${roomSecret}`);
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
    `VINSS_GROUP_KEY_V1:${groupSecret}`,
  );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  );
  return new Uint8Array(digest);
}

// --- Path 2: STRK20-native ECDH (scaffolded, not yet wired to UI) ----------

export interface EphemeralChannelOpen {
  /** rG — publish this alongside the first message so the recipient can
   *  recompute the shared secret from their side. */
  ephemeralPublicKey: string;
  /** The derived symmetric channel key — same derivation math either side. */
  channelKey: Uint8Array;
}

/**
 * Sender side. `recipientViewingPublicKeyHex` is PUBLIC data (the
 * recipient's registered K) — this function needs no secret belonging to
 * the current user, so it's safe to run in the dapp.
 *
 * TODO before switching the UI to this path: confirm the on-chain/SDK call
 * that returns a registered viewing public key for an address (the
 * SetViewingKey registration is described in the viewing-keys page, but
 * this scaffold does not yet call a concrete getter for it — check the
 * Privacy SDK monorepo's discovery-providers docs, referenced in
 * references/links.md, before wiring this up).
 */
export async function deriveChannelKeyViaEcdh(
  recipientViewingPublicKeyHex: string,
): Promise<EphemeralChannelOpen> {
  const r = ec.starkCurve.utils.randomPrivateKey();
  const ephemeralPublicKey = ec.starkCurve.getPublicKey(r, false); // uncompressed rG
  const sharedPoint = ec.starkCurve.getSharedSecret(
    r,
    recipientViewingPublicKeyHex,
  );
  // shared.x per the spec — getSharedSecret returns the full point; take
  // the x-coordinate bytes (drop the 0x04 prefix byte on uncompressed form).
  const sharedX = sharedPoint.slice(1, 33);

  const maskFelt = hash.computePoseidonHashOnElements([
    shortStringToFelt(ENC_CHANNEL_KEY_TAG),
    bytesToFeltString(sharedX),
  ]);

  // Use the mask as raw key material for AES-GCM (SHA-256 of the felt to
  // get a clean 32-byte key) rather than replicating the pool's felt-level
  // hash-and-add masking, which is designed for masking individual public
  // felts in a note, not an arbitrary-length AES-encrypted envelope.
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(maskFelt),
  );

  return {
    ephemeralPublicKey: bytesToHex(ephemeralPublicKey),
    channelKey: new Uint8Array(keyMaterial),
  };
}

function shortStringToFelt(value: string): string {
  let result = 0n;
  for (let i = 0; i < value.length; i++) {
    result = (result << 8n) | BigInt(value.charCodeAt(i));
  }
  return result.toString();
}

function bytesToFeltString(bytes: Uint8Array): string {
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  return value.toString();
}

function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
