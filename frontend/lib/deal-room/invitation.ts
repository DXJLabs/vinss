import { hash, RpcProvider, type WalletAccountV6 } from "starknet";
import { CONTRACTS, RPC_URL } from "../starknet/constants";
import {
  shortStringToFelt,
  toFelt,
} from "@/lib/privacy/envelope";

const INVITE_VERSION = 3 as const;
const LEGACY_INVITE_VERSION = 2 as const;
const INVITE_AAD_TEXT = "VINSS_INVITE_V3";
const LEGACY_INVITE_AAD_TEXT = "VINSS_INVITE_V2";
const INVITE_COMMITMENT_TAG = "VINSS_INVITE_V1";

export type InviteScope = "direct" | "group";
export type GroupInviteDuration = "24h" | "7d";

export const DIRECT_INVITE_TTL_MS = 60 * 60 * 1000;

export const GROUP_INVITE_TTL_MS: Record<
  GroupInviteDuration,
  number
> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const inviteReadProvider = new RpcProvider({
  nodeUrl: RPC_URL,
});

async function waitForInviteOnchain(
  commitment: bigint,
  attempts = 8,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await inviteReadProvider.callContract({
        contractAddress: CONTRACTS.invite,
        entrypoint: "get_invite",
        calldata: [toFelt(commitment)],
      });

      // InviteEntry = [expires_at, consumed, exists]
      if (BigInt(result[2] ?? "0") !== 0n) {
        return true;
      }
    } catch {
      // RPC may not see the new state immediately.
    }

    if (attempt + 1 < attempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1500),
      );
    }
  }

  return false;
}

export interface InvitePayload {
  v: 3;
  inviteId: string;
  scope: InviteScope;
  roomId: string;
  roomSecret?: string;
  onchainSecret: string;
  label: string;
  inviterAddress?: string;

  // Group metadata is present only for admin-created Group invites.
  groupId?: string;
  groupName?: string;
  groupSecret?: string;
  groupOwnerAddress?: string;

  expiresAt: string;
}

interface LegacyInvitePayload {
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
  scope: InviteScope;
  groupDuration?: GroupInviteDuration;

  // Group invites are bound to one concrete admin-created Group.
  groupId?: string;
  groupName?: string;
  groupSecret?: string;
  groupOwnerAddress?: string;
}

export interface EncryptedInviteToken {
  token: string;
  key: string;
  scope: InviteScope;
  expiresAt: string;
  commitment: string;
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

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
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

function getInviteAad(text: string): ArrayBuffer {
  return toArrayBuffer(
    new TextEncoder().encode(text),
  );
}

function computeInviteCommitment(
  onchainSecret: string | bigint,
): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements([
      String(shortStringToFelt(INVITE_COMMITMENT_TAG)),
      String(BigInt(onchainSecret)),
    ]),
  );
}

