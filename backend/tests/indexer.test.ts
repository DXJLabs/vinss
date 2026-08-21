import assert from "node:assert/strict";
import test from "node:test";

import type { AppConfig } from "../src/config.ts";
import {
  createIndexerDefinitions,
  createIndexerIdentity,
} from "../src/indexer/definitions.ts";

function testConfig(): AppConfig {
  return {
    port: 4000,
    corsOrigin: "http://localhost:3000",
    rpcUrl: "https://example.invalid/rpc",
    network: "sepolia",
    database: {
      url: "postgresql://example.invalid/vinss",
      ssl: false,
    },
    contracts: {
      privacyPool: "0x1",
      messageHelper: "0x2",
      offerHelper: "0x3",
      privateEscrowHelper: "0x4",
      escrowRekber: "0x5",
    },
    indexer: {
      startBlocks: {
        message: 100,
        offer: 200,
        escrow: 300,
      },
      pollIntervalMs: 5_000,
      blockRange: 2_000,
      eventPageSize: 100,
      fetchConcurrency: 4,
    },
    agent: {
      feeBps: 25,
      defaultProvider: "groq",
    },
  };
}

test("indexer identity isolates network, kind and contract", () => {
  assert.equal(
    createIndexerIdentity("sepolia", "offer", "0xabc"),
    "sepolia:offer:0xabc",
  );

  assert.notEqual(
    createIndexerIdentity("sepolia", "offer", "0xabc"),
    createIndexerIdentity("mainnet", "offer", "0xabc"),
  );

  assert.notEqual(
    createIndexerIdentity("sepolia", "offer", "0xabc"),
    createIndexerIdentity("sepolia", "message", "0xabc"),
  );
});

test("definitions use explicit helper start blocks", () => {
  const definitions = createIndexerDefinitions(testConfig());

  assert.deepEqual(
    definitions.map((definition) => [
      definition.kind,
      definition.startBlock,
      definition.contractAddress,
    ]),
    [
      ["message", 100, "0x2"],
      ["offer", 200, "0x3"],
      ["escrow", 300, "0x4"],
    ],
  );
});
