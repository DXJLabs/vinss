"use client";

import type { WalletAccountV6 } from "starknet";
import { discoverMessages, sendMessage } from "@/lib/deal-room/messaging";
import { canonicalStarknetAddress } from "@/lib/privacy/participantKeys";
import type { MessageRoute } from "@/lib/privacy/messageRouting";
import type { MessagePayload, MessageScope, SendActionResult } from "@/types/deal-room";
import {
  frameStarknetMlsPacket, MLS_WIRE_PREFIX,
  reassembleStarknetMlsFrames,
  type StarknetMlsPacketKind,
  type StarknetMlsFrameSummary,
} from "./starknet-framing";

/**
 * Every MLS frame goes through VINSS's existing encrypted Cairo MessageHelper.
 * No plaintext MLS application payloads or off-chain ciphertext relay.
 *
 * This is a low-level transport. It does NOT handle wallet-authenticated
 * KeyPackage registration, MLS epoch changes or UI enablement yet.
 * A Starknet signer is required for each fragment on the current interface.
 */
export interface StarknetMlsOnchainContext {
  account: WalletAccountV6;
  network: string;
  roomId: string;
  groupId?: string;
  scope: MessageScope;
  encryptionKey: Uint8Array;
  /** Legacy transport identity, used only to validate opaque routing tags. */
  messagingPublicKey: string;
  outboundRoute?: MessageRoute;
  inboundRoutes?: MessageRoute[];
  backendUrl: string;
}

export interface StarknetMlsSendOptions {
  kind: StarknetMlsPacketKind;
  ciphertext: Uint8Array;
  /** Mandatory for packets needing more than one on-chain transaction. */
  confirmMultipleTransactions?: (count: number, kind: StarknetMlsPacketKind) => Promise<boolean>;
}

export async function sendStarknetMlsOnchain(
  ctx: StarknetMlsOnchainContext,
  options: StarknetMlsSendOptions,
): Promise<SendActionResult[]> {
  if (!ctx.account || !ctx.encryptionKey || ctx.encryptionKey.length !== 32) {
    throw new Error("A wallet and 32-byte encrypted transport key are required");
  }
  if (ctx.scope === "group" && !ctx.groupId) {
    throw new Error("Group MLS ciphertext requires a selected group");
  }
  if (ctx.scope === "direct" && !ctx.outboundRoute?.recipientIdentity) {
    throw new Error("Direct MLS ciphertext requires the recipient's private route");
  }
  const sender = canonicalStarknetAddress(ctx.account.address);
  const frames = await frameStarknetMlsPacket({
    kind: options.kind,
    bytes: options.ciphertext,
    network: ctx.network,
    roomId: ctx.roomId,
    sender,
  });
  if (frames.length > 1 && !(await options.confirmMultipleTransactions?.(frames.length, options.kind))) {
    throw new Error(
      \`MLS packet needs \${frames.length} on-chain transactions. Explicit approval required.\`,
    );
  }
  const results: SendActionResult[] = [];
  for (const body of frames) {
    const payload: MessagePayload = {
      kind: "system_note",
      scope: ctx.scope,
      body,
      ...(ctx.scope === "group" ? { groupId: ctx.groupId } : {}),
      ...(ctx.scope === "direct" ? { recipientAddress: ctx.outboundRoute!.recipientIdentity } : {}),
      senderIdentity: {
        address: ctx.account.address,
        messagingPublicKey: ctx.messagingPublicKey,
      },
      sentAt: new Date().toISOString(),
    };
    // Individual fragment transaction hashes are retained for troubleshooting.
    // If any transaction fails, never mark this logical MLS packet as delivered.
    results.push(await sendMessage(ctx.account, ctx.encryptionKey, payload, ctx.outboundRoute));
  }
  return results;
}

export async function readStarknetMlsOnchain(
  ctx: StarknetMlsOnchainContext,
): Promise<StarknetMlsFrameSummary> {
  if (ctx.scope === "direct" && !ctx.inboundRoutes?.length) {
    throw new Error("Direct MLS sync requires explicit inbound routing identities");
  }
  const messages = await discoverMessages(
    ctx.backendUrl,
    ctx.encryptionKey,
    ctx.scope === "direct" ? ctx.inboundRoutes! : undefined,
  );
  const frames = messages.filter((record) =>
    record.message.kind === "system_note" &&
    record.message.scope === ctx.scope &&
    (ctx.scope !== "group" || record.message.groupId === ctx.groupId) &&
    record.message.body.startsWith(MLS_WIRE_PREFIX) &&
    !!record.message.senderIdentity?.address &&
    !!record.message.senderIdentity?.messagingPublicKey
  );
  const validated = await reassembleStarknetMlsFrames(
    frames.map((record) => record.message.body),
    { network: ctx.network, roomId: ctx.roomId },
  );
  // Sender installation/KeyPackage must still be verified by an authenticated
  // registry before handing these complete packets to the OpenMLS provider.
  return validated;
}
