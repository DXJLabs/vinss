/**
 * Offer domain module.
 *
 * Every Offer lifecycle action is immutable and receives its own locator.
 * Direct Offer actions reuse the same pairwise ECDH-derived encryption and
 * routing context as direct chat. The backend receives only public opaque
 * routing tags and ciphertext; participant addresses remain encrypted.
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
import type {
  OfferActionPayload,
  SendActionResult,
} from "@/types/deal-room";
import {
  GROUP_RECIPIENT_IDENTITY,
  deriveMessageRoutingTag,
  type MessageRoute,
} from "@/lib/privacy/messageRouting";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";

const OFFER_ENVELOPE_VERSION = 2;
const OFFER_COMMITMENT_DOMAIN = "VINSS_OFFER_COMMIT_V2";

export interface PreparedOfferSend {
  actionLocator: bigint;
  payloadCommitment: bigint;
}

/**
 * Commit the exact public Offer envelope that the Cairo helper records.
 * The encrypted payload itself remains private.
 */
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

/**
 * Send one immutable Offer lifecycle action.
 *
 * With no route this remains compatible with the legacy room-key path.
 * With a route, encryption and opaque routing use the pairwise direct key.
 */
export async function sendOfferAction(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: OfferActionPayload,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
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

  // A direct Offer uses the Alice<->Bob key; legacy/group Offer uses room key.
  const encryptionKey = route?.encryptionKey ?? channelKey;

  // Routing normally uses the same pairwise key as encryption.
  const routingKey = route?.routingKey ?? encryptionKey;

  // The recipient identity is hidden behind a per-action HMAC routing tag.
  const recipientIdentity =
    route?.recipientIdentity ?? GROUP_RECIPIENT_IDENTITY;

  // Generate a fresh locator from the encryption context for every action.
  const actionLocator = generateActionLocator(encryptionKey);

  // Derive unlinkable sender and recipient tags for this one locator.
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

  // Encrypt all deal terms and participant metadata locally.
  const ciphertextChunks = await encryptPayload(
    encryptionKey,
    payload,
  );

  // Commit to the exact encrypted envelope before sending it to Starknet.
  const payloadCommitment = commitOfferPayloadV2(
    actionLocator,
    senderTag,
    recipientTag,
    ciphertextChunks,
  );

  // Reflect recovery metadata before Ready X can background the app.
  // A delayed wallet callback must not make an already-submitted Offer look failed.
  if (onPrepared) {
    await onPrepared({
      actionLocator,
      payloadCommitment,
    });
  }

  // Keep calldata aligned with VinssOfferHelper.privacy_invoke V2.
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
  // STRK20 invokes privacy_invoke itself, so no selector is prepended.
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

// These wrappers keep lifecycle call sites explicit while preserving the
// same optional private route for create/counter/accept/reject actions.
export const createOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
) =>
  sendOfferAction(
    account,
    channelKey,
    { ...payload, kind: "create" },
    route,
    onPrepared,
  );

export const counterOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
) =>
  sendOfferAction(
    account,
    channelKey,
    { ...payload, kind: "counter" },
    route,
    onPrepared,
  );

export const acceptOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
) =>
  sendOfferAction(
    account,
    channelKey,
    { ...payload, kind: "accept" },
    route,
    onPrepared,
  );

export const rejectOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
) =>
  sendOfferAction(
    account,
    channelKey,
    { ...payload, kind: "reject" },
    route,
    onPrepared,
  );

export const cancelOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
) =>
  sendOfferAction(
    account,
    channelKey,
    { ...payload, kind: "cancel" },
    route,
    onPrepared,
  );

export const expireOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
) =>
  sendOfferAction(
    account,
    channelKey,
    { ...payload, kind: "expire" },
    route,
    onPrepared,
  );

export const prepareEscrowFromOffer = (
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: Omit<OfferActionPayload, "kind">,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedOfferSend,
  ) => void | Promise<void>,
) =>
  sendOfferAction(
    account,
    channelKey,
    { ...payload, kind: "prepare_escrow" },
    route,
    onPrepared,
  );

