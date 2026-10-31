"use client";

import { readDeviceCache, writeDeviceCache } from "@/lib/privacy/deviceCache";
import {
  canonicalStarknetAddress,
} from "@/lib/privacy/participantKeys";
import type {
  SettlementRole,
} from "@/lib/deal-room/settlement";
import type {
  EscrowActionPayload,
} from "@/types/deal-room";

export interface StoredRekberSecrets {
  version: 2;
  custodyCommitment: string;
  role: SettlementRole;

  // Signed Rekber coordination waiting for the second Ready X step.
  // Stored inside the same encrypted Rekber local storage so a
  // mobile wallet/page remount does not require another signature.
  pendingCoordinationPayload?: EscrowActionPayload;

  releaseAuthorizationSecret?: string;
  payeeClaimSecret?: string;
  refundSecret?: string;

  payerConfirmationSecret?: string;
  payerDisputeSecret?: string;
  revisionChainSecrets?: string[];

  payeeDisputeSecret?: string;
  payeeRefundConsentSecret?: string;
  fulfillmentChainSecrets?: string[];

  certificateSecret: string;
  savedAt: string;
}

function storageKey(
  roomId: string,
  walletAddress: string,
  custodyCommitment: bigint,
): string {
  return [
    "vinss:rekber-secrets:v2",
    roomId,
    canonicalStarknetAddress(
      walletAddress,
    ),
    custodyCommitment.toString(16),
  ].join(":");
}

function cacheOptions(roomId: string, walletAddress: string, custody: bigint, legacyKey: Uint8Array) {
  const legacyStorageKey = storageKey(roomId, walletAddress, custody);
  return {
    storageKey: legacyStorageKey.replace(":v2:", ":v3:"), legacyStorageKey,
    walletAddress, context: legacyStorageKey, legacyKey,
    validate(value: unknown): StoredRekberSecrets {
      const data = value as StoredRekberSecrets;
      if (!data || data.version !== 2 || BigInt(data.custodyCommitment) !== custody ||
          !["payer", "payee"].includes(data.role) || !data.certificateSecret || typeof data.savedAt !== "string") {
        throw new Error("Invalid Escrow Rekber recovery data.");
      }
      return data;
    },
    mergeLegacy(current: StoredRekberSecrets, legacy: StoredRekberSecrets) {
      assertSameCapabilities(current, legacy);
      return Date.parse(legacy.savedAt) > Date.parse(current.savedAt) ? legacy : current;
    },
  };
}
function assertSameCapabilities(current: StoredRekberSecrets, next: StoredRekberSecrets): void {
  for (const name of ["role", "releaseAuthorizationSecret", "payeeClaimSecret", "refundSecret", "payerConfirmationSecret", "payerDisputeSecret", "revisionChainSecrets", "payeeDisputeSecret", "payeeRefundConsentSecret", "fulfillmentChainSecrets", "certificateSecret"] as const) {
    if (JSON.stringify(current[name]) !== JSON.stringify(next[name])) throw new Error("Escrow Rekber recovery capabilities cannot be replaced.");
  }
}
export async function saveRekberSecrets(roomId: string, walletAddress: string, custody: bigint, channelKey: Uint8Array, secrets: StoredRekberSecrets): Promise<void> {
  await writeDeviceCache(cacheOptions(roomId, walletAddress, custody, channelKey), previous => {
    if (previous) assertSameCapabilities(previous, secrets);
    return secrets;
  });
}
export async function loadRekberSecrets(roomId: string, walletAddress: string, custody: bigint, channelKey: Uint8Array): Promise<StoredRekberSecrets | null> {
  return readDeviceCache(cacheOptions(roomId, walletAddress, custody, channelKey));
}
