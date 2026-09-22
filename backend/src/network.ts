import type { AppConfig, StarknetNetwork } from "./config.js";
import type { Request, Response, NextFunction } from "express";

export const CHAIN_IDS = { sepolia: "0x534e5f5345504f4c4941", mainnet: "0x534e5f4d41494e" } as const;

function sameFelt(left: string, right: string): boolean {
  try { return BigInt(left) === BigInt(right); } catch { return false; }
}

export function assertRpcChain(network: StarknetNetwork, actual: string): void {
  if (!sameFelt(actual, CHAIN_IDS[network])) throw new Error(`RPC is not on Starknet ${network}.`);
}

export async function verifyRpcNetwork(config: Pick<AppConfig, "network" | "rpcUrl">): Promise<void> {
  const response = await fetch(config.rpcUrl, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_chainId", params: [] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Cannot verify the RPC network.");
  const body = await response.json() as { result?: string; error?: unknown };
  if (body.error || !body.result) throw new Error("RPC did not return a chain ID.");
  assertRpcChain(config.network, body.result);
}

export function networkBoundary(config: Pick<AppConfig, "network" | "contracts">) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-VINSS-Network", config.network);
    res.setHeader("X-VINSS-Privacy-Pool", config.contracts.privacyPool);
    const network = req.get("X-VINSS-Network");
    const pool = req.get("X-VINSS-Privacy-Pool");
    if ((network && network !== config.network) ||
        (pool && !sameFelt(pool, config.contracts.privacyPool))) {
      res.status(409).json({ error: "VINSS_NETWORK_MISMATCH" });
      return;
    }
    next();
  };
}
