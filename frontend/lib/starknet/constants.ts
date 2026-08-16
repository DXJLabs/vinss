// Contract addresses come from env vars only — never hardcode, since Sepolia
// and mainnet addresses differ and the sprint requires a mainnet redeploy.
// See STRK20_INTEGRATION_PLAN.md §4 and contracts/README.md for current
// Sepolia addresses.

export const NETWORK = (process.env.NEXT_PUBLIC_STARKNET_NETWORK ??
  "sepolia") as "sepolia" | "mainnet";

export const CONTRACTS = {
  privacyPool: process.env.NEXT_PUBLIC_PRIVACY_POOL_ADDRESS ?? "",
  channelHelper: process.env.NEXT_PUBLIC_CHANNEL_HELPER_ADDRESS ?? "",
  offerHelper: process.env.NEXT_PUBLIC_OFFER_HELPER_ADDRESS ?? "",
  privateEscrowHelper:
    process.env.NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS ?? "",
  privateEscrowSettlement:
    process.env.NEXT_PUBLIC_PRIVATE_ESCROW_SETTLEMENT_ADDRESS ?? "",
  claimEscrow: process.env.NEXT_PUBLIC_CLAIM_ESCROW_ADDRESS ?? "",
  // TODO(belum diputuskan): token yang dipasangkan pada action `transfer`
  // amount:"OPEN" untuk membuka slot zero-value note sebelum privacy_invoke
  // (lihat strk20-by-example.org/starknet-wallet-api/private-defi, "The two
  // actions"). Kemungkinan besar ini token STRK Sepolia, tapi belum
  // dikonfirmasi ke pool/wallet test dapp — isi via env var di bawah.
  zeroValueNoteToken:
    process.env.NEXT_PUBLIC_ZERO_VALUE_NOTE_TOKEN_ADDRESS ?? "",
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
