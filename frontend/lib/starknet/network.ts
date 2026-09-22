export type StarknetNetwork = "sepolia" | "mainnet";

export const NETWORKS = {
  sepolia: {
    chainId: "0x534e5f5345504f4c4941",
    privacyPool: "0x254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91",
  },
  mainnet: {
    chainId: "0x534e5f4d41494e",
    privacyPool: "0x40337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
  },
} as const;

export function parseNetwork(value: string): StarknetNetwork {
  if (value === "sepolia" || value === "mainnet") return value;
  throw new Error("Starknet network must be sepolia or mainnet.");
}

export function sameFelt(left: string, right: string): boolean {
  try { return BigInt(left) === BigInt(right); } catch { return false; }
}

export function assertChainId(network: StarknetNetwork, actual: string, source: string): void {
  if (!sameFelt(actual, NETWORKS[network].chainId)) {
    throw new Error(`${source} is not on Starknet ${network}. Switch networks before continuing.`);
  }
}

export function assertPoolNetwork(network: StarknetNetwork, pool: string): void {
  const other = network === "sepolia" ? "mainnet" : "sepolia";
  if (sameFelt(pool, NETWORKS[other].privacyPool)) {
    throw new Error(`The ${other} privacy pool cannot be used on ${network}.`);
  }
}

/** A fresh RPC request: RpcProvider.getChainId() can cache a previous result. */
export async function readRpcChainId(rpcUrl: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_chainId", params: [] }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Unable to verify the Starknet RPC network.");
  const body = await response.json();
  if (body.error || typeof body.result !== "string") {
    throw new Error("RPC did not return a Starknet chain ID.");
  }
  return body.result;
}
