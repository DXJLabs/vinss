"use client";

import type { ChannelKey } from "@/lib/privacy/envelope";

const DB_NAME = "vinss-messaging-keys";
const DB_VERSION = 1;
const STORE_NAME = "identities";

export interface MessagingIdentity {
  id: string;
  walletAddress: string;
  publicKey: string;
  privateKey: CryptoKey;
}

export interface RoomParticipant {
  address: string;
  publicKey: string;
}

interface StoredIdentity {
  id: string;
  walletAddress: string;
  publicKey: string;
  privateKey: CryptoKey;
}

/**
 * Normalize Starknet addresses numerically instead of only lower-casing text.
 *
 * Wallets may expose the same felt address with different leading-zero
 * formatting after reconnect/background transitions. Direct routing and
 * IndexedDB identity lookup must treat those textual forms as one account.
 */
export function canonicalStarknetAddress(
  address: string,
): string {
  const trimmed = address.trim();

  if (!trimmed) return "";

  try {
    return `0x${BigInt(trimmed).toString(16)}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function sameStarknetAddress(
  left: string | undefined | null,
  right: string | undefined | null,
): boolean {
  if (!left || !right) return false;

  return (
    canonicalStarknetAddress(left) ===
    canonicalStarknetAddress(right)
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToBytes(value: string): ArrayBuffer {
  const hex = value.replace(/^0x/, "");

  if (hex.length % 2 !== 0) {
    throw new Error("Invalid messaging public key.");
  }

  const out = new Uint8Array(hex.length / 2);

  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(
      hex.slice(index * 2, index * 2 + 2),
      16,
    );
  }

  return out.buffer.slice(
    out.byteOffset,
    out.byteOffset + out.byteLength,
  ) as ArrayBuffer;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIdentity(
  id: string,
): Promise<StoredIdentity | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);

    request.onsuccess = () =>
      resolve(
        (request.result as StoredIdentity | undefined) ??
          null,
      );

    request.onerror = () => reject(request.error);
  });
}

async function readAllIdentities(): Promise<
  StoredIdentity[]
> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () =>
      resolve(
        (request.result as StoredIdentity[] | undefined) ??
          [],
      );

    request.onerror = () => reject(request.error);
  });
}

async function writeIdentity(
  identity: StoredIdentity,
): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");

    tx.objectStore(STORE_NAME).put(identity);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Per-room, per-wallet VINSS messaging identity.
 *
 * The private ECDH key is stored as a non-exportable CryptoKey in IndexedDB.
 * It is never sent to VINSS backend or written on-chain.
 */
export async function getOrCreateMessagingIdentity(
  roomId: string,
  walletAddress: string,
): Promise<MessagingIdentity> {
  const address =
    canonicalStarknetAddress(walletAddress);

  const id = `${roomId}:${address}`;

  const existing = await readIdentity(id);

  if (existing) {
    return existing;
  }

  // Migrate identities created before numeric address normalization. This
  // prevents a wallet reconnect with different leading-zero formatting from
  // silently generating a different pairwise private key.
  const compatible = (
    await readAllIdentities()
  ).find(
    (candidate) =>
      candidate.id.startsWith(`${roomId}:`) &&
      sameStarknetAddress(
        candidate.walletAddress,
        walletAddress,
      ),
  );

  if (compatible) {
    const migrated: StoredIdentity = {
      ...compatible,
      id,
      walletAddress: address,
    };

    await writeIdentity(migrated);

    return migrated;
  }

  // Generate extractable only temporarily so the public key can be exported.
  const generated =
    (await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveBits"],
    )) as CryptoKeyPair;

  const publicRaw = new Uint8Array(
    await crypto.subtle.exportKey(
      "raw",
      generated.publicKey,
    ),
  );

  const privateJwk =
    await crypto.subtle.exportKey(
      "jwk",
      generated.privateKey,
    );

  // Re-import the private key as non-exportable before persistence.
  const privateKey =
    await crypto.subtle.importKey(
      "jwk",
      privateJwk,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      false,
      ["deriveBits"],
    );

  const identity: StoredIdentity = {
    id,
    walletAddress: address,
    publicKey: bytesToHex(publicRaw),
    privateKey,
  };

  await writeIdentity(identity);

  return identity;
}

/**
 * Derive the room-scoped pairwise Alice<->Bob encryption/routing key.
 *
 * Alice(privA, pubB) == Bob(privB, pubA).
 * Other room participants cannot derive this key from the group room secret.
 */
export async function deriveDirectMessageKey(
  roomId: string,
  privateKey: CryptoKey,
  peerPublicKeyHex: string,
): Promise<ChannelKey> {
  const peerPublicKey =
    await crypto.subtle.importKey(
      "raw",
      hexToBytes(peerPublicKeyHex),
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      false,
      [],
    );

  const sharedSecret =
    await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: peerPublicKey,
      },
      privateKey,
      256,
    );

  const hkdfMaterial =
    await crypto.subtle.importKey(
      "raw",
      sharedSecret,
      "HKDF",
      false,
      ["deriveBits"],
    );

  const salt = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `VINSS_ROOM:${roomId}`,
    ),
  );

  const derived =
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: new TextEncoder().encode(
          "VINSS_DIRECT_MESSAGE_KEY_V1",
        ),
      },
      hkdfMaterial,
      256,
    );

  return new Uint8Array(derived);
}
