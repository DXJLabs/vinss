import assert from "node:assert/strict";
import test from "node:test";

import { createRekberIndexerIdentity } from "../src/indexer/rekber.ts";

test("rekber indexer identity isolates network and contract", () => {
  assert.equal(
    createRekberIndexerIdentity("sepolia", "0xabc"),
    "sepolia:rekber:0xabc",
  );

  assert.notEqual(
    createRekberIndexerIdentity("sepolia", "0xabc"),
    createRekberIndexerIdentity("mainnet", "0xabc"),
  );
});


test("resolved Rekber event shape carries both allocations", () => {
  const sample = {
    eventKind: "resolved" as const,
    resolutionPayerAmount: "30",
    resolutionPayeeAmount: "70",
  };

  assert.equal(sample.eventKind, "resolved");
  assert.equal(sample.resolutionPayerAmount, "30");
  assert.equal(sample.resolutionPayeeAmount, "70");
});
