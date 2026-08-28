import assert from "node:assert/strict";
import test from "node:test";

import {
  computeResolutionAmounts,
} from "../src/dispute/executor.ts";

test(
  "resolver split preserves every principal unit",
  () => {
    const result =
      computeResolutionAmounts(
        101n,
        3333,
        6667,
      );

    assert.equal(
      result.payerAmount,
      33n,
    );
    assert.equal(
      result.payeeAmount,
      68n,
    );
    assert.equal(
      result.payerAmount +
        result.payeeAmount,
      101n,
    );
  },
);

test(
  "resolver rejects a non-10000 bps split",
  () => {
    assert.throws(
      () =>
        computeResolutionAmounts(
          100n,
          5000,
          4999,
        ),
      /Invalid dispute resolution split/,
    );
  },
);
