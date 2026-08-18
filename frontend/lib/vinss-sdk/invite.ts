import { hash, type WalletAccountV6 } from "starknet";
import { CONTRACTS } from "../starknet/constants";
import {
  shortStringToFelt,
  toFelt,
} from "./envelope";

const INVITE_VERSION = 2 as const;
const INVITE_TTL_MS = 30 * 60 * 1000;
const INVITE_AAD_TEXT = "VINSS_INVITE_V2";
const INVITE_COMMITMENT_TAG = "VINSS_INVITE_V1";

export interface InvitePayload {
  v: 2;
  inviteId: string;
  roomId: string;
  roomSecret: string;
  onchainSecret: string;
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

async function invokeInvite(
  account: WalletAccountV6,
  inviteCalldata: Array<bigint | number | string>,
): Promise<{ transaction_hash: string }> {
  if (!CONTRACTS.invite) {
    throw new Error(
      "NEXT_PUBLIC_INVITE_ADDRESS is not configured.",
    );
  }

  if (!CONTRACTS.messageHelperOpenNoteToken) {
    throw new Error(
      "NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN is not configured.",
    );
  }

  const calldata = inviteCalldata.map(toFelt);

  const actions = [
    {
      // Minimal private self-transfer = WriteOnce replay anchor.
      // Wallet API compiler requires created-note amount > 0.
      // 0x1 = one smallest STRK unit, not 1 STRK.
      type: "transfer" as const,
      token: CONTRACTS.messageHelperOpenNoteToken,
      amount: "0x1",
      recipient: toFelt(account.address),
    },
    {
      type: "invoke" as const,
      contract: CONTRACTS.invite,
      calldata: [
        toFelt(calldata.length),
        ...calldata,
      ],
    },
  ];

  try {
    return await account.strk20InvokeTransaction(actions);
  } catch (err) {
    console.error("[VINSS INVITE ACTIONS]", actions);
    throw err;
  }
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
  account: WalletAccountV6,
  input: CreateInvitePayload,
): Promise<EncryptedInviteToken> {
  if (!CONTRACTS.invite) {
    throw new Error(
      "NEXT_PUBLIC_INVITE_ADDRESS is not configured.",
    );
  }
  const keyBytes = crypto.getRandomValues(
    new Uint8Array(32),
  );

  const iv = crypto.getRandomValues(
    new Uint8Array(12),
  );

  const expiresAt = new Date(
    Date.now() + INVITE_TTL_MS,
  ).toISOString();

  let onchainSecret = BigInt("0x" + randomHex(31));
  if (onchainSecret === 0n) {
    onchainSecret = 1n;
  }

  const commitment = BigInt(
    hash.computePoseidonHashOnElements([
      String(shortStringToFelt(INVITE_COMMITMENT_TAG)),
      String(onchainSecret),
    ]),
  );

  const expiresAtSeconds =
    Math.floor(Date.parse(expiresAt) / 1000);

  // VinssInvite privacy_invoke calldata:
  // CREATE = [0, commitment, expires_at].
  // STRK20 selects privacy_invoke; first felt serializes Span length.
  await invokeInvite(
    account,
    [
      0,
      commitment,
      expiresAtSeconds,
    ],
  );

  const payload: InvitePayload = {
    v: INVITE_VERSION,
    inviteId: randomHex(16),
    roomId: input.roomId,
    roomSecret: input.roomSecret,
    onchainSecret: toFelt(onchainSecret),
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
      typeof payload.onchainSecret !== "string" ||
      typeof payload.label !== "string" ||
      typeof payload.expiresAt !== "string"
    ) {
      return null;
    }

    if (
      !payload.inviteId ||
      !payload.roomId ||
      !payload.roomSecret ||
      !payload.onchainSecret
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


export async function consumeInviteOnchain(
  account: WalletAccountV6,
  onchainSecret: string,
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.invite) {
    throw new Error(
      "NEXT_PUBLIC_INVITE_ADDRESS is not configured.",
    );
  }

  // CONSUME = [1, secret].
  const response = await invokeInvite(
    account,
    [
      1,
      onchainSecret,
    ],
  );

  return {
    transactionHash: response.transaction_hash,
  };
}
