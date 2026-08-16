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

import { CairoCustomEnum, hash, type WalletAccountV6 } from "starknet";
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

  const actionLocator = generateActionLocator(channelKey);
  const ciphertextChunks = await encryptPayload(channelKey, payload);
  const payloadCommitment = commitPayload(
    MESSAGE_COMMITMENT_DOMAIN,
    ENVELOPE_VERSION,
    actionLocator,
    ciphertextChunks.length,
    ciphertextChunks,
  );

  // NOTE: no selector here. Confirmed against the real STRK20 Wallet API
  // docs (strk20-by-example.org/starknet-wallet-api/private-defi): the
  // wallet always calls the helper's `privacy_invoke` itself via the
  // protocol's own INVOKE_SELECTOR — `calldata` is deserialized directly
  // into that function's own parameters. Prepending
  // hash.getSelectorFromName("privacy_invoke") (as this used to do) shifts
  // every argument by one slot and is the actual cause of
  // INVALID_REQUEST_PAYLOAD.
  const calldata = [
    hash.getSelectorFromName("privacy_invoke"),
    ENVELOPE_VERSION,
    actionLocator,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);

  // VinssChannelHelper.privacy_invoke (see store_message in
  // vinss_channel_helper.cairo) always returns an empty
  // Span<OpenNoteDeposit> — "Messaging does not request an ERC-20 deposit
  // into an open note." Per strk20-by-example.org/starknet-wallet-api/
  // private-defi ("The two actions") and .../helpers/privacy-invoke, a
  // `transfer` with amount "OPEN" only makes sense when the invoke's
  // calldata references the resulting slot via an
  // `${openNoteIds[N]}` placeholder so the wallet knows what to credit
  // into it. This calldata never contains that placeholder — there is
  // nothing for an open note to receive — so pairing an unreferenced
  // transfer:OPEN action with this invoke is itself the malformed
  // request (that combination is what produced INVALID_REQUEST_PAYLOAD).
  // A single `invoke` action, with no funds movement at all, matches the
  // escrow helper's own zero-token-movement pattern in the docs.
  const debugActions = [
    {
      type: "invoke" as const,
      contract: CONTRACTS.channelHelper,
      calldata,
    },
  ];

  let response;
  try {
    response = await account.strk20InvokeTransaction(debugActions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // The wallet extension's Error often carries extra fields (code, data,
    // a nested `cause`, etc.) that aren't part of `.message`. Pull those
    // out explicitly — generic "(UNKNOWN_ERROR)" messages are useless
    // without them.
    const extra: Record<string, unknown> = {};
    if (err && typeof err === "object") {
      for (const key of Object.getOwnPropertyNames(err)) {
        if (key === "message" || key === "stack") continue;
        extra[key] = (err as Record<string, unknown>)[key];
      }
    }

    console.error("[vinss-sdk] strk20InvokeTransaction failed", {
      message: msg,
      ...extra,
      debugActions,
    });

    throw new Error(
      `${msg}` +
        (Object.keys(extra).length
          ? ` | WALLET_ERROR_DETAIL=${JSON.stringify(extra)}`
          : "") +
        ` | DEBUG_PAYLOAD=${JSON.stringify(debugActions)}`,
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
