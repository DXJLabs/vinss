/**
 * Messaging SDK — matches contracts/messaging/messaging_interfaces.cairo and
 * messaging_types.cairo exactly:
 *
 *   privacy_invoke(calldata) with calldata =
 *     [envelope_version, message_locator, payload_commitment,
 *      payload_chunk_count, ...ciphertext_chunks, open_note_id]
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
  toFelt,
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
  if (!CONTRACTS.channelHelperOpenNoteToken) {
    throw new Error(
      "NEXT_PUBLIC_CHANNEL_HELPER_OPEN_NOTE_TOKEN is not set — see .env.local.example.",
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

  // No selector prepended — the STRK20 Wallet API calls the helper's
  // `privacy_invoke` itself; `calldata` is deserialized directly into that
  // function's own parameters (confirmed against starknet-js's
  // WalletAccountV6 docs, "The invoke helper").
  //
  // VinssMessageHelper.privacy_invoke now follows the invoke-helper
  // convention: the LAST felt is always the id of the open note to fill
  // (`${openNoteIds[0]}`, substituted by the wallet), everything before it
  // is the message envelope. The contract returns a single OpenNoteDeposit
  // with amount 0 against `channelHelperOpenNoteToken` — no real value
  // is used as the VINSS messaging revenue token for the treasury OPEN note.
  const calldata = [
    ENVELOPE_VERSION,
    actionLocator,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);


  const treasuryAddress =
    process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!treasuryAddress) {
    throw new Error(
      "NEXT_PUBLIC_VINSS_TREASURY_ADDRESS is not configured",
    );
  }

  const debugActions = [
    {
      type: "withdraw" as const,
      token: CONTRACTS.channelHelperOpenNoteToken,
      amount: "0x6f05b59d3b20000", // 0.5 STRK
      recipient: CONTRACTS.channelHelper,
    },
    {
      type: "transfer" as const,
      token: CONTRACTS.channelHelperOpenNoteToken,
      amount: "OPEN" as const,
      recipient: treasuryAddress,
    },
    {
      type: "invoke" as const,
      contract: CONTRACTS.channelHelper,
      calldata: [
        toFelt(calldata.length + 1),
        ...calldata,
        "${openNoteIds[0]}",
      ],
    },
  ];

  let response;
  try {
    response = await account.strk20InvokeTransaction(debugActions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const extra: Record<string, unknown> = {};
    if (err && typeof err === "object") {
      for (const key of Object.getOwnPropertyNames(err)) {
        if (key === "message" || key === "stack") continue;
        extra[key] = (err as Record<string, unknown>)[key];
      }
    }

    const rawError = JSON.stringify(
      err,
      (_key, value) => {
        if (typeof value === "bigint") return value.toString();

        if (value instanceof Error) {
          return Object.fromEntries(
            Object.getOwnPropertyNames(value).map((key) => [
              key,
              (value as unknown as Record<string, unknown>)[key],
            ]),
          );
        }

        return value;
      },
      2,
    );

    console.error("[vinss-sdk] strk20InvokeTransaction failed", {
      message: msg,
      ...extra,
      rawError,
      debugActions,
    });

    throw new Error(
      `${msg}` +
        (Object.keys(extra).length
          ? ` | WALLET_ERROR_DETAIL=${JSON.stringify(extra)}`
          : "") +
        ` | DEBUG_PAYLOAD=${JSON.stringify(debugActions)}` +
        ` | RAW_ERROR=${rawError}`,
    );
  }

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
