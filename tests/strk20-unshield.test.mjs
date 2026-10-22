import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUnshieldAction,
  parseTokenUnits,
  formatTokenUnits,
} from "../frontend/lib/starknet/unshield.ts";

const STRK = "0x0042";
const SELF = "0x000abc";

test("unshield deposits nothing and invokes only native wallet withdraw", () => {
  assert.deepEqual(buildUnshieldAction({
    token: STRK, recipient: SELF, amount: "1.2500", decimals: 18,
  }), {
    type: "withdraw",
    token: "0x42",
    recipient: "0xabc",
    amount: "0x1158e460913d0000",
  });
});
test("unshield amounts use exact bigint rather than floating-point rounding", () => {
  assert.equal(parseTokenUnits("0.000001", 6), 1n);
  assert.equal(parseTokenUnits("123456789012345678.123456", 6), 123456789012345678123456n);
  assert.equal(formatTokenUnits(123450000n, 6), "123.45");
});
test("rejects exceeding token decimal precision and ambiguous values", () => {
  for (const value of ["1.0000001", "0", "0.000000", "-1", "1e3", "1,000", "", " 1", "01.5"]) {
    assert.throws(() => parseTokenUnits(value, 6), undefined, value);
  }
});
test("rejects malformed zero, negative or out-of-field recipient/token addresses", () => {
  for (const address of ["0x0", "1.5", "-1", "0xg", "0x" + "f".repeat(64), ""]) {
    assert.throws(() => buildUnshieldAction({
      token: STRK, recipient: address, amount: "1", decimals: 18,
    }), undefined, address);
    assert.throws(() => buildUnshieldAction({
      token: address, recipient: SELF, amount: "1", decimals: 18,
    }), undefined, address);
  }
});
test("rejects unsupported decimals and token amount overflow", () => {
  assert.throws(() => parseTokenUnits("1", -1));
  assert.throws(() => parseTokenUnits("1", 100));
  assert.throws(() => parseTokenUnits("1" + "0".repeat(80), 18));
});
test("fee display is exact at very small sizes", () => {
  assert.equal(formatTokenUnits(1n, 18), "0.000000000000000001");
  assert.equal(formatTokenUnits(0n, 18), "0");
});
