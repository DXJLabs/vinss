const INVITE_VERSION = 2 as const;
const INVITE_TTL_MS = 30 * 60 * 1000;
const INVITE_AAD_TEXT = "VINSS_INVITE_V2";

export interface InvitePayload {
  v: 2;
  inviteId: string;
  roomId: string;
  roomSecret: string;
  label: string;
  expiresAt: string;
}

export interface CreateInvitePayload {
  roomId: string;
  roomSecret: string;
  label: string;
}

export interface EncryptedInviteToken {
  token: string;
  key: string;
  expiresAt: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes);
  return copy.buffer.slice(
    copy.byteOffset,
    copy.byteOffset + copy.byteLength,
  ) as ArrayBuffer;
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

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(
    new Uint8Array(byteLength),
  );

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getInviteAad(): ArrayBuffer {
  return toArrayBuffer(
    new TextEncoder().encode(INVITE_AAD_TEXT),
  );
}

/**
 * Invite V2:
 *
 * - roomSecret is encrypted locally with AES-256-GCM.
 * - ciphertext goes in the URL path.
 * - encryption key goes in the URL fragment (#k=...), which browsers do
 *   not send as part of the HTTP request.
 * - VINSS backend/Vercel never needs the plaintext roomSecret.
 */
export async function createInviteToken(
  input: CreateInvitePayload,
): Promise<EncryptedInviteToken> {
  const keyBytes = crypto.getRandomValues(
    new Uint8Array(32),
  );

  const iv = crypto.getRandomValues(
    new Uint8Array(12),
  );

  const expiresAt = new Date(
    Date.now() + INVITE_TTL_MS,
  ).toISOString();

  const payload: InvitePayload = {
    v: INVITE_VERSION,
    inviteId: randomHex(16),
    roomId: input.roomId,
    roomSecret: input.roomSecret,
    label: input.label,
    expiresAt,
  };

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt"],
  );

  const plaintext = new TextEncoder().encode(
    JSON.stringify(payload),
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: getInviteAad(),
      },
      key,
      toArrayBuffer(plaintext),
    ),
  );

  const packed = new Uint8Array(
    iv.length + encrypted.length,
  );

  packed.set(iv, 0);
  packed.set(encrypted, iv.length);

  return {
    token: bytesToBase64Url(packed),
    key: bytesToBase64Url(keyBytes),
    expiresAt,
  };
}

export async function decodeInviteToken(
  token: string,
  encodedKey: string,
): Promise<InvitePayload | null> {
  try {
    const packed = base64UrlToBytes(token);
    const keyBytes = base64UrlToBytes(encodedKey);

    if (packed.length <= 12 || keyBytes.length !== 32) {
      return null;
    }

    const iv = packed.slice(0, 12);
    const ciphertext = packed.slice(12);

    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(keyBytes),
      {
        name: "AES-GCM",
      },
      false,
      ["decrypt"],
    );

    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: getInviteAad(),
      },
      key,
      toArrayBuffer(ciphertext),
    );

    const payload = JSON.parse(
      new TextDecoder().decode(plaintext),
    ) as InvitePayload;

    if (
      payload?.v !== INVITE_VERSION ||
      typeof payload.inviteId !== "string" ||
      typeof payload.roomId !== "string" ||
      typeof payload.roomSecret !== "string" ||
      typeof payload.label !== "string" ||
      typeof payload.expiresAt !== "string"
    ) {
      return null;
    }

    if (
      !payload.inviteId ||
      !payload.roomId ||
      !payload.roomSecret
    ) {
      return null;
    }

    const expiresAt = Date.parse(payload.expiresAt);

    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
