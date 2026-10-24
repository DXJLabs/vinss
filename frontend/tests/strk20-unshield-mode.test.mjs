import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildUnshieldAction, assertUnshieldNetwork } from "../lib/starknet/unshield.ts";

function source(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("Unshield is inline in Deal Room, not a navigation link on the homepage", () => {
  const header = source("../components/room/RoomHeader.tsx");
  const home = source("../app/page.tsx");
  const wallet = source("../components/WalletConnectButton.tsx");
  assert.match(header, /Private · STRK20/);
  assert.match(header, /<UnshieldPanel session={session}/);
  assert.doesNotMatch(home, /href="\/(?:shield|unshield)"/);
  assert.doesNotMatch(wallet, /href="\/(?:shield|unshield)"/);
});

test("Native Unshield action withdraws principal without any VINSS revenue transfer", () => {
  const action = buildUnshieldAction({
    token: "0x123", recipient: "0x456", amount: "1.25", decimals: 18,
  });
  assert.deepEqual(action, {
    type: "withdraw", token: "0x123", recipient: "0x456", amount: "0x1158e460913d0000",
  });
  const panel = source("../components/room/UnshieldPanel.tsx");
  assert.match(panel, /strk20InvokeTransaction\(\[action\]\)/);
  assert.match(panel, /assertUnshieldNetwork\(NETWORK, walletChainId, rpcChainId\)/);
});

test("Wallet and RPC must both match before an Unshield can be submitted", () => {
  const sepolia = "0x534e5f5345504f4c4941";
  const mainnet = "0x534e5f4d41494e";
  assert.throws(() => assertUnshieldNetwork("mainnet", sepolia, mainnet), /Wallet network/);
  assert.throws(() => assertUnshieldNetwork("mainnet", mainnet, sepolia), /RPC network/);
  assert.doesNotThrow(() => assertUnshieldNetwork("sepolia", sepolia, sepolia));
});
