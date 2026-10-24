import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifySepoliaUnshield } from "../frontend/scripts/verify-sepolia-unshield.mjs";

const input = { txHash: "0xabc", token: "0x111", recipient: "0x222", sender: "0x777", amountUnits: 42n, transferSelector: "0x99" };
function provider({ chain = "0x534e5f5345504f4c4941", receipt = {}, event = {} } = {}) {
  let queried = false;
  const defaults = {
    type: "INVOKE", transaction_hash: "0xabc", execution_status: "SUCCEEDED",
    finality_status: "ACCEPTED_ON_L2", block_number: 123,
    actual_fee: { amount: "0x16", unit: "FRI" },
    events: [{ from_address: "0x111", keys: ["0x99"], data: ["0x777", "0x222", "0x2a", "0x0"], ...event }],
  };
  return {
    get queried() { return queried; },
    async getChainId() { return chain; },
    async getTransactionReceipt() { queried = true; return { ...defaults, ...receipt }; },
  };
}
test("verifies accepted public INVOKE and legacy ERC-20 public payout", async () => {
  const proof = await verifySepoliaUnshield(provider(), input);
  assert.equal(proof.publicTransferUnits, "42");
  assert.equal(proof.executionStatus, "SUCCEEDED");
  assert.deepEqual(proof.networkFee, { amount: "0x16", unit: "FRI" });
  assert.equal(proof.blockNumber, 123);
});
test("supports indexed SNIP-13 Transfer, but refuses wrong recipients", async () => {
  const event = { keys: ["0x99", "0x777", "0x222"], data: ["0x2a", "0x0"] };
  assert.equal((await verifySepoliaUnshield(provider({event}), input)).publicTransferUnits, "42");
  await assert.rejects(
    verifySepoliaUnshield(provider({event: { ...event, keys: ["0x99", "0x777", "0x333"] }}), input),
    /matching ERC-20 Transfer/,
  );
});
test("rejects Mainnet RPC before requesting a transaction receipt", async () => {
  const fake = provider({chain: "0x534e5f4d41494e"});
  await assert.rejects(verifySepoliaUnshield(fake, input), /other than Starknet Sepolia/);
  assert.equal(fake.queried, false);
});
test("rejects pending, reverted, wrong-type, or mismatched receipts", async () => {
  for (const receipt of [
    {finality_status: "PRE_CONFIRMED"},
    {execution_status: "REVERTED"},
    {type: "DECLARE"},
    {transaction_hash: "0xbbb"},
  ]) await assert.rejects(verifySepoliaUnshield(provider({receipt}), input));
});
test("rejects wrong token, amount, event selector, malformed u256 limbs", async () => {
  for (const event of [
    {from_address: "0x333"},
    {data: ["0x777", "0x222", "0x2b", "0x0"]},
    {keys: ["0x98"]},
    {data: ["0x777", "0x222", "0x100000000000000000000000000000000", "0x0"]},
  ]) await assert.rejects(verifySepoliaUnshield(provider({event}), input));
});
test("never counts receipt gas as a VINSS or STRK20 protocol fee", async () => {
  const proof = await verifySepoliaUnshield(provider({
    receipt: { actual_fee: { amount: "0x10", unit: "UNKNOWN" } },
  }), input);
  assert.equal(proof.networkFee, null);
  assert.equal(Object.hasOwn(proof, "vinssFee"), false);
  assert.equal(Object.hasOwn(proof, "strk20Fee"), false);
});

test("public receipt proof rejects a payout made by a different sender", async () => {
  await assert.rejects(verifySepoliaUnshield(provider({ event: { data: ["0x888", "0x222", "0x2a", "0x0"] } }), input));
});

test("requires the sending wallet for receipt verification", async () => {
  await assert.rejects(verifySepoliaUnshield(provider(), { ...input, sender: undefined }));
});

test("CLI reaches the real public calldata builder before querying RPC", () => {
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", fileURLToPath(new URL("../frontend/scripts/verify-sepolia-unshield.mjs", import.meta.url)),
    "0xabc", "STRK", "0x222", "1", "0x777",
  ], { encoding: "utf8", env: { ...process.env,
    NEXT_PUBLIC_STARKNET_NETWORK: "sepolia", NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:1",
    NEXT_PUBLIC_STRK_ADDRESS: "invalid-token",
  } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid Starknet hex address/);
  assert.doesNotMatch(result.stderr, /is not a function/);
});
