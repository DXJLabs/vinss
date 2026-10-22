import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { formatLiveFeeStrk, createLiveFeeRow } from "../frontend/lib/starknet/feeQuoteView.ts";

test("live on-chain STRK quotes use exact bigint conversion", () => {
  assert.equal(formatLiveFeeStrk(10n ** 18n), "1 STRK");
  assert.equal(formatLiveFeeStrk(2_500_000_000_000_000n), "0.0025 STRK");
  assert.equal(formatLiveFeeStrk(1n), "0.000000000000000001 STRK");
  assert.throws(() => formatLiveFeeStrk(-1n));
});

test("transfer amount never appears as service fee", () => {
  assert.deepEqual(createLiveFeeRow("message", 5n * 10n ** 18n), {
    id: "message", label: "Message", serviceFee: "5 STRK",
  });
});

test("fees UI fetches active FeePolicy quotes instead of treating source prices as deployed fees", () => {
  const page = readFileSync(new URL("../frontend/app/fees/page.tsx", import.meta.url), "utf8");
  assert.match(page, /quoteMessageFee/);
  assert.match(page, /quoteOfferFee/);
  assert.match(page, /quoteRoomActivationFee/);
  assert.match(page, /On-chain quote/);
  assert.match(page, /may exceed the base/);
  assert.match(page, /Wallet \/ network charges/);
  assert.doesNotMatch(page, /quoteRekberWorkflowFee/);
});
