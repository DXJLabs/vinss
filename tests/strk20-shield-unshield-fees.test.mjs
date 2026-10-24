import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const panel=readFileSync(new URL("../frontend/components/room/escrow/PublicTransferPanel.tsx",import.meta.url),"utf8");
const fees=readFileSync(new URL("../frontend/app/fees/page.tsx",import.meta.url),"utf8");
test("public transfer principal, VINSS revenue and wallet gas are distinct",()=>{
  assert.match(panel,/Public transfer principal/);
  assert.match(panel,/VINSS transfer service fee/);
  assert.match(panel,/Starknet network fee/);
  assert.match(panel,/public payment has no escrow/);
  assert.match(panel,/Submitted, not yet confirmed/);
});
test("private STRK20 is not conflated with public payment or Rekber fees",()=>{
  assert.match(fees,/Shield \(STRK20 private mode\)/);
  assert.match(fees,/Unshield \(ordinary public mode\)/);
  assert.match(fees,/Rekber:/);
  assert.match(fees,/On-chain quote/);
  assert.match(fees,/Wallet \/ network charges/);
});
