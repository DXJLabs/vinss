import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { buildShieldAction } from "../frontend/lib/starknet/unshield.ts";
test("original STRK20 deposit remains a native wallet primitive", () => {
  assert.deepEqual(buildShieldAction({token:"0x0042",amount:"1.2500",decimals:18}),{
    type:"deposit",token:"0x42",amount:"0x1158e460913d0000",
  });
});
test("Shield is the in-room default, with a real Unshield public alternative", () => {
  const room=readFileSync(new URL("../frontend/app/room/[roomId]/page.tsx",import.meta.url),"utf8");
  const home=readFileSync(new URL("../frontend/app/page.tsx",import.meta.url),"utf8");
  const wallet=readFileSync(new URL("../frontend/components/WalletConnectButton.tsx",import.meta.url),"utf8");
  assert.match(room,/useState<TransactionMode>\("shield"\)/);
  assert.match(room,/aria-label="Payment mode"/);
  assert.match(room,/Shield · STRK20/);
  assert.match(room,/Unshield · Public/);
  assert.match(room,/paymentMode === "shield" \? \(/);
  assert.match(room,/<EscrowPanel/);
  assert.match(room,/<PublicTransferPanel/);
  assert.doesNotMatch(home,/href="\/shield"|href="\/unshield"/);
  assert.doesNotMatch(wallet,/href="\/shield"|href="\/unshield"/);
  assert.equal(existsSync(new URL("../frontend/app/shield/page.tsx",import.meta.url)),false);
  assert.equal(existsSync(new URL("../frontend/app/unshield/page.tsx",import.meta.url)),false);
});