/**
 * Discover Offer ciphertext and decrypt only records matching one of the
 * caller's private routing contexts.
 */
export async function discoverOfferActions(
  backendUrl: string,
  channelKey: ChannelKey,
  route?: MessageRoute | MessageRoute[],
): Promise<
  Array<{
    actionLocator: string;
    payloadCommitment: string;
    senderTag: string;
    recipientTag: string;
    action: OfferActionPayload;
    blockNumber: number;
    transactionHash: string;
    matchedRoute: MessageRoute;
  }>
> {
  // The backend remains keyless and receives only the record kind.
  const res = await fetch(`${backendUrl}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "offer" }),
  });

  if (!res.ok) {
    throw new Error(
      `Discovery failed: ${res.status} ${await res.text()}`,
    );
  }

  // Offer V2 events expose only opaque routing tags plus ciphertext.
  const records = (await res.json()) as Array<{
    actionLocator: string;
    payloadCommitment: string;
    senderTag?: string;
    recipientTag?: string;
    ciphertextChunks: string[];
    blockNumber: number;
    transactionHash: string;
  }>;

  // Preserve a legacy room-key route when no direct route was supplied.
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

  const decrypted: Array<{
    actionLocator: string;
    payloadCommitment: string;
    senderTag: string;
    recipientTag: string;
    action: OfferActionPayload;
    blockNumber: number;
    transactionHash: string;
    matchedRoute: MessageRoute;
  }> = [];

  // Try only private routing contexts known by this client.
  for (const record of records) {
    if (!record.senderTag || !record.recipientTag) {
      continue;
    }

    const actionLocator = BigInt(record.actionLocator);

    for (const candidate of candidateRoutes) {
      try {
        // Direct routes carry their own pairwise encryption key.
        const encryptionKey =
          candidate.encryptionKey ?? channelKey;

        // Routing defaults to the encryption key to avoid a second secret.
        const routingKey =
          candidate.routingKey ?? encryptionKey;

        // First reject records whose public opaque recipient tag cannot
        // belong to this candidate route.
        const expectedRecipientTag =
          await deriveMessageRoutingTag(
            routingKey,
            "recipient",
            candidate.recipientIdentity,
            actionLocator,
          );

        if (
          BigInt(record.recipientTag) !==
          expectedRecipientTag
        ) {
          continue;
        }

        // Decrypt locally only after the opaque route matches.
        const action = (await decryptPayload(
          encryptionKey,
          record.ciphertextChunks.map(BigInt),
        )) as OfferActionPayload;

        // Bind the encrypted sender identity back to the public sender tag.
        if (action.senderAddress) {
          const expectedSenderTag =
            await deriveMessageRoutingTag(
              routingKey,
              "sender",
              action.senderAddress,
              actionLocator,
            );

          if (
            BigInt(record.senderTag) !==
            expectedSenderTag
          ) {
            continue;
          }
        }

        // New direct Offer payloads also bind the encrypted recipient to
        // the route that matched the opaque recipient tag.
        if (
          action.recipientAddress &&
          !sameStarknetAddress(
            action.recipientAddress,
            candidate.recipientIdentity,
          )
        ) {
          continue;
        }

        decrypted.push({
          actionLocator: record.actionLocator,
          payloadCommitment: record.payloadCommitment,
          senderTag: record.senderTag,
          recipientTag: record.recipientTag,
          action,
          blockNumber: record.blockNumber,
          transactionHash: record.transactionHash,
          // Keep the locally matched pairwise route in memory so lifecycle
          // replies can reuse the exact key that decrypted their parent.
          matchedRoute: candidate,
        });

        // One record must belong to at most one candidate route.
        break;
      } catch {
        // A key mismatch or unrelated ciphertext is expected during local discovery.
      }
    }
  }

  return decrypted;
}
