import assert from "node:assert/strict";
import test from "node:test";
import { auditSepoliaFees } from "../frontend/scripts/audit-sepolia-fees.mjs";
const SEPOLIA = "0x534e5f5345504f4c4941";
const addresses = { roomActivation: "0x1", message: "0x2", offer: "0x3" };

function fakeProvider(chainId = SEPOLIA, quotedFee = "5000000000000000000") {
  const calls = [];
  return {
    calls,
    async getChainId() { return chainId; },
    async callContract(request) {
      calls.push(request);
      if (request.entrypoint === "get_fee_policy") return ["0x40"];
      if (request.entrypoint === "quote_fee") return [quotedFee];
      if (request.entrypoint === "quote_fee_usd_micros") return ["600000"];
      throw Error("unexpected contract call");
    },
  };
}

test("audits all three active helper-linked Sepolia fee quotes without any write method", async () => {
  const provider = fakeProvider();
  const rows = await auditSepoliaFees(provider, addresses);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.action), ["roomActivation", "message", "offer"]);
  assert.ok(rows.every(row => row.feePolicy === "0x40" && row.wei === 5000000000000000000n));
  assert.deepEqual(provider.calls.filter(call => call.entrypoint === "quote_fee").map(call => call.calldata[0]), ["0x1", "0x2", "0x3"]);
});
test("refuses Mainnet RPC even when supplied Sepolia-labelled addresses", async () => {
  await assert.rejects(auditSepoliaFees(fakeProvider("0x534e5f4d41494e"), addresses), /Sepolia/i);
});
test("refuses missing helper address and a zero on-chain quote", async () => {
  await assert.rejects(auditSepoliaFees(fakeProvider(), { ...addresses, offer: "" }), /offer/i);
  await assert.rejects(auditSepoliaFees(fakeProvider(SEPOLIA, "0"), addresses), /quote/i);
});
