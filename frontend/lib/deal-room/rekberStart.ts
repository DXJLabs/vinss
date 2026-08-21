import {
  hash,
  num,
  type WalletAccountV6,
} from "starknet";
import {
  CONTRACTS,
  BACKEND_URL,
} from "@/lib/starknet/constants";
import {
  encryptPayload,
  generateActionLocator,
  shortStringToFelt,
  toFelt,
  type ChannelKey,
} from "@/lib/privacy/envelope";
import {
  deriveMessageRoutingTag,
  type MessageRoute,
} from "@/lib/privacy/messageRouting";
import type {
  OfferActionPayload,
  SendActionResult,
} from "@/types/deal-room";
import {
  discoverOfferActions,
} from "@/lib/deal-room/offers";

const ENVELOPE_VERSION = 2;
const OFFER_DOMAIN = "VINSS_OFFER_COMMIT_V2";

interface PreparedEnvelope {
  actionLocator: bigint;
  payloadCommitment: bigint;
  calldata: string[];
}

function commitEnvelope(
  domain: string,
  actionLocator: bigint,
  senderTag: bigint,
  recipientTag: bigint,
  ciphertextChunks: bigint[],
): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements(
      [
        shortStringToFelt(domain),
        BigInt(ENVELOPE_VERSION),
        actionLocator,
        senderTag,
        recipientTag,
        BigInt(ciphertextChunks.length),
        ...ciphertextChunks,
      ].map(String),
    ),
  );
}

async function prepareEnvelope(
  domain: string,
  accountAddress: string,
  channelKey: ChannelKey,
  payload: OfferActionPayload,
  route: MessageRoute,
): Promise<PreparedEnvelope> {
  const encryptionKey =
    route.encryptionKey ?? channelKey;
  const routingKey =
    route.routingKey ?? encryptionKey;

  const actionLocator =
    generateActionLocator(encryptionKey);

  const [senderTag, recipientTag] =
    await Promise.all([
      deriveMessageRoutingTag(
        routingKey,
        "sender",
        accountAddress,
        actionLocator,
      ),
      deriveMessageRoutingTag(
        routingKey,
        "recipient",
        route.recipientIdentity,
        actionLocator,
      ),
    ]);

  const ciphertextChunks =
    await encryptPayload(
      encryptionKey,
      payload,
    );

  const payloadCommitment =
    commitEnvelope(
      domain,
      actionLocator,
      senderTag,
      recipientTag,
      ciphertextChunks,
    );

  const calldata = [
    ENVELOPE_VERSION,
    actionLocator,
    senderTag,
    recipientTag,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);

  return {
    actionLocator,
    payloadCommitment,
    calldata,
  };
}


async function confirmOfferLocator(
  channelKey: ChannelKey,
  route: MessageRoute,
  locator: bigint,
): Promise<{
  transactionHash: string;
} | null> {
  const wanted =
    locator
      .toString(16)
      .replace(/^0x/, "")
      .toLowerCase();

  const deadline =
    Date.now() + 45_000;

  while (Date.now() < deadline) {
    try {
      const discovered =
        await discoverOfferActions(
          BACKEND_URL,
          channelKey,
          route,
        );

      const match =
        discovered.find(
          (item) =>
            item.actionLocator
              .replace(/^0x/, "")
              .toLowerCase() ===
            wanted,
        );

      if (match) {
        return {
          transactionHash:
            match.transactionHash,
        };
      }
    } catch {
      // Backend/indexer can briefly lag the chain.
    }

    await new Promise<void>(
      (resolve) =>
        window.setTimeout(
          resolve,
          1500,
        ),
    );
  }

  return null;
}

/**
 * One wallet approval for Rekber setup.
 *
 * STRK20 permits one external helper invoke in this private transaction.
 * Therefore START REKBER commits the encrypted prepare_escrow payload
 * (including custodyCommitment) through OfferHelper only.
 *
 * Actual custody funding remains a later explicit approval.
 */
