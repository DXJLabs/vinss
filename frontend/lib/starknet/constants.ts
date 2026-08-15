// Contract addresses come from env vars only — never hardcode, since Sepolia
// and mainnet addresses differ and the sprint requires a mainnet redeploy.
// See STRK20_INTEGRATION_PLAN.md §4 and contracts/README.md for current
// Sepolia addresses.

export const NETWORK = (process.env.NEXT_PUBLIC_STARKNET_NETWORK ??
  "sepolia") as "sepolia" | "mainnet";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Intentionally not throwing at import time in dev — components should
    // handle an empty address by disabling the relevant action and telling
    // the user which env var is missing, per concepts.md's "least privilege"
    // and honest-UX rules (no silent no-ops).
    return "";
  }
  return value;
}

export const CONTRACTS = {
  privacyPool: requireEnv("NEXT_PUBLIC_PRIVACY_POOL_ADDRESS"),
  channelHelper: requireEnv("NEXT_PUBLIC_CHANNEL_HELPER_ADDRESS"),
  offerHelper: requireEnv("NEXT_PUBLIC_OFFER_HELPER_ADDRESS"),
  privateEscrowHelper: requireEnv("NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS"),
  privateEscrowSettlement: requireEnv(
    "NEXT_PUBLIC_PRIVATE_ESCROW_SETTLEMENT_ADDRESS",
  ),
  claimEscrow: requireEnv("NEXT_PUBLIC_CLAIM_ESCROW_ADDRESS"),
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
