import type {
  WalletAccountV6,
} from "starknet";
import {
  sendOfferAction,
} from "@/lib/deal-room/offers";
import type {
  ChannelKey,
} from "@/lib/privacy/envelope";
import type {
  MessageRoute,
} from "@/lib/privacy/messageRouting";
import type {
  OfferActionPayload,
  SendActionResult,
} from "@/types/deal-room";

const START_REKBER_TIMEOUT_MS = 60_000;

/**
 * START REKBER is an encrypted prepare_escrow Offer action.
 *
 * It uses the same proven OfferHelper transaction path as normal
 * Offer lifecycle actions. No custody funds move here; actual funding
 * remains a separate explicit approval.
 */
export async function startRekberBundle(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  prepareOfferAction: OfferActionPayload,
  route: MessageRoute,
): Promise<SendActionResult> {
  if (
    prepareOfferAction.kind !==
    "prepare_escrow"
  ) {
    throw new Error(
      "START REKBER requires a prepare_escrow action.",
    );
  }

  const walletRequest =
    sendOfferAction(
      account,
      channelKey,
      prepareOfferAction,
      route,
    );

  let timer:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeout =
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            "Ready X did not open or respond to START REKBER. Please try again.",
          ),
        );
      }, START_REKBER_TIMEOUT_MS);
    });

  try {
    return await Promise.race([
      walletRequest,
      timeout,
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
