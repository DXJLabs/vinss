import assert from "node:assert/strict";
import test from "node:test";

import {
  canAuthorizeMutualRefundConsent,
  canAutoReleaseRekber,
  canClaimRekberResolution,
  canCompleteMutualRefund,
  canConfirmCounterpartyFulfillment,
  canOpenRekberDispute,
  canTimeoutRefundRekber,
} from "../lib/deal-room/rekberProtection";
import type {
  RekberCustodyState,
} from "../lib/deal-room/settlement";

function custody(
  overrides: Partial<RekberCustodyState> = {},
): RekberCustodyState {
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
    amount: 100n,
    feeAmount: 2n,
    refundAfter: 1_000,
    reviewWindow: 300,
    reviewDeadline: 0,
    revisionDeadline: 0,
    verificationPolicy: 1,
    fulfillmentRoundsRemaining: 2,
    revisionRoundsRemaining: 1,
    fulfillmentEvidenceCommitment: 0n,
    disputeEvidenceCommitment: 0n,
    resolutionCommitment: 0n,
    resolutionPayerAmount: 0n,
    resolutionPayeeAmount: 0n,
    fulfillmentSubmitted: false,
    fulfillmentConfirmed: false,
    revisionPending: false,
    disputed: false,
    resolutionAuthorized: false,
    resolutionPayerClaimed: false,
    resolutionPayeeClaimed: false,
    consumed: false,
    refunded: false,
    createdAt: 100,
    fulfilledAt: 0,
    settledAt: 0,
    ...overrides,
  };
}

test(
  "payer timeout refund is available only before fulfillment",
  () => {
    assert.equal(
      canTimeoutRefundRekber(
        custody(),
        true,
      ),
      true,
    );

    assert.equal(
      canTimeoutRefundRekber(
        custody({
          fulfillmentSubmitted: true,
        }),
        true,
      ),
      false,
    );

    assert.equal(
      canTimeoutRefundRekber(
        custody({
          disputed: true,
        }),
        true,
      ),
      false,
    );
  },
);

test(
  "counterparty-confirm policy requires payer receipt confirmation",
  () => {
    const state = custody({
      verificationPolicy: 2,
      fulfillmentSubmitted: true,
      fulfillmentEvidenceCommitment: 99n,
    });

    assert.equal(
      canConfirmCounterpartyFulfillment(
        state,
        "payer",
      ),
      true,
    );

    assert.equal(
      canConfirmCounterpartyFulfillment(
        state,
        "payee",
      ),
      false,
    );
  },
);

test(
  "submitted fulfillment may enter dispute before review closes",
  () => {
    assert.equal(
      canOpenRekberDispute(
        custody({
          fulfillmentSubmitted: true,
          fulfillmentConfirmed: false,
        }),
        500,
      ),
      true,
    );

    assert.equal(
      canOpenRekberDispute(
        custody({
          fulfillmentSubmitted: true,
          fulfillmentConfirmed: true,
          reviewDeadline: 600,
        }),
        599,
      ),
      true,
    );

    // Cairo makes AUTO_RELEASE valid exactly at the deadline.
    assert.equal(
      canOpenRekberDispute(
        custody({
          fulfillmentSubmitted: true,
          fulfillmentConfirmed: true,
          reviewDeadline: 600,
        }),
        600,
      ),
      false,
    );
  },
);

test(
  "confirmed fulfillment protects payee from payer silence",
  () => {
    const state = custody({
      fulfillmentSubmitted: true,
      fulfillmentConfirmed: true,
      reviewDeadline: 600,
    });

    assert.equal(
      canAutoReleaseRekber(
        state,
        "payee",
        599,
      ),
      false,
    );

    assert.equal(
      canAutoReleaseRekber(
        state,
        "payee",
        600,
      ),
      true,
    );

    assert.equal(
      canAutoReleaseRekber(
        {
          ...state,
          disputed: true,
        },
        "payee",
        600,
      ),
      false,
    );
  },
);

test(
  "authorized dispute split is claimed only by the allocated side",
  () => {
    const split = custody({
      fulfillmentSubmitted: true,
      disputed: true,
      resolutionAuthorized: true,
      resolutionPayerAmount: 40n,
      resolutionPayeeAmount: 60n,
    });

    assert.equal(
      canClaimRekberResolution(
        split,
        "payer",
      ),
      true,
    );
    assert.equal(
      canClaimRekberResolution(
        split,
        "payee",
      ),
      true,
    );

    assert.equal(
      canClaimRekberResolution(
        {
          ...split,
          resolutionPayerClaimed: true,
        },
        "payer",
      ),
      false,
    );

    assert.equal(
      canClaimRekberResolution(
        {
          ...split,
          resolutionPayeeAmount: 0n,
          resolutionPayeeClaimed: true,
        },
        "payee",
      ),
      false,
    );
  },
);


test(
  "mutual refund requires Payee authorization and Payer completion",
  () => {
    const open = custody({
      fulfillmentSubmitted: true,
      fulfillmentConfirmed: true,
    });

    assert.equal(
      canAuthorizeMutualRefundConsent(
        open,
        "payee",
      ),
      true,
    );
    assert.equal(
      canAuthorizeMutualRefundConsent(
        open,
        "payer",
      ),
      false,
    );

    assert.equal(
      canCompleteMutualRefund(
        open,
        "payer",
      ),
      true,
    );
    assert.equal(
      canCompleteMutualRefund(
        open,
        "payee",
      ),
      false,
    );

    const resolved = {
      ...open,
      disputed: true,
      resolutionAuthorized: true,
    };

    assert.equal(
      canAuthorizeMutualRefundConsent(
        resolved,
        "payee",
      ),
      false,
    );
    assert.equal(
      canCompleteMutualRefund(
        resolved,
        "payer",
      ),
      false,
    );
  },
);
