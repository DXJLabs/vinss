import type { ChannelKey } from "@/lib/privacy/envelope";

export type PresenceKind = "typing" | "read" | "participant";

export interface PresencePayload {
  version: 1;
  type: PresenceKind;
  senderAddress: string;
  sentAt: string;
  active?: boolean;
  messageLocator?: string;

  // Participant identity is encrypted with the room key and never exposed
  // to the relay in plaintext.
  messagingPublicKey?: string;
}

export interface DecryptedPresenceEvent extends PresencePayload {
  expiresAt: number;
}

interface EncryptedPresenceRecord {
  eventId: string;
  iv: string;
  ciphertext: string;
  createdAt: number;
  expiresAt: number;
}

function keyBuffer(key: ChannelKey): ArrayBuffer {
  const copy = new Uint8Array(key);

  return copy.buffer.slice(
    copy.byteOffset,
    copy.byteOffset + copy.byteLength,
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

// Copy typed-array bytes into an ArrayBuffer accepted consistently by WebCrypto.
function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

// Derive one opaque relay id from the already room-scoped pairwise key.
// The backend can correlate live events for this pair but cannot recover
// wallet identities, room id, plaintext, or the pairwise key.
export async function derivePresenceChannelId(
  pairwiseKey: ChannelKey,
): Promise<string> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer(pairwiseKey),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      hmacKey,
      bytesToArrayBuffer(
        new TextEncoder().encode(
          "VINSS_DIRECT_PRESENCE_V1",
        ),
      ),
    ),
  );

  return bytesToHex(digest);
}

async function encryptPresence(
  pairwiseKey: ChannelKey,
  payload: PresencePayload,
): Promise<{
  iv: string;
  ciphertext: string;
}> {
  const aesKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer(pairwiseKey),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  // A fresh 96-bit IV prevents repeated presence ciphertext from repeating.
  const iv = crypto.getRandomValues(
    new Uint8Array(12),
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: bytesToArrayBuffer(iv),
      },
      aesKey,
      bytesToArrayBuffer(
        new TextEncoder().encode(
          JSON.stringify(payload),
        ),
      ),
    ),
  );

  return {
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(encrypted),
  };
}

async function decryptPresence(
  pairwiseKey: ChannelKey,
  record: EncryptedPresenceRecord,
): Promise<DecryptedPresenceEvent | null> {
  try {
    const aesKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer(pairwiseKey),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const clear = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytesToArrayBuffer(base64UrlToBytes(record.iv)),
      },
      aesKey,
      bytesToArrayBuffer(
        base64UrlToBytes(record.ciphertext),
      ),
    );

    const payload = JSON.parse(
      new TextDecoder().decode(clear),
    ) as PresencePayload;

    if (
      payload.version !== 1 ||
      (payload.type !== "typing" &&
        payload.type !== "read" &&
        payload.type !== "participant") ||
      typeof payload.senderAddress !== "string" ||
      typeof payload.sentAt !== "string"
    ) {
      return null;
    }

    return {
      ...payload,
      expiresAt: record.expiresAt,
    };
  } catch {
    // Unrelated or malformed ciphertext is ignored locally.
    return null;
  }
}

export async function publishPresence(
  backendUrl: string,
  pairwiseKey: ChannelKey,
  payload: PresencePayload,
  ttlMs: number,
): Promise<void> {
  const channelId =
    await derivePresenceChannelId(pairwiseKey);

  const encrypted =
    await encryptPresence(pairwiseKey, payload);

  // Random ids make retries idempotent without exposing message identity.
  const eventId = crypto
    .randomUUID()
    .replace(/-/g, "");

  const response = await fetch(
    `${backendUrl}/presence/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId,
        eventId,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        ttlMs,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Presence publish failed: ${response.status}`,
    );
  }
}

export async function pollPresence(
  backendUrl: string,
  pairwiseKey: ChannelKey,
): Promise<DecryptedPresenceEvent[]> {
  const channelId =
    await derivePresenceChannelId(pairwiseKey);

  const response = await fetch(
    `${backendUrl}/presence/poll`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelId }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Presence poll failed: ${response.status}`,
    );
  }

  const body = (await response.json()) as {
    events?: EncryptedPresenceRecord[];
  };

  const decrypted = await Promise.all(
    (body.events ?? []).map((record) =>
      decryptPresence(pairwiseKey, record),
    ),
  );

  return decrypted.filter(
    (event): event is DecryptedPresenceEvent =>
      event !== null,
  );
}
