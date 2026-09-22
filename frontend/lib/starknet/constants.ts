// Each build uses one explicit network profile. Existing mainnet variables
// remain supported; use env.sepolia.example for the isolated test deployment.

import { num } from "starknet";
import { assertPoolNetwork, parseNetwork } from "./network";

export const NETWORK = parseNetwork(process.env.NEXT_PUBLIC_STARKNET_NETWORK ?? "sepolia");

// Explorers and deploy output print addresses zero-padded to 64 hex digits
// (e.g. 0x0173f5b0...), copy-pasted straight into .env.local. The STRK20
// Wallet API validates every felt-typed field — including `contract` in an
// `invoke` action — against ^0x(0|[a-fA-F1-9][a-fA-F0-9]{0,62})$ (see the
// same pattern cited in lib/privacy/envelope.ts toFelt): NO leading zero
// digit is allowed. A zero-padded address fails that regex and the wallet
// returns INVALID_REQUEST_PAYLOAD. calldata values already go through
// toFelt() and come out normalized; these top-level addresses did not, so
// normalize them once here for every consumer.
function normalizeAddress(address: string): string {
  return address ? num.toHex(address) : address;
}

export const CONTRACTS = {
  privacyPool: normalizeAddress(
    process.env.NEXT_PUBLIC_PRIVACY_POOL_ADDRESS ?? "",
  ),
  messageHelper: normalizeAddress(
    process.env.NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS ?? "",
  ),
  // Must match the `open_note_token` constructor arg VinssMessageHelper was
  // deployed with. It participates in the STRK20 action bundle that routes
  // the current 7 STRK per-message VINSS application revenue.
  messageHelperOpenNoteToken: normalizeAddress(
    process.env.NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN ?? "",
  ),
  invite: normalizeAddress(process.env.NEXT_PUBLIC_INVITE_ADDRESS ?? ""),
  offerHelper: normalizeAddress(
    process.env.NEXT_PUBLIC_OFFER_HELPER_ADDRESS ?? "",
  ),
  offerHelperOpenNoteToken: normalizeAddress(
    process.env.NEXT_PUBLIC_OFFER_HELPER_OPEN_NOTE_TOKEN ??
      process.env.NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN ??
      "",
  ),
  privateEscrowHelper: normalizeAddress(
    process.env.NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS ?? "",
  ),
  // Principal can leave custody only with both the payer authorization and
  // the payee claim, or through the payer's timeout refund path.
  escrowRekber: normalizeAddress(
    process.env.NEXT_PUBLIC_ESCROW_REKBER_ADDRESS ?? "",
  ),
  settlementCertificate: normalizeAddress(
    process.env.NEXT_PUBLIC_SETTLEMENT_CERTIFICATE_ADDRESS ?? "",
  ),
};

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (NETWORK === "sepolia" ? "https://api.cartridge.gg/x/starknet/sepolia" : "");

assertPoolNetwork(NETWORK, CONTRACTS.privacyPool);

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

// Minimum wallet API spec version treated as STRK20-capable.
// Capability must be detected via a version query, never a data call —
// see references/concepts.md "least privilege".
export const MIN_WALLET_API_VERSION = "0.10.3";

// STRK token — same L2 address on Sepolia and mainnet (system pre-deploy),
// but kept env-driven like every other contract here per project convention.
export const STRK_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_STRK_ADDRESS ?? "",
);

// Offer templates currently expose STRK and USDC as settlement assets.
// Keep both addresses environment-driven so Sepolia/mainnet deployments
// cannot silently reuse the wrong token address.
export const USDC_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
);
