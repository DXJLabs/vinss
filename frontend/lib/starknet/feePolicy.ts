import { num } from "starknet";
import { toFelt } from "@/lib/privacy/envelope";
import { CONTRACTS } from "./constants";
import { getProvider } from "./walletClient";

export const VINSS_FEE_ACTION = {
  roomActivation: 1,
  message: 2,
  offer: 3,
  rekber: 4,
} as const;

const feePolicyByHelper = new Map<string, string>();

let rekberRevenueFeePolicy: string | null = null;

function requireAddress(
  address: string,
  label: string,
): string {
  if (!address) {
    throw new Error(`${label} is not configured for this network.`);
  }

  return address;
}

function requirePositiveQuote(
  value: string | undefined,
  label: string,
): bigint {
  const quote = BigInt(value ?? "0");

  if (quote <= 0n) {
    throw new Error(`${label} returned an invalid zero fee quote.`);
  }

  return quote;
}

async function resolveHelperFeePolicy(
  helperAddress: string,
  label: string,
): Promise<string> {
  const helper = requireAddress(helperAddress, label);
  const cached = feePolicyByHelper.get(helper);

  if (cached) {
    return cached;
  }

  const result = await getProvider().callContract({
    contractAddress: helper,
    entrypoint: "get_fee_policy",
    calldata: [],
  });

  const feePolicy = num.toHex(result[0] ?? "0");

  if (feePolicy === "0x0") {
    throw new Error(`${label} returned a zero FeePolicy address.`);
  }

  feePolicyByHelper.set(helper, feePolicy);
  return feePolicy;
}

/*
 * Rekber exposes its revenue FeePolicy through a dedicated getter.
 * Do not use get_fee_policy here: Rekber's get_fee_policy returns oracle
 * configuration, unlike Message/Offer helpers which return an address.
 */
async function resolveRekberRevenueFeePolicy(): Promise<string> {
  if (rekberRevenueFeePolicy) {
    return rekberRevenueFeePolicy;
  }

  const escrowRekber = requireAddress(
    CONTRACTS.escrowRekber,
    "VINSS Rekber",
  );

  const result = await getProvider().callContract({
    contractAddress: escrowRekber,
    entrypoint: "get_revenue_fee_policy",
    calldata: [],
  });

  const feePolicy = num.toHex(
    result[0] ?? "0",
  );

  if (feePolicy === "0x0") {
    throw new Error(
      "VINSS Rekber returned a zero revenue FeePolicy address.",
    );
  }

  rekberRevenueFeePolicy = feePolicy;
  return feePolicy;
}

async function quoteFlatFee(
  helperAddress: string,
  action: number,
  label: string,
): Promise<bigint> {
  const feePolicy = await resolveHelperFeePolicy(
    helperAddress,
    label,
  );

  const result = await getProvider().callContract({
    contractAddress: feePolicy,
    entrypoint: "quote_fee",
    calldata: [toFelt(action)],
  });

  return requirePositiveQuote(result[0], `${label} FeePolicy`);
}

/**
 * Room activation is charged only when an Invite is created. Invite consume
 * remains a replay-protected, non-revenue action in the current contract.
 */
export function quoteRoomActivationFee(): Promise<bigint> {
  return quoteFlatFee(
    CONTRACTS.invite,
    VINSS_FEE_ACTION.roomActivation,
    "VINSS Invite",
  );
}

export function quoteMessageFee(): Promise<bigint> {
  return quoteFlatFee(
    CONTRACTS.messageHelper,
    VINSS_FEE_ACTION.message,
    "VINSS MessageHelper",
  );
}

export function quoteOfferFee(): Promise<bigint> {
  return quoteFlatFee(
    CONTRACTS.offerHelper,
    VINSS_FEE_ACTION.offer,
    "VINSS OfferHelper",
  );
}

/*
 * Agreement + Submit Work are VINSS's two fee-bearing Rekber workflow
 * actions. Read the canonical Rekber action quote from FeePolicy instead
 * of hardcoding a STRK amount in the frontend.
 */
export async function quoteRekberWorkflowFee(): Promise<bigint> {
  /*
   * Agreement and Submit Work are the two VINSS workflow revenue actions.
   *
   * Do NOT use FeePolicy FEE_ACTION_REKBER here. That quote includes the
   * six-action Rekber sponsor reserve and can therefore be much larger than
   * the intended workflow charge.
   *
   * Funding keeps using quoteRekberFee(), including its 2% / reserve floor.
   */
  await resolveRekberRevenueFeePolicy();

  return 1n * 10n ** 18n;
}

/**
 * Rekber has token-aware pricing, so its final quote must come from Rekber's
 * quote_rekber_fee(token, principal), not directly from FeePolicy.quote_fee(4).
 * Rekber internally combines the 2% principal fee with the FeePolicy-backed
 * USD/lifecycle reserve floor.
 */
export async function quoteRekberFee(
  token: string,
  principal: bigint,
): Promise<bigint> {
  const escrowRekber = requireAddress(
    CONTRACTS.escrowRekber,
    "VINSS Rekber",
  );

  if (principal <= 0n) {
    throw new Error("Rekber principal must be greater than zero.");
  }

  const result = await getProvider().callContract({
    contractAddress: escrowRekber,
    entrypoint: "quote_rekber_fee",
    calldata: [
      num.toHex(token),
      toFelt(principal),
    ],
  });

  return requirePositiveQuote(result[0], "VINSS Rekber");
}
