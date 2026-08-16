// Contract addresses come from env vars only — never hardcode, since Sepolia
// and mainnet addresses differ and the sprint requires a mainnet redeploy.
// See STRK20_INTEGRATION_PLAN.md §4 and contracts/README.md for current
// Sepolia addresses.

import { num } from "starknet";

export const NETWORK = (process.env.NEXT_PUBLIC_STARKNET_NETWORK ??
  "sepolia") as "sepolia" | "mainnet";

// Explorers and deploy output print addresses zero-padded to 64 hex digits
// (e.g. 0x0173f5b0...), copy-pasted straight into .env.local. The STRK20
// Wallet API validates every felt-typed field — including `contract` in an
// `invoke` action — against ^0x(0|[a-fA-F1-9][a-fA-F0-9]{0,62})$ (see the
// same pattern cited in vinss-sdk/envelope.ts toFelt): NO leading zero
// digit is allowed. A zero-padded address fails that regex and the wallet
// returns INVALID_REQUEST_PAYLOAD. calldata values already go through
// toFelt() and come out normalized; these top-level addresses did not, so
// normalize them once here for every consumer.
function normalizeAddress(address: string): string {
  return address ? num.toHex(address) : address;
}

export const CONTRACTS = {
  privacyPool: normalizeAddress(process.env.NEXT_PUBLIC_PRIVACY_POOL_ADDRESS ?? ""),
  channelHelper: normalizeAddress(
    process.env.NEXT_PUBLIC_CHANNEL_HELPER_ADDRESS ?? "",
  ),
  offerHelper: normalizeAddress(process.env.NEXT_PUBLIC_OFFER_HELPER_ADDRESS ?? ""),
  privateEscrowHelper: normalizeAddress(
    process.env.NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS ?? "",
  ),
  privateEscrowSettlement: normalizeAddress(
    process.env.NEXT_PUBLIC_PRIVATE_ESCROW_SETTLEMENT_ADDRESS ?? "",
  ),
  claimEscrow: normalizeAddress(process.env.NEXT_PUBLIC_CLAIM_ESCROW_ADDRESS ?? ""),
};

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://free-rpc.nethermind.io/sepolia-juno/v0_7";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

// Minimum wallet API spec version treated as STRK20-capable.
// Capability must be detected via a version query, never a data call —
// see references/concepts.md "least privilege".
export const MIN_WALLET_API_VERSION = "0.10.3";
