import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDisputeAgentDecision,
} from "../src/dispute/decision.ts";
import {
  computeDisputeCaseCommitment,
  sanitizeDisputeCase,
} from "../src/dispute/evidence.ts";
import {
  decisionForDisputeExecution,
  evaluateDisputePolicy,
} from "../src/dispute/policy.ts";

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
        "Build two agreed milestones.",
      obligations: [
        "Deliver A",
        "Deliver B",
      ],
      completionCriteria: [
        "Both milestones satisfy acceptance criteria",
      ],
      reviewPeriodSeconds:
        86_400,
    },
    fulfillment: {
      submitted: true,
      confirmed: true,
      evidenceCommitment:
        "0xfulfillment",
      submittedAt:
        "2026-08-28T00:00:00Z",
    },
    payer: {
      role: "payer",
      walletAddress:
        "0xpayer",
      consentToAgentReview:
        true,
      statement:
        "Milestone B is incomplete.",
      evidence: [
        {
          kind: "test",
          label:
            "Acceptance test",
          value:
            "Milestone B failed.",
        },
      ],
      submittedAt:
        "2026-08-28T01:00:00Z",
    },
    payee: {
      role: "payee",
      walletAddress:
        "0xpayee",
      consentToAgentReview:
        true,
      statement:
        "Milestone A and most of B were delivered.",
      evidence: [
        {
          kind:
            "attachment",
          label:
            "Delivery hash",
          value:
            "0xartifact",
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

    roomSecret:
      "never-forward",
    channelKeyHex:
      "never-forward",
    privateKey:
      "never-forward",
  };
}

test(
  "sanitizer keeps explicit evidence but drops unrelated secrets",
  () => {
    const value =
      sanitizeDisputeCase(
        rawCase(),
      );

    assert.equal(
      value.payer.statement,
      "Milestone B is incomplete.",
    );

    assert.equal(
      JSON.stringify(
        value,
      ).includes(
        "never-forward",
      ),
      false,
    );
  },
);

test(
  "both parties must explicitly consent",
  () => {
    const value =
      rawCase();

    value.payee
      .consentToAgentReview =
      false;

    assert.throws(
      () =>
        sanitizeDisputeCase(
          value,
        ),
      /explicitly consent/,
    );
  },
);

test(
  "case commitment is deterministic",
  () => {
    const disputeCase =
      sanitizeDisputeCase(
        rawCase(),
      );

    assert.equal(
      computeDisputeCaseCommitment(
        disputeCase,
      ),
      computeDisputeCaseCommitment(
        disputeCase,
      ),
    );
  },
);

test(
  "decision parser accepts fenced JSON and rejects loose prose",
  () => {
    const decision =
      parseDisputeAgentDecision(
        `\`\`\`json
{
  "decision": "split",
  "payerBps": 3000,
  "payeeBps": 7000,
  "confidence": 0.94,
  "reason": "One milestone was incomplete.",
  "evidenceCommitment": "0xcase",
  "flags": []
}
\`\`\``,
      );

    assert.equal(
      decision.payeeBps,
      7000,
    );

    assert.throws(
      () =>
        parseDisputeAgentDecision(
          "Give everything to payer.",
        ),
      /JSON object/,
    );
  },
);

test(
  "bounded high-confidence decision may pass deterministic gate",
  () => {
    const disputeCase =
      sanitizeDisputeCase(
        rawCase(),
      );

    const commitment =
      computeDisputeCaseCommitment(
        disputeCase,
      );

    const result =
      evaluateDisputePolicy(
        disputeCase,
        commitment,
        {
          decision: "split",
          payerBps: 3000,
          payeeBps: 7000,
          confidence: 0.94,
          reason:
            "One required milestone was incomplete.",
          evidenceCommitment:
            commitment,
          flags: [],
        },
        undefined,
        {
          partyBindingVerified:
            true,
          verifiedPrincipalUsdMicros:
            100_000_000,
        },
      );

    assert.deepEqual(
      result,
      {
        status:
          "AUTO_RESOLVE",
        reasons: [],
      },
    );
  },
);

test(
  "weak subjective evidence uses deterministic automatic 50/50 fallback",
  () => {
    const disputeCase =
      sanitizeDisputeCase(
        rawCase(),
      );

    const commitment =
      computeDisputeCaseCommitment(
        disputeCase,
      );

    const agentDecision = {
      decision:
        "needs_review" as const,
      payerBps: 5_000,
      payeeBps: 5_000,
      confidence: 0.62,
      reason:
        "The available evidence does not justify a directional award.",
      evidenceCommitment:
        commitment,
      flags: [
        "evidence_conflict",
      ],
    };

    const policy =
      evaluateDisputePolicy(
        disputeCase,
        commitment,
        agentDecision,
        undefined,
        {
          partyBindingVerified:
            true,
          verifiedPrincipalUsdMicros:
            100_000_000,
        },
      );

    assert.equal(
      policy.status,
      "AUTO_RESOLVE",
    );

    assert.equal(
      policy.reasons.includes(
        "AUTOMATIC_50_50_FALLBACK",
      ),
      true,
    );

    const executionDecision =
      decisionForDisputeExecution(
        agentDecision,
        policy,
      );

    assert.equal(
      executionDecision.decision,
      "split",
    );

    assert.equal(
      executionDecision.payerBps,
      5_000,
    );

    assert.equal(
      executionDecision.payeeBps,
      5_000,
    );
  },
);

test(
  "confidence cannot bypass an invalid split",
  () => {
    const disputeCase =
      sanitizeDisputeCase(
        rawCase(),
      );

    const commitment =
      computeDisputeCaseCommitment(
        disputeCase,
      );

    const result =
      evaluateDisputePolicy(
        disputeCase,
        commitment,
        {
          decision: "split",
          payerBps: 4000,
          payeeBps: 7000,
          confidence: 0.99,
          reason:
            "Invalid sum.",
          evidenceCommitment:
            commitment,
          flags: [],
        },
        undefined,
        {
          partyBindingVerified:
            true,
          verifiedPrincipalUsdMicros:
            100_000_000,
        },
      );

    assert.equal(
      result.status,
      "REJECTED",
    );
    assert.equal(
      result.reasons.includes(
        "INVALID_SPLIT",
      ),
      true,
    );
  },
);

test(
  "low confidence, conflict, and high value require review",
  () => {
    const value =
      rawCase();

    value.principal
      .usdMicros =
      700_000_000;

    const disputeCase =
      sanitizeDisputeCase(
        value,
      );

    const commitment =
      computeDisputeCaseCommitment(
        disputeCase,
      );

    const result =
      evaluateDisputePolicy(
        disputeCase,
        commitment,
        {
          decision: "split",
          payerBps: 5000,
          payeeBps: 5000,
          confidence: 0.7,
          reason:
            "Evidence conflicts.",
          evidenceCommitment:
            commitment,
          flags: [
            "evidence_conflict",
          ],
        },
        undefined,
        {
          partyBindingVerified:
            true,
          verifiedPrincipalUsdMicros:
            700_000_000,
        },
      );

    assert.equal(
      result.status,
      "NEEDS_REVIEW",
    );
    assert.equal(
      result.reasons.includes(
        "CONFIDENCE_BELOW_GATE",
      ),
      true,
    );
    assert.equal(
      result.reasons.includes(
        "AUTO_RESOLVE_VALUE_CAP_EXCEEDED",
      ),
      true,
    );
  },
);

test(
  "objective disputes are not auto-arbitrated by AI",
  () => {
    const value =
      rawCase();

    value.verificationClass =
      "objective";

    const disputeCase =
      sanitizeDisputeCase(
        value,
      );

    const commitment =
      computeDisputeCaseCommitment(
        disputeCase,
      );

    const result =
      evaluateDisputePolicy(
        disputeCase,
        commitment,
        {
          decision: "payee",
          payerBps: 0,
          payeeBps:
            10_000,
          confidence: 0.99,
          reason:
            "On-chain evidence appears complete.",
          evidenceCommitment:
            commitment,
          flags: [],
        },
        undefined,
        {
          partyBindingVerified:
            true,
          verifiedPrincipalUsdMicros:
            100_000_000,
        },
      );

    assert.equal(
      result.status,
      "NEEDS_REVIEW",
    );
    assert.equal(
      result.reasons.includes(
        "OBJECTIVE_VERIFICATION_REQUIRED",
      ),
      true,
    );
  },
);


test(
  "browser USD value and two unbound wallets cannot authorize auto resolution",
  () => {
    const value =
      rawCase();

    // Attacker-controlled client value must have no authority.
    value.principal.usdMicros =
      1;

    const disputeCase =
      sanitizeDisputeCase(
        value,
      );

    const commitment =
      computeDisputeCaseCommitment(
        disputeCase,
      );

    const result =
      evaluateDisputePolicy(
        disputeCase,
        commitment,
        {
          decision: "payee",
          payerBps: 0,
          payeeBps: 10_000,
          confidence: 0.99,
          reason:
            "Looks complete.",
          evidenceCommitment:
            commitment,
          flags: [],
        },
      );

    assert.equal(
      result.status,
      "NEEDS_REVIEW",
    );
    assert.equal(
      result.reasons.includes(
        "PARTY_BINDING_NOT_VERIFIED",
      ),
      true,
    );
    assert.equal(
      result.reasons.includes(
        "USD_VALUE_NOT_VERIFIED",
      ),
      true,
    );
  },
);
