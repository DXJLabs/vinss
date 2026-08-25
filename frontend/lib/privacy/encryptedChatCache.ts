"use client";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedLocalRecord {
  version: 1;
  iv: string;
  ciphertext: string;
}

function bytesToBase64(
  bytes: Uint8Array,
): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(
  value: string,
): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(
    binary.length,
  );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(
  bytes: Uint8Array,
): ArrayBuffer {
  const copy = new Uint8Array(
    bytes.byteLength,
  );

  copy.set(bytes);

  return copy.buffer;
}

async function importChatKey(
  rawKey: Uint8Array,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawKey),
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptLocalJson<T>(
  rawKey: Uint8Array,
  value: T,
): Promise<EncryptedLocalRecord> {
  const iv = crypto.getRandomValues(
    new Uint8Array(12),
  );

  const key =
    await importChatKey(rawKey);

  const plaintext =
    encoder.encode(
      JSON.stringify(value),
    );

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
      },
      key,
      toArrayBuffer(plaintext),
    );

  return {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(
      new Uint8Array(encrypted),
    ),
  };
}

export async function decryptLocalJson<T>(
  rawKey: Uint8Array,
  record: EncryptedLocalRecord,
): Promise<T> {
  if (record.version !== 1) {
    throw new Error(
      "Unsupported encrypted chat cache version",
    );
  }

  const key =
    await importChatKey(rawKey);

  const iv =
    base64ToBytes(record.iv);

  const ciphertext =
    base64ToBytes(
      record.ciphertext,
    );

  const decrypted =
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
      },
      key,
      toArrayBuffer(
        ciphertext,
      ),
    );

  return JSON.parse(
    decoder.decode(decrypted),
  ) as T;
}

export async function saveEncryptedLocalJson<T>(
  storageKey: string,
  rawKey: Uint8Array,
  value: T,
): Promise<void> {
  const record =
    await encryptLocalJson(
      rawKey,
      value,
    );

  window.localStorage.setItem(
    storageKey,
    JSON.stringify(record),
  );
}

export async function loadEncryptedLocalJson<T>(
  storageKey: string,
  rawKey: Uint8Array,
): Promise<T | null> {
  const raw =
    window.localStorage.getItem(
      storageKey,
    );

  if (!raw) return null;

  try {
    const record =
      JSON.parse(
        raw,
      ) as EncryptedLocalRecord;

    return await decryptLocalJson<T>(
      rawKey,
      record,
    );
  } catch {
    /*
     * A failed decrypt can be caused by a temporarily stale participant
     * key while wallet/room state is rehydrating.
     *
     * Encrypted recovery data must never be destroyed merely because one
     * read attempt used the wrong key. The caller can retry once the correct
     * room or pairwise key is available.
     */
    return null;
  }
}
