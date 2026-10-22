import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const unshield = readFileSync(new URL("../frontend/app/unshield/page.tsx", import.meta.url), "utf8");
const fees = readFileSync(new URL("../frontend/app/fees/page.tsx", import.meta.url), "utf8");

test("withdrawn principal is not a protocol or VINSS fee", () => {
  assert.match(unshield, /Amount withdrawn \(not a fee\)/);
  assert.match(unshield, /VINSS added service fee/);
});

test("wallet fee for Shield is distinct from Unshield and not set by VINSS", () => {
  assert.match(unshield, /Shield and Unshield can have different wallet fees/);
  assert.match(unshield, /Review the wallet quote before confirming/);
  assert.match(fees, /Shield \(public to private\)/);
  assert.match(fees, /Unshield \(private to public\)/);
  assert.match(fees, /may be higher than Unshield/);
});

test("flat VINSS fees remain separate from wallet charges and Rekber", () => {
  assert.match(fees, /On-chain quote/);
  assert.match(fees, /Rekber:/);
  assert.match(fees, /Wallet \/ network charges/);
});