function resolveInviteTtlMs(
  input: CreateInvitePayload,
): number {
  if (input.scope === "direct") {
    return DIRECT_INVITE_TTL_MS;
  }

  return GROUP_INVITE_TTL_MS[
    input.groupDuration ?? "24h"
  ];
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

  const treasuryAddress =
    process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!treasuryAddress) {
    throw new Error(
      "NEXT_PUBLIC_VINSS_TREASURY_ADDRESS is not configured.",
    );
  }

  const actions = [
    {
      // Consumes a private note, providing pool replay protection.
      // 10 wei goes to VINSS treasury; Invite itself has no token output.
      type: "withdraw" as const,
      token: CONTRACTS.messageHelperOpenNoteToken,
      amount: "0xa",
      recipient: treasuryAddress,
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

  return account.strk20InvokeTransaction(actions);
}

/**
 * Invite V3 keeps Chat and Group invitation lifecycles explicit.
 *
 * Scope and expiry live inside the encrypted payload. The deployed Invite
 * contract remains generic: it only enforces one-time use and expiry.
 */
export async function createInviteToken(
  account: WalletAccountV6,
  input: CreateInvitePayload,
  onPrepared?: (
    invite: EncryptedInviteToken,
  ) => void | Promise<void>,
): Promise<EncryptedInviteToken> {
  if (!CONTRACTS.invite) {
    throw new Error(
      "NEXT_PUBLIC_INVITE_ADDRESS is not configured.",
    );
  }

  if (
    input.scope === "group" &&
    (!input.groupId ||
      !input.groupName ||
      !input.groupSecret ||
      !input.groupOwnerAddress)
  ) {
    throw new Error(
      "A Group invite must be bound to an admin-created Group.",
    );
  }

  const keyBytes = crypto.getRandomValues(
    new Uint8Array(32),
  );
  const iv = crypto.getRandomValues(
    new Uint8Array(12),
  );

  const expiresAt = new Date(
    Date.now() + resolveInviteTtlMs(input),
  ).toISOString();

  let onchainSecret = BigInt(
    "0x" + randomHex(31),
  );

  if (onchainSecret === 0n) {
    onchainSecret = 1n;
  }

  const commitment =
    computeInviteCommitment(onchainSecret);

  const expiresAtSeconds =
    Math.floor(Date.parse(expiresAt) / 1000);

  // Recovery metadata exists before Ready X can background the dapp.
  const payload: InvitePayload = {
    v: INVITE_VERSION,
    inviteId: randomHex(16),
    scope: input.scope,
    roomId: input.roomId,
    roomSecret:
      input.scope === "direct"
        ? input.roomSecret
        : undefined,
    onchainSecret: toFelt(onchainSecret),
    label: input.label,
    inviterAddress: account.address,
    groupId:
      input.scope === "group"
        ? input.groupId
        : undefined,
    groupName:
      input.scope === "group"
        ? input.groupName
        : undefined,
    groupSecret:
      input.scope === "group"
        ? input.groupSecret
        : undefined,
    groupOwnerAddress:
      input.scope === "group"
        ? input.groupOwnerAddress
        : undefined,
    expiresAt,
  };

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM" },
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
        additionalData: getInviteAad(INVITE_AAD_TEXT),
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

  const invite: EncryptedInviteToken = {
    token: bytesToBase64Url(packed),
    key: bytesToBase64Url(keyBytes),
    scope: input.scope,
    expiresAt,
    commitment: toFelt(commitment),
  };

  if (onPrepared) {
    await onPrepared(invite);
  }

  try {
    // CREATE = [0, commitment, expires_at]
    await invokeInvite(
      account,
      [0, commitment, expiresAtSeconds],
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : String(err);

    const isAmbiguousTimeout =
      /timeout|timed out/i.test(message);

    if (!isAmbiguousTimeout) {
      throw err;
    }

    console.warn(
      "[VINSS INVITE] Ready callback timed out; checking on-chain state",
      err,
    );

    const exists =
      await waitForInviteOnchain(commitment);

    if (!exists) {
      throw err;
    }

    console.info(
      "[VINSS INVITE] recovered successful create from get_invite",
      toFelt(commitment),
    );
  }

  return invite;
}

async function decryptPackedInvite(
  token: string,
  encodedKey: string,
  aadText: string,
): Promise<unknown> {
  const packed = base64UrlToBytes(token);
  const keyBytes = base64UrlToBytes(encodedKey);

  if (packed.length <= 12 || keyBytes.length !== 32) {
    throw new Error("INVALID_INVITE_BYTES");
  }

  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: getInviteAad(aadText),
    },
    key,
    toArrayBuffer(ciphertext),
  );

  return JSON.parse(
    new TextDecoder().decode(plaintext),
  );
}

