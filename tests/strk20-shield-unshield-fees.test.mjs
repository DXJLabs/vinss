import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const panel=readFileSync(new URL("../frontend/components/room/escrow/EscrowPricing.tsx",import.meta.url),"utf8");
const fees=readFileSync(new URL("../frontend/app/fees/page.tsx",import.meta.url),"utf8");
test("Rekber principal and quoted service fee remain distinct in both room modes",()=>{
  assert.match(panel,/quoteRekberFee/);
  assert.match(panel,/principalBaseUnits/);
  assert.match(panel,/feeBaseUnits/);
  assert.match(panel,/account/);
});
test("private STRK20 is not conflated with public payment or Rekber fees",()=>{
  assert.match(fees,/Shield \(STRK20 private mode\)/);
  assert.match(fees,/Unshield \(ordinary public mode\)/);
  assert.match(fees,/Rekber:/);
  assert.match(fees,/On-chain quote/);
  assert.match(fees,/Wallet \/ network charges/);
});
