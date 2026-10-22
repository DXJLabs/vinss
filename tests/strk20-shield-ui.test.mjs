import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildShieldAction } from "../frontend/lib/starknet/unshield.ts";

const STRK = "0x0042";
test("Shield constructs only a native wallet deposit and no VINSS fee transfer", () => {
  assert.deepEqual(buildShieldAction({ token: STRK, amount: "1.2500", decimals: 18 }), {
    type: "deposit", token: "0x42", amount: "0x1158e460913d0000",
  });
});
test("Shield preserves exact token decimals and rejects invalid principal", () => {
  assert.equal(buildShieldAction({ token: "0x01", amount: "0.000001", decimals: 6 }).amount, "0x1");
  for (const amount of ["0", "1e3", "-1", "0.0000001"]) {
    assert.throws(() => buildShieldAction({ token: STRK, amount, decimals: 6 }));
  }
  assert.throws(() => buildShieldAction({ token: "0x0", amount: "1", decimals: 18 }));
});
test("Shield page verifies both chains before wallet approval and shows fee boundaries", () => {
  const shield = readFileSync(new URL("../frontend/app/shield/page.tsx", import.meta.url), "utf8");
  assert.match(shield, /buildShieldAction\(/);
  assert.match(shield, /walletV6\.requestChainId\(session\.wallet\)/);
  assert.match(shield, /getProvider\(\)\.getChainId\(\)/);
  assert.match(shield, /strk20InvokeTransaction\(\[action\]\)/);
  assert.ok(shield.indexOf("assertUnshieldNetwork(") < shield.indexOf("strk20InvokeTransaction([action])"));
  assert.match(shield, /Shield fees may be higher than Unshield fees/);
  assert.match(shield, /viewing key/i);
  assert.match(shield, /VINSS added service fee/);
  assert.match(shield, /disabled=\{busy \|\| !session\?\.strk20Capable/);
});
test("Shield and Unshield are discoverable and allow wallet connection on both pages", () => {
  const home = readFileSync(new URL("../frontend/app/page.tsx", import.meta.url), "utf8");
  const shield = readFileSync(new URL("../frontend/app/shield/page.tsx", import.meta.url), "utf8");
  const unshield = readFileSync(new URL("../frontend/app/unshield/page.tsx", import.meta.url), "utf8");
  const fees = readFileSync(new URL("../frontend/app/fees/page.tsx", import.meta.url), "utf8");
  assert.match(home, /href="\/shield"/);
  assert.match(home, /href="\/unshield"/);
  assert.match(shield, /<WalletConnectButton/);
  assert.match(unshield, /<WalletConnectButton/);
  assert.match(unshield, /href="\/shield"/);
  assert.match(fees, /href="\/shield"/);
});