function isValidCommonInvite(
  payload: {
    inviteId?: unknown;
    roomId?: unknown;
    onchainSecret?: unknown;
    label?: unknown;
    expiresAt?: unknown;
  },
): boolean {
  return Boolean(
    typeof payload.inviteId === "string" &&
      payload.inviteId &&
      typeof payload.roomId === "string" &&
      payload.roomId &&
      typeof payload.onchainSecret === "string" &&
      payload.onchainSecret &&
      typeof payload.label === "string" &&
      typeof payload.expiresAt === "string",
  );
}

function isUsableExpiry(expiresAt: string): boolean {
  const value = Date.parse(expiresAt);

  return Number.isFinite(value) && value > Date.now();
}

export async function decodeInviteToken(
  token: string,
  encodedKey: string,
): Promise<InvitePayload | null> {
  try {
    const raw = await decryptPackedInvite(
      token,
      encodedKey,
      INVITE_AAD_TEXT,
    );

    const payload = raw as Partial<InvitePayload>;

    if (
      payload.v !== INVITE_VERSION ||
      (payload.scope !== "direct" &&
        payload.scope !== "group") ||
      !isValidCommonInvite(payload) ||
      !isUsableExpiry(payload.expiresAt!)
    ) {
      return null;
    }

    if (
      payload.scope === "direct" &&
      (typeof payload.roomSecret !== "string" ||
        !payload.roomSecret)
    ) {
      return null;
    }

    if (
      payload.scope === "group"
    ) {
      const hasBoundGroup =
        typeof payload.groupId === "string" &&
        Boolean(payload.groupId) &&
        typeof payload.groupName === "string" &&
        Boolean(payload.groupName) &&
        typeof payload.groupSecret === "string" &&
        Boolean(payload.groupSecret) &&
        typeof payload.groupOwnerAddress === "string" &&
        Boolean(payload.groupOwnerAddress);

      const isLegacyRoomWideGroup =
        typeof payload.roomSecret === "string" &&
        Boolean(payload.roomSecret);

      if (
        !hasBoundGroup &&
        !isLegacyRoomWideGroup
      ) {
        return null;
      }
    }

    return payload as InvitePayload;
  } catch {
    // Existing V2 links remain consumable during the migration.
  }

  try {
    const raw = await decryptPackedInvite(
      token,
      encodedKey,
      LEGACY_INVITE_AAD_TEXT,
    );

    const legacy =
      raw as Partial<LegacyInvitePayload>;

    if (
      legacy.v !== LEGACY_INVITE_VERSION ||
      !isValidCommonInvite(legacy) ||
      typeof legacy.roomSecret !== "string" ||
      !legacy.roomSecret ||
      !isUsableExpiry(legacy.expiresAt!)
    ) {
      return null;
    }

    // V2 represented the old one-counterparty flow, so normalize it to Chat.
    return {
      v: INVITE_VERSION,
      inviteId: legacy.inviteId!,
      scope: "direct",
      roomId: legacy.roomId!,
      roomSecret: legacy.roomSecret!,
      onchainSecret: legacy.onchainSecret!,
      label: legacy.label!,
      expiresAt: legacy.expiresAt!,
    };
  } catch {
    return null;
  }
}

export interface InviteOnchainState {
  expiresAt: number;
  consumed: boolean;
  exists: boolean;
}

export async function getInviteOnchainState(
  commitment: string | bigint,
): Promise<InviteOnchainState> {
  if (!CONTRACTS.invite) {
    throw new Error(
      "NEXT_PUBLIC_INVITE_ADDRESS is not configured.",
    );
  }

  const result = await inviteReadProvider.callContract({
    contractAddress: CONTRACTS.invite,
    entrypoint: "get_invite",
    calldata: [toFelt(commitment)],
  });

  // InviteEntry = [expires_at, consumed, exists]
  return {
    expiresAt: Number(BigInt(result[0] ?? "0")),
    consumed: BigInt(result[1] ?? "0") !== 0n,
    exists: BigInt(result[2] ?? "0") !== 0n,
  };
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
    [1, onchainSecret],
  );

  return {
    transactionHash: response.transaction_hash,
  };
}
