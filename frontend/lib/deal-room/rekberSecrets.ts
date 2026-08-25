"use client";

import {
  loadEncryptedLocalJson,
  saveEncryptedLocalJson,
} from "@/lib/privacy/encryptedChatCache";
import {
  canonicalStarknetAddress,
} from "@/lib/privacy/participantKeys";
import type {
  SettlementRole,
} from "@/lib/deal-room/settlement";

export interface StoredRekberSecrets {
  version: 2;
  custodyCommitment: string;
  role: SettlementRole;
  releaseAuthorizationSecret?: string;
  payeeClaimSecret?: string;
  refundSecret?: string;
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

export async function saveRekberSecrets(
  roomId: string,
  walletAddress: string,
  custodyCommitment: bigint,
  channelKey: Uint8Array,
  secrets: StoredRekberSecrets,
): Promise<void> {
  await saveEncryptedLocalJson(
    storageKey(
      roomId,
      walletAddress,
      custodyCommitment,
    ),
    channelKey,
    secrets,
  );
}

export async function loadRekberSecrets(
  roomId: string,
  walletAddress: string,
  custodyCommitment: bigint,
  channelKey: Uint8Array,
): Promise<StoredRekberSecrets | null> {
  return loadEncryptedLocalJson<StoredRekberSecrets>(
    storageKey(
      roomId,
      walletAddress,
      custodyCommitment,
    ),
    channelKey,
  );
}

