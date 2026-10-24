import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertUnshieldNetwork } from "../frontend/lib/starknet/unshield.ts";

const SEPOLIA = "0x534e5f5345504f4c4941";
const MAINNET = "0x534e5f4d41494e";

test("allows wallet and RPC aligned with Sepolia", () => {
  assert.doesNotThrow(() => assertUnshieldNetwork("sepolia", SEPOLIA, SEPOLIA));
});
test("allows wallet and RPC aligned with Mainnet", () => {
  assert.doesNotThrow(() => assertUnshieldNetwork("mainnet", MAINNET, MAINNET));
});
test("blocks a Mainnet wallet even if frontend RPC points at Sepolia", () => {
  assert.throws(() => assertUnshieldNetwork("sepolia", MAINNET, SEPOLIA), /wallet.*network/i);
});
test("blocks a Mainnet RPC even if wallet points at Sepolia", () => {
  assert.throws(() => assertUnshieldNetwork("sepolia", SEPOLIA, MAINNET), /RPC.*network/i);
});
test("blocks unverified or unsupported chain IDs, including invalid config", () => {
  assert.throws(() => assertUnshieldNetwork("sepolia", "bad", SEPOLIA));
  assert.throws(() => assertUnshieldNetwork("sepolia", SEPOLIA, "bad"));
  assert.throws(() => assertUnshieldNetwork("devnet", SEPOLIA, SEPOLIA));
});

test("public mode preflights wallet and RPC before ordinary account execution", () => {
  const source = readFileSync(new URL("../frontend/components/room/escrow/PublicTransferPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /walletV6\.requestChainId\(session\.wallet\)/);
  assert.match(source, /getProvider\(\)\.getChainId\(\)/);
  assert.ok(source.indexOf("assertUnshieldNetwork(") < source.indexOf("session.account.execute(call)"));
  assert.doesNotMatch(source, /strk20InvokeTransaction\(/);
});