export async function startRekberBundle(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  prepareOfferAction:
    OfferActionPayload,
  route: MessageRoute,
): Promise<SendActionResult> {
  if (!CONTRACTS.offerHelper) {
    throw new Error(
      "NEXT_PUBLIC_OFFER_HELPER_ADDRESS is not configured.",
    );
  }

  if (
    !CONTRACTS
      .offerHelperOpenNoteToken
  ) {
    throw new Error(
      "NEXT_PUBLIC_OFFER_HELPER_OPEN_NOTE_TOKEN is not configured.",
    );
  }

  const treasury =
    process.env
      .NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!treasury) {
    throw new Error(
      "NEXT_PUBLIC_VINSS_TREASURY_ADDRESS is not configured.",
    );
  }

  const offerEnvelope =
    await prepareEnvelope(
      OFFER_DOMAIN,
      account.address,
      channelKey,
      prepareOfferAction,
      route,
    );

  const walletPromise =
    account.strk20InvokeTransaction([
      {
        type: "withdraw",
        token:
          CONTRACTS
            .offerHelperOpenNoteToken,
        amount:
          "0xde0b6b3a7640000",
        recipient:
          CONTRACTS.offerHelper,
      },
      {
        type: "transfer",
        token:
          CONTRACTS
            .offerHelperOpenNoteToken,
        amount: "OPEN",
        recipient:
          num.toHex(treasury),
      },
      {
        type: "invoke",
        contract:
          CONTRACTS.offerHelper,
        calldata: [
          toFelt(
            offerEnvelope
              .calldata.length + 1,
          ),
          ...offerEnvelope.calldata,
          "${openNoteIds[0]}",
        ],
      },
    ]);

  const discoveryPromise =
    confirmOfferLocator(
      channelKey,
      route,
      offerEnvelope.actionLocator,
    );

  const walletOutcome =
    walletPromise
      .then((result) => ({
        kind: "wallet" as const,
        result,
      }))
      .catch((error) => ({
        kind:
          "wallet_error" as const,
        error,
      }));

  const first =
    await Promise.race([
      walletOutcome,
      discoveryPromise.then(
        (match) => ({
          kind:
            "discovery" as const,
          match,
        }),
      ),
    ]);

  if (first.kind === "wallet") {
    return {
      transactionHash:
        first.result.transaction_hash,
      actionLocator:
        offerEnvelope.actionLocator,
      payloadCommitment:
        offerEnvelope.payloadCommitment,
    };
  }

  if (
    first.kind === "discovery" &&
    first.match
  ) {
    void walletPromise.catch(
      (err) => {
        const raw =
          err instanceof Error
            ? err.message
            : String(err);

        if (
          !/(?:timeout|timed out)/i.test(
            raw,
          )
        ) {
          console.error(
            "[VINSS START REKBER LATE WALLET ERROR]",
            err,
          );
        }
      },
    );

    return {
      transactionHash:
        first.match.transactionHash,
      actionLocator:
        offerEnvelope.actionLocator,
      payloadCommitment:
        offerEnvelope.payloadCommitment,
    };
  }

  if (
    first.kind === "wallet_error"
  ) {
    const raw =
      first.error instanceof Error
        ? first.error.message
        : String(first.error);

    if (
      !/(?:timeout|timed out)/i.test(
        raw,
      )
    ) {
      throw first.error;
    }

    const confirmed =
      await discoveryPromise;

    if (confirmed) {
      return {
        transactionHash:
          confirmed.transactionHash,
        actionLocator:
          offerEnvelope.actionLocator,
        payloadCommitment:
          offerEnvelope.payloadCommitment,
      };
    }

    throw first.error;
  }

  // Discovery timed out first. Let the wallet callback settle and use its
  // result as the final source of truth.
  const settled =
    await walletOutcome;

  if (settled.kind === "wallet") {
    return {
      transactionHash:
        settled.result.transaction_hash,
      actionLocator:
        offerEnvelope.actionLocator,
      payloadCommitment:
        offerEnvelope.payloadCommitment,
    };
  }

  throw settled.error;
}
