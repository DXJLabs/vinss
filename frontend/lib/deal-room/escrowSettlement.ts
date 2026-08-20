/**
 * Accepted Offer -> Escrow Rekber settlement mapping.
 *
 * This module intentionally contains no wallet invocation and no UI state.
 * It is the narrow production boundary that turns an already-accepted,
 * encrypted Offer into the generic public settlement parameters Rekber needs.
 *
 * Deal-specific semantics remain in the encrypted Offer snapshot. Rekber only
 * resolves the settlement token and converts the accepted human amount into
 * exact ERC-20 base units.
 */

import {
  STRK_ADDRESS,
  USDC_ADDRESS,
} from "../starknet/constants";
import type {
  EscrowOfferSnapshot,
  OfferActionPayload,
} from "../../types/deal-room";

export interface SettlementAsset {
  symbol: "STRK" | "USDC";
  address: string;
  decimals: number;
}

/**
 * Resolve only settlement assets currently supported by Offer templates.
 *
 * Addresses remain environment-driven; decimals are protocol/token metadata
 * used to convert the accepted decimal amount without floating point.
 */
export function resolveSettlementAsset(
  asset: string,
): SettlementAsset | null {
  const symbol =
    asset.trim().toUpperCase();

  if (symbol === "STRK") {
    return {
      symbol: "STRK",
      address: STRK_ADDRESS,
      decimals: 18,
    };
  }

  if (symbol === "USDC") {
    return {
      symbol: "USDC",
      address: USDC_ADDRESS,
      decimals: 6,
    };
  }

  return null;
}

/**
 * Convert the decimal amount stored in the accepted Offer into exact ERC-20
 * base units. No Number/float conversion is used, so values cannot silently
 * lose precision before reaching the Rekber contract.
 */
export function parseSettlementAmount(
  amount: string,
  decimals: number,
): bigint {
  const normalized = amount.trim();

  if (
    !/^\d+(?:\.\d+)?$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "Accepted Offer amount must be a positive decimal value.",
    );
  }

  const [
    whole = "0",
    fraction = "",
  ] = normalized.split(".");

  if (
    fraction.length > decimals
  ) {
    throw new Error(
      `Accepted Offer amount has more than ${decimals} decimal places.`,
    );
  }

  const paddedFraction =
    fraction.padEnd(decimals, "0");

  const base =
    10n ** BigInt(decimals);

  const result =
    BigInt(whole) * base +
    BigInt(
      paddedFraction || "0",
    );

  if (result <= 0n) {
    throw new Error(
      "Accepted Offer amount must be greater than zero.",
    );
  }

  return result;
}

/**
 * Freeze the accepted Offer terms that private Escrow coordination will carry.
 *
 * This snapshot is deliberately generic across Freelance, NFT, Goods, Bounty,
 * OTC and the other Offer templates. No DealType-specific data is exposed to
 * the public Rekber custody contract.
 */
export function buildEscrowOfferSnapshot(
  acceptedOfferLocator: string,
  action: OfferActionPayload,
): EscrowOfferSnapshot {
  if (action.kind !== "accept") {
    throw new Error(
      "Escrow Rekber requires an accepted Offer.",
    );
  }

  return {
    acceptedOfferLocator,
    termsOfferLocator:
      action.parentOfferLocator ??
      acceptedOfferLocator,
    rootOfferLocator:
      action.rootOfferLocator,
    dealType: action.dealType,
    asset: action.asset,
    amount: action.amount,
    paymentTerms:
      action.paymentTerms,
    conditions: action.conditions,
    expiresAt: action.expiresAt,
  };
}
