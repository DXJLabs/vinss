import "dotenv/config";

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  rpcUrl: requireEnv(
    "RPC_URL",
    "https://free-rpc.nethermind.io/sepolia-juno/v0_7",
  ),
  network: (process.env.STARKNET_NETWORK ?? "sepolia") as "sepolia" | "mainnet",
  contracts: {
    privacyPool: process.env.PRIVACY_POOL_ADDRESS ?? "",
    messageHelper: process.env.MESSAGE_HELPER_ADDRESS ?? "",
    offerHelper: process.env.OFFER_HELPER_ADDRESS ?? "",
    privateEscrowHelper: process.env.PRIVATE_ESCROW_HELPER_ADDRESS ?? "",
    escrowRekber:
      process.env.ESCROW_REKBER_ADDRESS ?? "",
    claimEscrow: process.env.CLAIM_ESCROW_ADDRESS ?? "",
  },
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
