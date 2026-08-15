/**
 * Offer SDK — matches contracts/offers/offer_interfaces.cairo exactly:
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

import { hash, type WalletAccountV6 } from "starknet";
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
import type { OfferActionPayload, SendActionResult } from "./types";

const OFFER_COMMITMENT_DOMAIN = "VINSS_OFFER_COMMIT_V1"; // confirm exact
// name in contracts/utils/constants.cairo for the offer
// module — confirm exact name at build time (not shown in the excerpt
// reviewed while scaffolding; the messaging domain constant is confirmed).

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

  const actionLocator = generateActionLocator(channelKey);
  const ciphertextChunks = await encryptPayload(channelKey, payload);
  const payloadCommitment = commitPayload(
    OFFER_COMMITMENT_DOMAIN,
    ENVELOPE_VERSION,
    actionLocator,
    ciphertextChunks.length,
    ciphertextChunks,
  );

  // Every calldata item must be a 0x-prefixed FELT string
  // (STRK20_CALLDATA_ITEM per @starknet-io/starknet-types-0104) — plain
  // .map(String) on a bigint produced decimal strings and was the actual
  // cause of INVALID_REQUEST_PAYLOAD. toFelt() fixes that.
  const calldata = [
    hash.getSelectorFromName("privacy_invoke"),
    ENVELOPE_VERSION,
    actionLocator,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);

  const response = await account.strk20InvokeTransaction([
    {
      type: "invoke",
      contract: CONTRACTS.offerHelper,
      calldata,
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
  action: import("./types").OfferActionPayload;
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
      )) as import("./types").OfferActionPayload;
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
