import type { ChannelKey } from "./envelope";

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

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToBytes(value: string): ArrayBuffer {
  const hex = value.replace(/^0x/, "");

  if (hex.length % 2 !== 0) {
    throw new Error("Invalid messaging public key.");
  }

  const out = new Uint8Array(hex.length / 2);

  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
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
      resolve((request.result as StoredIdentity | undefined) ?? null);

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
 * Private ECDH key is stored as a non-exportable CryptoKey in IndexedDB.
 * It is never sent to VINSS backend or written on-chain.
 */
export async function getOrCreateMessagingIdentity(
  roomId: string,
  walletAddress: string,
): Promise<MessagingIdentity> {
  const address = normalizeAddress(walletAddress);
  const id = `${roomId}:${address}`;

  const existing = await readIdentity(id);

  if (existing) {
    return existing;
  }

  // Generate extractable only temporarily so the public key can be exported.
  const generated = (await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;

  const publicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", generated.publicKey),
  );

  const privateJwk = await crypto.subtle.exportKey(
    "jwk",
    generated.privateKey,
  );

  // Re-import private key as NON-EXPORTABLE before persistence.
  const privateKey = await crypto.subtle.importKey(
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
 * Derive a pairwise Alice<->Bob encryption/routing key.
 *
 * Alice(privA, pubB) == Bob(privB, pubA)
 *
 * Other room participants cannot derive this key from the group room secret.
 */
export async function deriveDirectMessageKey(
  roomId: string,
  privateKey: CryptoKey,
  peerPublicKeyHex: string,
): Promise<ChannelKey> {
  const peerPublicKey = await crypto.subtle.importKey(
    "raw",
    hexToBytes(peerPublicKeyHex),
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    [],
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    privateKey,
    256,
  );

  const hkdfMaterial = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveBits"],
  );

  const salt = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`VINSS_ROOM:${roomId}`),
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: new TextEncoder().encode("VINSS_DIRECT_MESSAGE_KEY_V1"),
    },
    hkdfMaterial,
    256,
  );

  return new Uint8Array(derived);
}
