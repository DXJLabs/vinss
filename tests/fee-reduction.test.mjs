import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("lower only messaging, offer and room fees while preserving Rekber floor", () => {
  const types = readFileSync(new URL("../contracts/src/fee_policy/types.cairo", import.meta.url), "utf8");
  const values = Object.fromEntries(
    [...types.matchAll(/^pub const (\w+_USD_MICROS): u128 = ([\d_]+)_u128;/gm)]
      .map((match) => [match[1], BigInt(match[2].replaceAll("_", ""))]),
  );
  assert.equal(values.ROOM_ACTIVATION_USD_MICROS, 50_000n);
  assert.equal(values.MESSAGE_USD_MICROS, 10_000n);
  assert.equal(values.OFFER_USD_MICROS, 50_000n);
  assert.equal(values.REKBER_MIN_USD_MICROS, 750_000n);
  assert.match(types, /REKBER_RESERVED_SPONSORED_ACTIONS: u128 = 6_u128/);
  assert.match(types, /FLAT_SPONSOR_MARGIN_MULTIPLIER: u128 = 2_u128/);
});

test("Rekber 2% and reserve calculation remain present", () => {
  const contract = readFileSync(new URL("../contracts/src/escrow_rekber/vinss_escrow_rekber.cairo", import.meta.url), "utf8");
  assert.match(contract, /percentage_fee/);
  assert.match(contract, /50_u128|50,/);
  assert.match(contract, /quote_fee_usd_micros/);
});
