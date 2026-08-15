import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOffer, calculateFee, draftCounterOffer, executeTool, getToolDefinitions } from "../src/agent/tools.ts";

test("fee calculation is deterministic", () => {
  assert.deepEqual(calculateFee("10000", 25), { amount: 10000, feeBps: 25, fee: 25, total: 10025 });
});

test("offer analysis flags missing settlement terms", () => {
  const result = analyzeOffer({ latestOffer: { asset: "USDC", amount: "50000", paymentTerms: "", conditions: "Delivery confirmed" } });
  assert.equal(result.riskLevel, "watch");
  assert.match(result.findings[0]!, /Payment timing/);
});

test("counter offer is a draft only", () => {
  const result = draftCounterOffer({ latestOffer: { asset: "USDC", amount: "48000", paymentTerms: "7 days" } }, "50000", "14 days");
  assert.deepEqual(result, { asset: "USDC", amount: "50000", paymentTerms: "14 days", conditions: "Confirm settlement deadline before signing.", basedOn: "48000" });
});

test("agent tool allowlist has no transaction execution tools", () => {
  const names = getToolDefinitions().map((tool) => tool.function.name);
  assert.deepEqual(names.sort(), ["analyze_offer", "calculate_fee", "draft_counter_offer"].sort());
  assert.throws(() => executeTool("send_transaction", {}, {}, 25), /Tool not allowed/);
});
