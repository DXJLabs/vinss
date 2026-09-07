import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLoyalty,
  getCertificateMultiplier,
} from "../src/loyalty/service.js";

test(
  "certificate multiplier follows VINSS Loyalty tiers",
  () => {
    assert.equal(
      getCertificateMultiplier(0),
      1,
    );
    assert.equal(
      getCertificateMultiplier(1),
      1.25,
    );
    assert.equal(
      getCertificateMultiplier(2),
      1.25,
    );
    assert.equal(
      getCertificateMultiplier(3),
      1.5,
    );
    assert.equal(
      getCertificateMultiplier(5),
      1.75,
    );
    assert.equal(
      getCertificateMultiplier(10),
      2,
    );
    assert.equal(
      getCertificateMultiplier(50),
      2,
    );
  },
);

test(
  "loyalty points are settlement based",
  () => {
    assert.deepEqual(
      calculateLoyalty({
        certificateCount: 3,
        successfulSettlements: 3,
      }),
      {
        points: 900,
        basePoints: 600,
        certificateCount: 3,
        successfulSettlements: 3,
        multiplier: 1.5,
        nextCertificateTarget: 5,
        nextMultiplier: 1.75,
      },
    );
  },
);

test(
  "loyalty multiplier is capped at 2x",
  () => {
    const loyalty =
      calculateLoyalty({
        certificateCount: 15,
        successfulSettlements: 15,
      });

    assert.equal(
      loyalty.multiplier,
      2,
    );
    assert.equal(
      loyalty.nextCertificateTarget,
      null,
    );
    assert.equal(
      loyalty.nextMultiplier,
      null,
    );
  },
);
