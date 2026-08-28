import assert from "node:assert/strict";
import test from "node:test";

import type {
  AppConfig,
} from "../src/config.ts";
import {
  buildDisputeAttestationTypedData,
  sanitizeDisputeAttestations,
} from "../src/dispute/attestation.ts";
import {
  assertDisputeCaseMatchesCustody,
  parseRekberCustodyResult,
} from "../src/dispute/chain.ts";
import {
  sanitizeDisputeCase,
} from "../src/dispute/evidence.ts";

const config: AppConfig = {
  port: 8080,
  corsOrigin:
    "https://example.com",
  rpcUrl:
    "https://rpc.example.com",
  network: "sepolia",
  database: {
    url:
      "postgres://example",
    ssl: false,
  },
  contracts: {
    privacyPool: "0x1",
    messageHelper: "0x2",
    offerHelper: "0x3",
    privateEscrowHelper:
      "0x4",
    escrowRekber: "0x5",
    settlementCertificate:
      "0x6",
  },
  indexer: {
    startBlocks: {
      message: 1,
      offer: 1,
      escrow: 1,
      rekber: 1,
      certificate: 1,
    },
    pollIntervalMs: 1,
    blockRange: 1,
    eventPageSize: 1,
    fetchConcurrency: 1,
  },
  agent: {
    feeBps: 0,
    defaultProvider:
      "groq",
  },
  features: {
    agent: true,
    loyalty: false,
  },
  rateLimits: {
    windowMs: 60_000,
    discover: 10,
    agent: 10,
  },
};

function rawCase(): any {
  return {
    custodyCommitment:
      "0xabc",
    verificationClass:
      "digital_review",
    principal: {
      asset: "USDC",
      rawAmount:
        "100000000",
      usdMicros:
        100_000_000,
    },
    acceptedTerms: {
      dealType:
        "freelance",
      summary:
        "Two milestones.",
      obligations: [
        "Deliver A",
      ],
      completionCriteria: [
        "A passes acceptance",
      ],
    },
    fulfillment: {
      submitted: true,
      confirmed: true,
      evidenceCommitment:
        "0x123",
    },
    payer: {
      role: "payer",
      walletAddress:
        "0x111",
      consentToAgentReview:
        true,
      statement:
        "A is incomplete.",
      evidence: [
        {
          kind: "test",
          label: "Test",
          value: "failed",
        },
      ],
      submittedAt:
        "2026-08-28T01:00:00Z",
    },
    payee: {
      role: "payee",
      walletAddress:
        "0x222",
      consentToAgentReview:
        true,
      statement:
        "A is complete.",
      evidence: [
        {
          kind:
            "attachment",
          label: "Hash",
          value: "0xbeef",
        },
      ],
      submittedAt:
        "2026-08-28T01:01:00Z",
    },
    onChain: {
      disputed: true,
      consumed: false,
      resolutionAuthorized:
        false,
      fulfillmentSubmitted:
        true,
      fulfillmentConfirmed:
        true,
    },
  };
}

function custodyResult(): string[] {
  const result =
    Array.from(
      { length: 39 },
      () => "0x0",
    );

  result[0] = "0xabc";
  result[12] = "0x999";
  result[13] =
    "0x5f5e100";
  result[19] = "0x1";
  result[22] = "0x123";
  result[27] = "0x1";
  result[28] = "0x1";
  result[30] = "0x1";
  result[31] = "0x0";
  result[34] = "0x0";

  return result;
}

test(
  "Rekber custody parser uses the canonical struct indexes",
  () => {
    const custody =
      parseRekberCustodyResult(
        custodyResult(),
      );

    assert.equal(
      custody.custodyCommitment,
      "0xabc",
    );
    assert.equal(
      custody.amount,
      "100000000",
    );
    assert.equal(
      custody.verificationPolicy,
      1,
    );
    assert.equal(
      custody.disputed,
      true,
    );
  },
);

test(
  "client dispute snapshot must match live Rekber custody",
  () => {
    const disputeCase =
      sanitizeDisputeCase(
        rawCase(),
      );

    assert.doesNotThrow(
      () =>
        assertDisputeCaseMatchesCustody(
          disputeCase,
          parseRekberCustodyResult(
            custodyResult(),
          ),
        ),
    );

    const fake =
      rawCase();
    fake.onChain.disputed =
      false;

    assert.throws(
      () =>
        assertDisputeCaseMatchesCustody(
          sanitizeDisputeCase(
            fake,
          ),
          parseRekberCustodyResult(
            custodyResult(),
          ),
        ),
      /does not match current Rekber state/,
    );
  },
);

test(
  "SNIP-12 challenge binds case, custody, role, and wallet",
  () => {
    const disputeCase =
      sanitizeDisputeCase(
        rawCase(),
      );

    const payer =
      buildDisputeAttestationTypedData(
        config,
        disputeCase,
        "payer",
      );

    const payee =
      buildDisputeAttestationTypedData(
        config,
        disputeCase,
        "payee",
      );

    assert.equal(
      payer.message.Role,
      "Payer",
    );
    assert.equal(
      payer.message.Wallet,
      "0x111",
    );
    assert.equal(
      payee.message.Role,
      "Payee",
    );
    assert.equal(
      payee.message.Wallet,
      "0x222",
    );
    assert.equal(
      payer.message.Case,
      payee.message.Case,
    );
    assert.equal(
      payer.message.Custody,
      "0xabc",
    );
    assert.equal(
      payer.message.Consent,
      "Arbitrate",
    );
    assert.equal(
      payer.message.Execution,
      "AutoSplit",
    );
  },
);

test(
  "attestation parser rejects malformed signature felts",
  () => {
    assert.deepEqual(
      sanitizeDisputeAttestations({
        payer: [
          "0x1",
          "0x2",
        ],
        payee: [
          "0x3",
          "0x4",
        ],
      }),
      {
        payer: [
          "0x1",
          "0x2",
        ],
        payee: [
          "0x3",
          "0x4",
        ],
      },
    );

    assert.throws(
      () =>
        sanitizeDisputeAttestations({
          payer: [
            "not-a-felt",
            "0x2",
          ],
          payee: [
            "0x3",
            "0x4",
          ],
        }),
      /invalid felt/,
    );
  },
);
