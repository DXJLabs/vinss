/**
 * Messaging SDK — matches contracts/messaging/messaging_interfaces.cairo and
 * messaging_types.cairo exactly:
 *
 *   privacy_invoke(calldata) with calldata =
 *     [envelope_version, message_locator, payload_commitment,
 *      payload_chunk_count, ...ciphertext_chunks]
 *
 * The record intentionally carries no sender, recipient, reusable
 * conversation id, or plaintext kind/content — see messaging_types.cairo's
 * own docstring. Do not add a channel-id field here; that would be a
 * contract change (Opsi B), out of scope for this app-code-only plan.
 */

import { CairoCustomEnum, type WalletAccountV6 } from "starknet";
import { CONTRACTS } from "../starknet/constants";
import {
  commitPayload,
  encryptPayload,
  decryptPayload,
  generateActionLocator,
  ENVELOPE_VERSION,
  type ChannelKey,
} from "./envelope";
import type { MessagePayload, SendActionResult } from "./types";

const MESSAGE_COMMITMENT_DOMAIN = "VINSS_MSG_COMMIT_V1"; // must match
// contracts/utils/constants.cairo::VINSS_MESSAGE_COMMITMENT_DOMAIN.

export async function sendMessage(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: MessagePayload,
): Promise<SendActionResult> {
  if (!CONTRACTS.channelHelper) {
    throw new Error(
      "NEXT_PUBLIC_CHANNEL_HELPER_ADDRESS is not set — see .env.local.example.",
    );
  }

  const actionLocator = generateActionLocator(channelKey);
  const ciphertextChunks = await encryptPayload(channelKey, payload);
  const payloadCommitment = commitPayload(
    MESSAGE_COMMITMENT_DOMAIN,
    ENVELOPE_VERSION,
    actionLocator,
    ciphertextChunks.length,
    ciphertextChunks,
  );

  const calldata = [
    ENVELOPE_VERSION,
    actionLocator,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(String);

  // The dapp does not call privacy_invoke on the helper directly — that
  // entrypoint is restricted to the pinned Privacy Pool. Instead the dapp
  // asks the wallet to route this InvokeExternal call through the pool via
  // the Wallet API, exactly like a shield/transfer/unshield action.
  // Confirm the exact wallet-facing method name against the current
  // WalletAccount guide before relying on `execute` here — this is a
  // best-known placeholder for the STRK20 InvokeExternal action shape.
  const response = await (
    account as unknown as {
      strk20InvokeTransaction: (
        actions: Array<{
          contractAddress: string;
          entrypoint: string;
          calldata: string[];
        }>,
      ) => Promise<{ transaction_hash: string }>;
    }
  ).strk20InvokeTransaction([
    {
      contractAddress: CONTRACTS.channelHelper,
      entrypoint: "privacy_invoke",
      calldata,
    },
  ]);

  return {
    transactionHash: response.transaction_hash,
    actionLocator,
    payloadCommitment,
  };
}

/**
 * Discover encrypted message records. The backend only returns ciphertext.
 * The channel key never crosses the network.
 */
export async function discoverMessages(
  backendUrl: string,
  channelKey: ChannelKey,
): Promise<Array<{
  actionLocator: string;
  payloadCommitment: string;
  message: MessagePayload;
  blockNumber: number;
  transactionHash: string;
}>> {
  const res = await fetch(`${backendUrl}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "message" }),
  });
  if (!res.ok) throw new Error(`Discovery failed: ${res.status} ${await res.text()}`);

  const records = (await res.json()) as Array<{
    actionLocator: string;
    payloadCommitment: string;
    ciphertextChunks: string[];
    blockNumber: number;
    transactionHash: string;
  }>;

  const decrypted = [];
  for (const record of records) {
    try {
      const message = (await decryptPayload(
        channelKey,
        record.ciphertextChunks.map(BigInt),
      )) as MessagePayload;
      decrypted.push({
        actionLocator: record.actionLocator,
        payloadCommitment: record.payloadCommitment,
        message,
        blockNumber: record.blockNumber,
        transactionHash: record.transactionHash,
      });
    } catch {
      // Unrelated channel / invalid ciphertext: discard locally.
    }
  }
  return decrypted;
}

// Re-exported so callers don't need to know CairoCustomEnum lives here —
// placeholder for future action-kind enums shared with offer/escrow SDKs.
export type { CairoCustomEnum };
