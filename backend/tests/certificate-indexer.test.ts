import assert from "node:assert/strict";
import test from "node:test";
import { hash } from "starknet";

import type { AppConfig } from "../src/config.ts";
import {
  createCertificateIndexerIdentity,
  decodeCertificateEvent,
} from "../src/indexer/certificate.ts";

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
      settlementCertificate: "0x6",
    },
    indexer: {
      startBlocks: {
        message: 100,
        offer: 200,
        escrow: 300,
        rekber: 400,
        certificate: 500,
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
    features: {
      agent: true,
      loyalty: false,
    },
    rateLimits: {
      windowMs: 60_000,
      discover: 120,
      agent: 12,
    },
  };
}

test("certificate indexer identity isolates network and contract", () => {
  assert.equal(
    createCertificateIndexerIdentity("sepolia", "0xabc"),
    "sepolia:certificate:0xabc",
  );

  assert.notEqual(
    createCertificateIndexerIdentity("sepolia", "0xabc"),
    createCertificateIndexerIdentity("mainnet", "0xabc"),
  );
});

test("certificate event decoder preserves public proof metadata", () => {
  const event = decodeCertificateEvent(testConfig(), {
    keys: [
      hash.getSelectorFromName("SettlementCertificateIssued"),
      "0x10",
      "0x20",
    ],
    data: ["0x30", "0x2", "0x40", "0x50"],
    block_number: 600,
    transaction_hash: "0x60",
  });

  assert.deepEqual(event, {
    network: "sepolia",
    contractAddress: "0x6",
    tokenId: "0x10",
    recipient: "0x20",
    custodyCommitment: "0x30",
    role: 2,
    settledAt: 64,
    issuedAt: 80,
    blockNumber: 600,
    transactionHash: "0x60",
    indexedAt: event?.indexedAt,
  });
});

test("certificate event decoder rejects an invalid role", () => {
  assert.equal(
    decodeCertificateEvent(testConfig(), {
      keys: [
        hash.getSelectorFromName("SettlementCertificateIssued"),
        "0x10",
        "0x20",
      ],
      data: ["0x30", "0x3", "0x40", "0x50"],
      block_number: 600,
      transaction_hash: "0x60",
    }),
    null,
  );
});
