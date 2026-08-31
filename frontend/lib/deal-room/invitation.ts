import { hash, RpcProvider, type WalletAccountV6 } from "starknet";
import { CONTRACTS, RPC_URL } from "../starknet/constants";
import {
  shortStringToFelt,
  toFelt,
} from "@/lib/privacy/envelope";
import {
  quoteRoomActivationFee,
} from "@/lib/starknet/feePolicy";

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
  quotedFee?: bigint,
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

  // CREATE returns one revenue OpenNoteDeposit and therefore needs the
  // authoritative room-activation quote plus the wallet-generated open note.
  if (quotedFee !== undefined) {
    return account.strk20InvokeTransaction([
      {
        type: "withdraw" as const,
        token: CONTRACTS.messageHelperOpenNoteToken,
        amount: toFelt(quotedFee),
        recipient: CONTRACTS.invite,
      },
      {
        type: "transfer" as const,
        token: CONTRACTS.messageHelperOpenNoteToken,
        amount: "OPEN" as const,
        recipient: treasuryAddress,
      },
      {
        type: "invoke" as const,
        contract: CONTRACTS.invite,
        calldata: [
          toFelt(calldata.length + 2),
          ...calldata,
          toFelt(quotedFee),
          "${openNoteIds[0]}",
        ],
      },
    ]);
  }

  // CONSUME has no service-fee output. It still consumes a negligible private
  // note so the containing STRK20 transaction has pool-level replay protection.
  return account.strk20InvokeTransaction([
    {
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
  ]);
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
    const quotedFee =
      await quoteRoomActivationFee();

    // CREATE = [0, commitment, expires_at, quoted_fee, open_note_id].
    await invokeInvite(
      account,
      [0, commitment, expiresAtSeconds],
      quotedFee,
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

function sameStarknetAddress(
  left: string,
  right: string,
): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

async function getTransactionSender(
  transactionHash: string,
): Promise<string | null> {
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: transactionHash,
        method: "starknet_getTransactionByHash",
        params: [transactionHash],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      result?: {
        sender_address?: string;
      };
    };

    return payload.result?.sender_address ?? null;
  } catch {
    return null;
  }
}

async function recoverConsumedInviteForWallet(
  walletAddress: string,
  onchainSecret: string,
): Promise<{ transactionHash: string } | null> {
  const commitment =
    computeInviteCommitment(onchainSecret);

  const state =
    await getInviteOnchainState(commitment);

  if (!state.exists || !state.consumed) {
    return null;
  }

  const selector =
    hash.getSelectorFromName("InviteConsumed");

  const latest =
    await inviteReadProvider.getBlockNumber();

  let toBlock = latest;

  // Use the same raw JSON-RPC event path as LiveTxFeed.
  // LOG TX already proves this path can see InviteConsumed in production.
  for (
    let windowIndex = 0;
    windowIndex < 8 && toBlock >= 0;
    windowIndex++
  ) {
    const fromBlock =
      Math.max(0, toBlock - 4_999);

    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `invite-recovery:${fromBlock}:${toBlock}`,
        method: "starknet_getEvents",
        params: [
          {
            from_block: {
              block_number: fromBlock,
            },
            to_block: {
              block_number: toBlock,
            },
            address: CONTRACTS.invite,
            keys: [
              [selector],
              [toFelt(commitment)],
            ],
            chunk_size: 20,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Invite recovery RPC failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      result?: {
        events?: Array<{
          transaction_hash?: string;
        }>;
      };
      error?: unknown;
    };

    if (payload.error) {
      throw new Error(
        "Invite recovery RPC returned an error.",
      );
    }

    for (const event of payload.result?.events ?? []) {
      const transactionHash =
        event.transaction_hash;

      if (!transactionHash) {
        continue;
      }

      const sender =
        await getTransactionSender(
          transactionHash,
        );

      if (
        sender &&
        sameStarknetAddress(
          sender,
          walletAddress,
        )
      ) {
        return {
          transactionHash:
            toFelt(transactionHash),
        };
      }
    }

    if (fromBlock === 0) {
      break;
    }

    toBlock = fromBlock - 1;
  }

  return null;
}

async function waitForConsumedInviteRecovery(
  walletAddress: string,
  onchainSecret: string,
  attempts = 8,
): Promise<{ transactionHash: string } | null> {
  for (
    let attempt = 0;
    attempt < attempts;
    attempt++
  ) {
    try {
      const recovered =
        await recoverConsumedInviteForWallet(
          walletAddress,
          onchainSecret,
        );

      if (recovered) {
        return recovered;
      }
    } catch {
      // RPC state may lag immediately after the wallet returns.
    }

    if (attempt + 1 < attempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1_500),
      );
    }
  }

  return null;
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

  const alreadyConsumed =
    await recoverConsumedInviteForWallet(
      account.address,
      onchainSecret,
    );

  if (alreadyConsumed) {
    return alreadyConsumed;
  }

  const invokePromise =
    invokeInvite(
      account,
      [1, onchainSecret],
    );

  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  try {
    const response =
      await Promise.race([
        invokePromise,
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(
                new Error(
                  "VINSS_INVITE_CONSUME_TIMEOUT",
                ),
              ),
            12_000,
          );
        }),
      ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return {
      transactionHash:
        response.transaction_hash,
    };
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const recovered =
      await waitForConsumedInviteRecovery(
        account.address,
        onchainSecret,
      );

    if (recovered) {
      console.info(
        "[VINSS INVITE] recovered successful consume",
        recovered.transactionHash,
      );

      return recovered;
    }

    throw error;
  }
}
