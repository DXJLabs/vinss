/**
 * Messaging domain module — matches contracts/messaging/messaging_interfaces.cairo and
 * messaging_types.cairo exactly:
 *
 *   privacy_invoke(calldata) with calldata =
 *     [envelope_version, message_locator, sender_tag, recipient_tag,
 *      payload_commitment, payload_chunk_count,
 *      ...ciphertext_chunks, quoted_fee, open_note_id]
 *
 * The record intentionally carries no sender, recipient, reusable
 * conversation id, or plaintext kind/content — see messaging_types.cairo's
 * own docstring. Do not add a channel-id field here; that would be a
 * contract change (Opsi B), out of scope for this app-code-only plan.
 */

import { CairoCustomEnum, type WalletAccountV6 } from "starknet";
import { CONTRACTS } from "../starknet/constants";
import {
  encryptPayload,
  decryptPayload,
  generateActionLocator,
  toFelt,
  type ChannelKey,
} from "@/lib/privacy/envelope";
import {
  GROUP_RECIPIENT_IDENTITY,
  MESSAGE_ENVELOPE_VERSION,
  commitMessagePayloadV2,
  deriveMessageRoutingTag,
  type MessageRoute,
} from "@/lib/privacy/messageRouting";
import type { MessagePayload, SendActionResult } from "@/types/deal-room";
import { quoteMessageFee } from "@/lib/starknet/feePolicy";

export interface PreparedMessageSend {
  actionLocator: bigint;
  payloadCommitment: bigint;
}

export interface AdditionalPrivacyInvoke {
  contract: string;
  calldata: string[];
}

export type AdditionalPrivacyInvokeBuilder = (
  prepared: PreparedMessageSend,
) =>
  | AdditionalPrivacyInvoke[]
  | Promise<AdditionalPrivacyInvoke[]>;

