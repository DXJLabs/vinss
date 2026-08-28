import assert from "node:assert/strict";
import test from "node:test";

import {
  basePointsForAction,
  calculateRekberReward,
  certificateMultiplierBps,
  resolutionShareBps,
} from "../src/loyalty/rules.ts";

test("canonical base points match VINSS loyalty design", () => {
  assert.equal(basePointsForAction("message_sent"), 1);
  assert.equal(basePointsForAction("offer_created"), 5);
  assert.equal(basePointsForAction("offer_countered"), 5);
  assert.equal(basePointsForAction("offer_accepted"), 10);
  assert.equal(basePointsForAction("work_submitted"), 10);
  assert.equal(basePointsForAction("work_reviewed"), 10);
  assert.equal(basePointsForAction("referral_joined"), 25);
  assert.equal(basePointsForAction("referral_activated"), 25);
  assert.equal(basePointsForAction("referral_converted"), 100);
});

test("certificate multiplier tiers match VINSS design", () => {
  assert.equal(certificateMultiplierBps(0), 10_000);
  assert.equal(certificateMultiplierBps(1), 11_000);
  assert.equal(certificateMultiplierBps(3), 12_000);
  assert.equal(certificateMultiplierBps(6), 13_500);
  assert.equal(certificateMultiplierBps(11), 15_000);
  assert.equal(certificateMultiplierBps(26), 17_500);
  assert.equal(certificateMultiplierBps(51), 20_000);
});

test("normal release gets full Rekber reward", () => {
  assert.equal(
    calculateRekberReward({ outcome: "released", certificateCount: 0 }),
    100,
  );
  assert.equal(
    calculateRekberReward({ outcome: "released", certificateCount: 7 }),
    135,
  );
});

test("refund gives zero successful Rekber points", () => {
  assert.equal(
    calculateRekberReward({ outcome: "refunded", certificateCount: 51 }),
    0,
  );
});

test("resolved points use pre-fee 30:70 decision split", () => {
  const split = resolutionShareBps(30n, 70n);
  assert.deepEqual(split, { payerBps: 3000, payeeBps: 7000 });

  assert.equal(
    calculateRekberReward({
      outcome: "resolved",
      certificateCount: 1,
      shareBps: split.payerBps,
    }),
    33,
  );

  assert.equal(
    calculateRekberReward({
      outcome: "resolved",
      certificateCount: 6,
      shareBps: split.payeeBps,
    }),
    94,
  );
});
