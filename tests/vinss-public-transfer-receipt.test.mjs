import assert from "node:assert/strict";
import test from "node:test";
import { verifyPublicTransferReceipt } from "../frontend/lib/starknet/publicTransferReceipt.ts";

const expected = { transactionHash: "0xabc", token: "0x111", sender: "0x777", recipient: "0x222", amountUnits: 42n, transferSelector: "0x99" };
const event = { from_address: "0x111", keys: ["0x99"], data: ["0x777", "0x222", "0x2a", "0x0"] };
const receipt = { type: "INVOKE", transaction_hash: "0xabc", execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L2", events: [event], actual_fee: { amount: "0x16", unit: "FRI" } };

test("confirms the exact public transfer and reports network gas separately", () => {
  assert.deepEqual(verifyPublicTransferReceipt(receipt, expected), { status: "confirmed", networkFee: { amount: 22n, unit: "FRI" } });
  const indexed = { ...event, keys: ["0x99", "0x777", "0x222"], data: ["0x2a", "0x0"] };
  assert.equal(verifyPublicTransferReceipt({ ...receipt, events: [indexed] }, expected).status, "confirmed");
});
test("refuses a matching payout from the wrong sender", () => {
  assert.throws(() => verifyPublicTransferReceipt({ ...receipt, events: [{ ...event, data: ["0x888", "0x222", "0x2a", "0x0"] }] }, expected), /matching ERC-20 Transfer/);
});
test("pending and reverted are never confirmed, including pre-confirmed success", () => {
  assert.deepEqual(verifyPublicTransferReceipt({ ...receipt, finality_status: "PRE_CONFIRMED" }, expected), { status: "pending" });
  assert.deepEqual(verifyPublicTransferReceipt({ ...receipt, execution_status: "REVERTED" }, expected), { status: "reverted" });
  assert.deepEqual(verifyPublicTransferReceipt({ ...receipt, finality_status: "PRE_CONFIRMED", execution_status: "REVERTED" }, expected), { status: "pending" });
});
test("rejects wrong hash, type, token, amount, recipient, selector and invalid limbs", () => {
  for (const patch of [{ transaction_hash: "0xdef" }, { type: "DECLARE" }, { events: [] }]) {
    assert.throws(() => verifyPublicTransferReceipt({ ...receipt, ...patch }, expected));
  }
  for (const patch of [{ from_address: "0x333" }, { keys: ["0x98"] }, { data: ["0x777", "0x333", "0x2a", "0x0"] }, { data: ["0x777", "0x222", "0x2b", "0x0"] }, { data: ["0x777", "0x222", "0x100000000000000000000000000000000", "0x0"] }]) {
    assert.throws(() => verifyPublicTransferReceipt({ ...receipt, events: [{ ...event, ...patch }] }, expected));
  }
});
test("unrelated or malformed events do not hide a later matching transfer", () => {
  assert.equal(verifyPublicTransferReceipt({ ...receipt, events: [{ keys: [], data: [] }, null, event] }, expected).status, "confirmed");
});
test("unknown or malformed gas never becomes a VINSS fee", () => {
  for (const actual_fee of [{ amount: "0x10", unit: "UNKNOWN" }, { amount: "bad", unit: "FRI" }, null]) {
    assert.deepEqual(verifyPublicTransferReceipt({ ...receipt, actual_fee }, expected), { status: "confirmed", networkFee: null });
  }
});