export async function sendMessage(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: MessagePayload,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedMessageSend,
  ) => void | Promise<void>,
  buildAdditionalInvokes?:
    AdditionalPrivacyInvokeBuilder,
): Promise<SendActionResult> {
  if (!CONTRACTS.messageHelper) {
    throw new Error(
      "NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS is not set — see .env.local.example.",
    );
  }
  if (!CONTRACTS.messageHelperOpenNoteToken) {
    throw new Error(
      "NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN is not set — see .env.local.example.",
    );
  }

  const encryptionKey = route?.encryptionKey ?? channelKey;
  const routingKey = route?.routingKey ?? encryptionKey;
  const recipientIdentity =
    route?.recipientIdentity ?? GROUP_RECIPIENT_IDENTITY;

  const actionLocator = generateActionLocator(encryptionKey);

  const [senderTag, recipientTag] = await Promise.all([
    deriveMessageRoutingTag(
      routingKey,
      "sender",
      account.address,
      actionLocator,
    ),
    deriveMessageRoutingTag(
      routingKey,
      "recipient",
      recipientIdentity,
      actionLocator,
    ),
  ]);

  const ciphertextChunks = await encryptPayload(
    encryptionKey,
    payload,
  );

  const payloadCommitment = commitMessagePayloadV2(
    actionLocator,
    senderTag,
    recipientTag,
    ciphertextChunks,
  );

  const additionalInvokes =
    buildAdditionalInvokes
      ? await buildAdditionalInvokes({
          actionLocator,
          payloadCommitment,
        })
      : [];

  // No selector prepended — the STRK20 Wallet API calls the helper's
  // `privacy_invoke` itself; `calldata` is deserialized directly into that
  // function's own parameters (confirmed against starknet-js's
  // WalletAccountV6 docs, "The invoke helper").
  //
  // VinssMessageHelper.privacy_invoke now follows the invoke-helper
  // convention: the LAST felt is always the id of the open note to fill
  // (`${openNoteIds[0]}`, substituted by the wallet), everything before it
  // is the message envelope. The contract returns a single OpenNoteDeposit
  // with the current FeePolicy-quoted STRK revenue against
  // `messageHelperOpenNoteToken` for the treasury OPEN note.
  const calldata = [
    MESSAGE_ENVELOPE_VERSION,
    actionLocator,
    senderTag,
    recipientTag,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);


  // Fetch the authoritative minimum immediately before Ready X builds
  // the private transaction. The helper accepts this quote (or a higher one)
  // and validates it against its immutable FeePolicy reference.
  const quotedFee = await quoteMessageFee();

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
      token: CONTRACTS.messageHelperOpenNoteToken,
      amount: toFelt(quotedFee),
      recipient: CONTRACTS.messageHelper,
    },
    {
      type: "transfer" as const,
      token: CONTRACTS.messageHelperOpenNoteToken,
      amount: "OPEN" as const,
      recipient: treasuryAddress,
    },
    {
      type: "invoke" as const,
      contract: CONTRACTS.messageHelper,
      calldata: [
        toFelt(calldata.length + 2),
        ...calldata,
        toFelt(quotedFee),
        "${openNoteIds[0]}",
      ],
    },
    ...additionalInvokes.map(
      (invoke) => ({
        type: "invoke" as const,
        contract: invoke.contract,
        calldata: [
          toFelt(invoke.calldata.length),
          ...invoke.calldata,
        ],
      }),
    ),
  ];

  /*
   * Mark recovery state only after every preflight step succeeds.
   * Otherwise a FeePolicy/config failure can create a ghost pending
   * message even though Ready X was never invoked.
   */
  if (onPrepared) {
    await onPrepared({
      actionLocator,
      payloadCommitment,
    });
  }

  let response;
  try {
    response = await account.strk20InvokeTransaction(debugActions);
  } catch (err) {
    // Wallet errors may contain raw ciphertext, calldata or secret metadata.
    // Classify without serializing, rethrowing or printing the raw exception.
    const description = err instanceof Error ? err.message : "";
    const declined = /reject|declin|cancel|denied/i.test(description);
    console.warn("[VINSS MESSAGING] wallet callback uncertain", {
      category: declined ? "WALLET_DECLINED" : "WALLET_OUTCOME_UNKNOWN",
    });
    throw new Error(
      declined
        ? "Wallet declined the message request. Check message recovery before retrying."
        : "Wallet message outcome is unknown. Check message recovery before retrying.",
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
  route?: MessageRoute | MessageRoute[],
): Promise<Array<{
  actionLocator: string;
  payloadCommitment: string;
  senderTag: string;
  recipientTag: string;
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
    senderTag?: string;
    recipientTag?: string;
    ciphertextChunks: string[];
    blockNumber: number;
    transactionHash: string;
  }>;

  const candidateRoutes: MessageRoute[] =
    route == null
      ? [
          {
            recipientIdentity: GROUP_RECIPIENT_IDENTITY,
            encryptionKey: channelKey,
            routingKey: channelKey,
          },
        ]
      : Array.isArray(route)
        ? route
        : [route];

  const decrypted = [];


  for (const record of records) {
    if (!record.senderTag || !record.recipientTag) {
      console.warn("[VINSS MSG SKIP missing-tags]", record.actionLocator);
      continue;
    }

    const actionLocator = BigInt(record.actionLocator);

    let routeIndex = 0;

    for (const candidate of candidateRoutes) {
      try {
        const encryptionKey =
          candidate.encryptionKey ?? channelKey;

        const routingKey =
          candidate.routingKey ?? encryptionKey;

        const expectedRecipientTag =
          await deriveMessageRoutingTag(
            routingKey,
            "recipient",
            candidate.recipientIdentity,
            actionLocator,
          );

        if (BigInt(record.recipientTag) !== expectedRecipientTag) {

          routeIndex++;
          continue;
        }


        const message = (await decryptPayload(
          encryptionKey,
          record.ciphertextChunks.map(BigInt),
        )) as MessagePayload;

        // Bind the encrypted sender identity back to the public opaque tag.
        if (message.senderIdentity?.address) {
          const expectedSenderTag =
            await deriveMessageRoutingTag(
              routingKey,
              "sender",
              message.senderIdentity.address,
              actionLocator,
            );

          if (BigInt(record.senderTag) !== expectedSenderTag) {
            continue;
          }
        }

        decrypted.push({
          actionLocator: record.actionLocator,
          payloadCommitment: record.payloadCommitment,
          senderTag: record.senderTag,
          recipientTag: record.recipientTag,
          message,
          blockNumber: record.blockNumber,
          transactionHash: record.transactionHash,
        });

        break;
      } catch {
        // Try the next private routing context.
      }
    }
  }

  return decrypted;
}

// Re-exported so callers don't need to know CairoCustomEnum lives here —
// placeholder for future action-kind enums shared with offer/escrow SDKs.
export type { CairoCustomEnum };
