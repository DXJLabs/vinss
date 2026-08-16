import { RpcProvider, WalletAccountV6, walletV6 } from "starknet";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard-v6/features";
import { RPC_URL } from "./constants";

const MIN_STRK20_WALLET_API = "0.10.3";

function compareVersion(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function detectStrk20Capability(
  wallet: WalletWithStarknetFeatures,
): Promise<boolean> {
  try {
    const versions = await walletV6.supportedWalletApi(wallet);
    return versions.some(
      (version) => compareVersion(version, MIN_STRK20_WALLET_API) >= 0,
    );
  } catch {
    return false;
  }
}

export interface VinssWalletSession {
  account: WalletAccountV6;
  address: string;
  wallet: WalletWithStarknetFeatures;
  strk20Capable: boolean;
}

let provider: RpcProvider | null = null;

function getProvider(): RpcProvider {
  if (!provider) {
    provider = new RpcProvider({ nodeUrl: RPC_URL });
  }
  return provider;
}

export async function createWalletSession(
  wallet: WalletWithStarknetFeatures,
): Promise<VinssWalletSession> {
  const account = await WalletAccountV6.connect(
    { nodeUrl: RPC_URL },
    wallet,
  );

  return {
    account,
    address: account.address,
    wallet,
    strk20Capable: await detectStrk20Capability(wallet),
  };
}

export async function disconnectWallet(): Promise<void> {
  // Wallet Standard handles the wallet connection lifecycle.
}

export { getProvider };
