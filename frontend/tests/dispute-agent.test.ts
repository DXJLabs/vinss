import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDisputeAgentCase,
  createDisputeAgentPacket,
} from "../lib/deal-room/disputeAgent";
import type {
  RekberCustodyState,
} from "../lib/deal-room/settlement";

function state():
  RekberCustodyState {
  return {
    custodyCommitment: 1n,
    releaseAuthorizationCommitment: 2n,
    payeeClaimCommitment: 3n,
    refundCommitment: 4n,
    payerConfirmationCommitment: 5n,
    payerDisputeCommitment: 6n,
    payeeDisputeCommitment: 7n,
    payeeRefundConsentCommitment: 8n,
    fulfillmentChainHead: 9n,
    revisionChainHead: 10n,
    payerCertificateCommitment: 11n,
    payeeCertificateCommitment: 12n,
    token: "0x123",
    amount: 100_000_000n,
    feeAmount: 2n,
    refundAfter: 1_000,
    reviewWindow: 300,
    reviewDeadline: 600,
    revisionDeadline: 0,
    verificationPolicy: 1,
    fulfillmentRoundsRemaining: 1,
    revisionRoundsRemaining: 1,
    fulfillmentEvidenceCommitment: 99n,
    disputeEvidenceCommitment: 100n,
    resolutionCommitment: 0n,
    resolutionPayerAmount: 0n,
    resolutionPayeeAmount: 0n,
    fulfillmentSubmitted: true,
    fulfillmentConfirmed: true,
    revisionPending: false,
    disputed: true,
    resolutionAuthorized: false,
    resolutionPayerClaimed: false,
    resolutionPayeeClaimed: false,
    consumed: false,
    refunded: false,
    createdAt: 100,
    fulfilledAt: 200,
    settledAt: 0,
  };
}

test(
  "dispute Agent case contains accepted terms and explicit evidence only",
  () => {
    const payer =
      createDisputeAgentPacket(
        "payer",
        "0x111",
        "Milestone B failed acceptance.",
      );
    const payee =
      createDisputeAgentPacket(
        "payee",
        "0x222",
        "Milestone B was delivered.",
      );

    const result =
      buildDisputeAgentCase({
        custodyCommitment:
          1n,
        state: state(),
        offerSnapshot: {
          acceptedOfferLocator:
            "0xabc",
          termsOfferLocator:
            "0xdef",
          dealType:
            "freelance",
          asset: "USDC",
          amount: "100",
          paymentTerms:
            "Deliver A and B",
          conditions:
            "Both milestones pass acceptance",
        },
        payerPacket: payer,
        payeePacket: payee,
      });

    assert.equal(
      result.principal.rawAmount,
      "100000000",
    );
    assert.equal(
      result.acceptedTerms
        .obligations[0],
      "Deliver A and B",
    );
    assert.equal(
      result.payer.statement,
      "Milestone B failed acceptance.",
    );

    const serialized =
      JSON.stringify(result);

    assert.equal(
      serialized.includes(
        "roomSecret",
      ),
      false,
    );
    assert.equal(
      serialized.includes(
        "channelKey",
      ),
      false,
    );
  },
);
