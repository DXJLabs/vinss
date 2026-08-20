import assert from "node:assert/strict";
import {
  describe,
  test,
} from "node:test";

import {
  buildEscrowOfferSnapshot,
  parseSettlementAmount,
  resolveSettlementAsset,
} from "../lib/deal-room/escrowSettlement";
import type {
  DealType,
  OfferActionPayload,
} from "../types/deal-room";

/**
 * Accepted Offer -> Escrow Rekber user scenarios.
 *
 * These are logic/integration tests, not browser tests. They validate the
 * production mapping used before Rekber receives public settlement calldata.
 *
 * The business-specific agreement remains in the encrypted Offer snapshot.
 * Rekber itself only receives the settlement token, base-unit amount,
 * commitments and refund boundary.
 */

function acceptedOffer(input: {
  dealType: DealType;
  asset: "STRK" | "USDC";
  amount: string;
  paymentTerms: string;
  conditions: string;
}): OfferActionPayload {
  return {
    kind: "accept",
    senderAddress: "0x111",
    recipientAddress: "0x222",
    sentAt: "2026-08-21T00:00:00.000Z",
    rootOfferLocator: "0xaaa",
    parentOfferLocator: "0xbbb",
    dealType: input.dealType,
    asset: input.asset,
    amount: input.amount,
    paymentTerms: input.paymentTerms,
    conditions: input.conditions,
  };
}

function settlementBaseUnits(
  action: OfferActionPayload,
): bigint {
  const settlement =
    resolveSettlementAsset(action.asset);

  assert.ok(
    settlement,
    `Unsupported settlement asset: ${action.asset}`,
  );

  return parseSettlementAmount(
    action.amount,
    settlement.decimals,
  );
}

describe(
  "Accepted Offer -> Escrow Rekber user scenarios",
  () => {
    test(
      "Freelance: 500 USDC payment keeps deliverables private and settles 500 USDC",
      () => {
        const action = acceptedOffer({
          dealType: "freelance",
          asset: "USDC",
          amount: "500",
          paymentTerms:
            "Build a responsive landing page. Delivery deadline: 2026-08-30.",
          conditions:
            "Deliver responsive website, source code and production build. Maximum 2 revisions.",
        });

        const snapshot =
          buildEscrowOfferSnapshot(
            "0xaccept-freelance",
            action,
          );

        assert.equal(
          snapshot.dealType,
          "freelance",
        );
        assert.equal(
          snapshot.asset,
          "USDC",
        );
        assert.equal(
          snapshot.amount,
          "500",
        );
        assert.equal(
          snapshot.termsOfferLocator,
          "0xbbb",
        );
        assert.equal(
          snapshot.conditions,
          action.conditions,
        );

        assert.equal(
          resolveSettlementAsset(
            snapshot.asset,
          )?.symbol,
          "USDC",
        );

        assert.equal(
          settlementBaseUnits(action),
          500_000000n,
        );
      },
    );

    test(
      "NFT: escrows 200 USDC payment, not the NFT itself",
      () => {
        const action = acceptedOffer({
          dealType: "nft",
          asset: "USDC",
          amount: "200",
          paymentTerms:
            "Buy Example Collection token #1234 for 200 USDC.",
          conditions:
            "Exact NFT #1234 must be transferred to the buyer before the transfer deadline.",
        });

        const snapshot =
          buildEscrowOfferSnapshot(
            "0xaccept-nft",
            action,
          );

        assert.equal(
          snapshot.dealType,
          "nft",
        );
        assert.match(
          snapshot.conditions ?? "",
          /NFT #1234/,
        );

        // The NFT remains a private transfer condition.
        // Rekber escrows the accepted payment token only.
        assert.equal(
          resolveSettlementAsset(
            snapshot.asset,
          )?.symbol,
          "USDC",
        );
        assert.equal(
          settlementBaseUnits(action),
          200_000000n,
        );
      },
    );

    test(
      "Goods: 100 USDC purchase keeps delivery and inspection terms private",
      () => {
        const action = acceptedOffer({
          dealType: "goods",
          asset: "USDC",
          amount: "100",
          paymentTerms:
            "One mechanical keyboard, courier delivery before 2026-08-27.",
          conditions:
            "Buyer has a 2-day inspection window after delivery.",
        });

        const snapshot =
          buildEscrowOfferSnapshot(
            "0xaccept-goods",
            action,
          );

        assert.equal(
          snapshot.dealType,
          "goods",
        );
        assert.equal(
          snapshot.paymentTerms,
          action.paymentTerms,
        );
        assert.equal(
          snapshot.conditions,
          action.conditions,
        );
        assert.equal(
          settlementBaseUnits(action),
          100_000000n,
        );
      },
    );

    test(
      "Bounty: 75 USDC reward settles while success criteria stay private",
      () => {
        const action = acceptedOffer({
          dealType: "bounty",
          asset: "USDC",
          amount: "75",
          paymentTerms:
            "Fix issue #42 before the agreed deadline.",
          conditions:
            "Tests must pass and the submitted pull request must be accepted.",
        });

        const snapshot =
          buildEscrowOfferSnapshot(
            "0xaccept-bounty",
            action,
          );

        assert.equal(
          snapshot.dealType,
          "bounty",
        );
        assert.match(
          snapshot.conditions ?? "",
          /Tests must pass/,
        );
        assert.equal(
          settlementBaseUnits(action),
          75_000000n,
        );
      },
    );

    test(
      "OTC: 1000 STRK is the Rekber asset while fiat confirmation remains off-chain",
      () => {
        const action = acceptedOffer({
          dealType: "otc",
          asset: "STRK",
          amount: "1000",
          paymentTerms:
            "Sell 1000 STRK for agreed IDR payment via bank transfer.",
          conditions:
            "Fiat transfer must be confirmed before crypto settlement.",
        });

        const snapshot =
          buildEscrowOfferSnapshot(
            "0xaccept-otc",
            action,
          );

        assert.equal(
          snapshot.dealType,
          "otc",
        );
        assert.equal(
          snapshot.asset,
          "STRK",
        );
        assert.match(
          snapshot.conditions ?? "",
          /Fiat transfer/,
        );

        assert.equal(
          resolveSettlementAsset(
            snapshot.asset,
          )?.symbol,
          "STRK",
        );

        // 1000 STRK * 10^18 base units.
        assert.equal(
          settlementBaseUnits(action),
          1_000n * 10n ** 18n,
        );
      },
    );
  },
);
