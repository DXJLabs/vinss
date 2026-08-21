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
