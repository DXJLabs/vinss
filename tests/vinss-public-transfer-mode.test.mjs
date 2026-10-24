import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildPublicTransferCall } from "../frontend/lib/starknet/publicTransfer.ts";

test("Unshield mode forms a PUBLIC ERC20 transfer, not STRK20 note withdraw",()=>{
  assert.deepEqual(buildPublicTransferCall({
    token:"0x0042",recipient:"0x000abc",amount:"1.2500",decimals:18,
  }),{contractAddress:"0x42",entrypoint:"transfer",
    calldata:["0xabc","0x1158e460913d0000","0x0"]});
});
test("calldata preserves amounts above 128 bits via low/high limbs",()=>{
  const tx=buildPublicTransferCall({token:"0x1",recipient:"0x2",
    amount:"340282366920938463463.374607431768211456",decimals:18});
  assert.deepEqual(tx.calldata,["0x2","0x0","0x1"]);
});
test("reject zero, malformed, rounded or negative principal and invalid addresses",()=>{
  for(const amount of ["0","-1","1e5","0.0000001",""," 1"]) {
    assert.throws(()=>buildPublicTransferCall({token:"0x1",recipient:"0x2",amount,decimals:6}));
  }
  assert.throws(()=>buildPublicTransferCall({token:"0x0",recipient:"0x2",amount:"1",decimals:6}));
  assert.throws(()=>buildPublicTransferCall({token:"0x1",recipient:"0x0",amount:"1",decimals:6}));
});
test("connected public wallet execution is present; no fake STRK20 fee transfer",()=>{
  const ui=readFileSync(new URL("../frontend/components/room/escrow/PublicTransferPanel.tsx",import.meta.url),"utf8");
  assert.match(ui,/session.account.execute\(call\)/);
  assert.doesNotMatch(ui,/strk20InvokeTransaction\(/);
  assert.doesNotMatch(ui,/type:\s*["']withdraw["']/);
});
