/**
 * Offer domain module — matches contracts/offers/offer_interfaces.cairo exactly:
 *
 *   privacy_invoke(calldata) with calldata =
 *     [envelope_version, offer_action_locator, claimed_payload_commitment,
 *      payload_chunk_count, ...ciphertext_chunks]
 *
 * offer_action_locator must never be reused as a stable offer/conversation/
 * channel/participant/deal-room/escrow id — every lifecycle action
 * (create/counter/accept/reject/cancel/expire/prepare_escrow) gets its own.
 * root/parent relationships live only inside ciphertext (offer_types.cairo).
 */

import { hash, num, type WalletAccountV6 } from "starknet";
import { CONTRACTS } from "../starknet/constants";
import {
  encryptPayload,
  decryptPayload,
  generateActionLocator,
  shortStringToFelt,
  toFelt,
  type ChannelKey,
} from "@/lib/privacy/envelope";
import type { OfferActionPayload, SendActionResult } from "@/types/deal-room";
import {
  GROUP_RECIPIENT_IDENTITY,
  deriveMessageRoutingTag,
} from "@/lib/privacy/messageRouting";

const OFFER_ENVELOPE_VERSION = 2;
const OFFER_COMMITMENT_DOMAIN = "VINSS_OFFER_COMMIT_V2";

function commitOfferPayloadV2(
  actionLocator: bigint,
  senderTag: bigint,
  recipientTag: bigint,
  ciphertextChunks: bigint[],
): bigint {
  const inputs = [
    shortStringToFelt(OFFER_COMMITMENT_DOMAIN),
    BigInt(OFFER_ENVELOPE_VERSION),
    actionLocator,
    senderTag,
    recipientTag,
    BigInt(ciphertextChunks.length),
    ...ciphertextChunks,
  ];

  return BigInt(
    hash.computePoseidonHashOnElements(inputs.map(String)),
  );
}

export async function sendOfferAction(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: OfferActionPayload,
): Promise<SendActionResult> {
  if (!CONTRACTS.offerHelper) {
    throw new Error(
      "NEXT_PUBLIC_OFFER_HELPER_ADDRESS is not set — see .env.local.example.",
    );
  }

  if (!CONTRACTS.offerHelperOpenNoteToken) {
    throw new Error(
      "NEXT_PUBLIC_OFFER_HELPER_OPEN_NOTE_TOKEN is not configured.",
    );
  }

  const treasury =
    process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!treasury) {
    throw new Error(
      "NEXT_PUBLIC_VINSS_TREASURY_ADDRESS is not configured.",
    );
  }

  const actionLocator = generateActionLocator(channelKey);

  const [senderTag, recipientTag] = await Promise.all([
    deriveMessageRoutingTag(
      channelKey,
      "sender",
      account.address,
      actionLocator,
    ),
    deriveMessageRoutingTag(
      channelKey,
      "recipient",
      GROUP_RECIPIENT_IDENTITY,
      actionLocator,
    ),
  ]);

  const ciphertextChunks = await encryptPayload(channelKey, payload);

  const payloadCommitment = commitOfferPayloadV2(
    actionLocator,
    senderTag,
    recipientTag,
    ciphertextChunks,
  );

  const calldata = [
    OFFER_ENVELOPE_VERSION,
    actionLocator,
    senderTag,
    recipientTag,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);

  // VinssOfferHelper returns one OpenNoteDeposit worth 1 STRK.
  // No selector is prepended: STRK20 invokes privacy_invoke itself.
  const response = await account.strk20InvokeTransaction([
    {
      type: "withdraw",
      token: CONTRACTS.offerHelperOpenNoteToken,
      amount: "0xde0b6b3a7640000",
      recipient: CONTRACTS.offerHelper,
    },
    {
      type: "transfer",
      token: CONTRACTS.offerHelperOpenNoteToken,
      amount: "OPEN",
      recipient: num.toHex(treasury),
    },
    {
      type: "invoke",
      contract: CONTRACTS.offerHelper,
      calldata: [
        toFelt(calldata.length + 1),
        ...calldata,
        "${openNoteIds[0]}",
      ],
    },
  ]);

  return {
    transactionHash: response.transaction_hash,
    actionLocator,
    payloadCommitment,
  };
}

// Convenience wrappers — each just fixes `kind`, keeping call sites in the
// UI readable and matching the product doc's feature list (Offer: create,
// counter, accept, reject, expire, convert to escrow).
export const createOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
) => sendOfferAction(account, channelKey, { ...payload, kind: "create" });

export const counterOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
) => sendOfferAction(account, channelKey, { ...payload, kind: "counter" });

export const acceptOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
) => sendOfferAction(account, channelKey, { ...payload, kind: "accept" });

export const rejectOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
) => sendOfferAction(account, channelKey, { ...payload, kind: "reject" });

export const cancelOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
) => sendOfferAction(account, channelKey, { ...payload, kind: "cancel" });

export const expireOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
) => sendOfferAction(account, channelKey, { ...payload, kind: "expire" });

export const prepareEscrowFromOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
) => sendOfferAction(account, channelKey, { ...payload, kind: "prepare_escrow" });

export async function discoverOfferActions(
  backendUrl: string,
  channelKey: ChannelKey,
): Promise<Array<{
  actionLocator: string;
  payloadCommitment: string;
  action: OfferActionPayload;
  blockNumber: number;
  transactionHash: string;
}>> {
  const res = await fetch(`${backendUrl}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "offer" }),
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
      const action = (await decryptPayload(
        channelKey,
        record.ciphertextChunks.map(BigInt),
      )) as OfferActionPayload;
      decrypted.push({
        actionLocator: record.actionLocator,
        payloadCommitment: record.payloadCommitment,
        action,
        blockNumber: record.blockNumber,
        transactionHash: record.transactionHash,
      });
    } catch {
      // Unrelated channel / invalid ciphertext: discard locally.
    }
  }
  return decrypted;
}
