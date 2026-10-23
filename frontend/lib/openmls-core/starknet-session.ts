"use client";
import { canonicalStarknetAddress } from "@/lib/privacy/participantKeys";
import { BrowserOpenMlsBridge } from "./openmls/browser-bridge";
import { IndexedDbOpenMlsCheckpointStore } from "./openmls/indexeddb-checkpoint-store";
import { createOpenMlsWasmLoader } from "./openmls/runtime";
import type { GeneratedOpenMlsWasmModule } from "./openmls/wasm-api";

/**
 * Starknet-adapted OpenMLS cryptographic session.
 *
 * Important: this factory does NOT publish or verify a wallet-bound KeyPackage.
 * The application transport must require proof of wallet control before
 * accepting any installation-to-Starknet-address binding.
 */
const loadWasm = createOpenMlsWasmLoader(
  async () => (await import("@/lib/openmls/vinss_mls.js")) as unknown as GeneratedOpenMlsWasmModule,
);

export interface StarknetOpenMlsSessionInput {
  chainId: string;
  roomId: string;
  walletAddress: string;
  installationId: string;
}

const TOKEN_PATTERN = /^[a-zA-Z0-9_:\-]{1,128}$/;

export async function createStarknetOpenMlsSession(
  input: StarknetOpenMlsSessionInput,
): Promise<BrowserOpenMlsBridge> {
  const chainId = input.chainId.trim();
  const roomId = input.roomId.trim();
  const walletAddress = canonicalStarknetAddress(input.walletAddress);
  const installationId = input.installationId.trim();
  if (
    !TOKEN_PATTERN.test(chainId) ||
    !TOKEN_PATTERN.test(roomId) ||
    !TOKEN_PATTERN.test(installationId) ||
    !/^0x[0-9a-f]+$/.test(walletAddress)
  ) {
    throw new Error("Invalid Starknet OpenMLS identity scope.");
  }

  // Different chains must never share MLS state or installation credentials.
  const scope = `${chainId}:${roomId}:${walletAddress}:${installationId}`;
  const checkpoints = new IndexedDbOpenMlsCheckpointStore({
    dbName: `vinss-starknet-openmls-v1:${chainId}`,
  });
  const bridge = new BrowserOpenMlsBridge(loadWasm, checkpoints);
  await bridge.initialize({
    userId: walletAddress,
    installationId: scope,
    credential: new TextEncoder().encode(scope),
  });
  return bridge;
}
