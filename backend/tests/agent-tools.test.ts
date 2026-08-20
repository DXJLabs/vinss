import test from "node:test";
import assert from "node:assert/strict";

import {
  executeSkillTool,
  toolDefinitionsForSkill,
} from "../src/agent/runtime.ts";
import {
  getAgentSkill,
} from "../src/agent/skills/registry.ts";

import {
  analyzeOffer,
  calculateFee,
  draftCounterOffer,
  draftMessage,
  executeTool,
  getToolDefinitions,
  inferDealStage,
} from "../src/agent/tools.ts";

test("fee calculation is deterministic", () => {
  assert.deepEqual(calculateFee("10000", 25), {
    amount: 10000,
    feeBps: 25,
    fee: 25,
    total: 10025,
  });
});

test("offer analysis flags missing settlement terms", () => {
  const result = analyzeOffer({
    latestOffer: {
      asset: "USDC",
      amount: "50000",
      paymentTerms: "",
      conditions: "Delivery confirmed",
    },
  });

  assert.equal(result.riskLevel, "watch");
});

test("counter offer creates approval-required proposal", () => {
  const result = draftCounterOffer(
    {
      latestOffer: {
        asset: "USDC",
        amount: "48000",
        paymentTerms: "7 days",
      },
    },
    "50000",
    "14 days",
  );

  assert.equal(result.type, "draft_counter_offer");
  assert.equal(result.requiresApproval, true);
  assert.equal(result.payload.amount, "50000");
});

test("private message remains a draft", () => {
  const result = draftMessage("Barang sudah diterima.");

  assert.equal(result.type, "draft_message");
  assert.equal(result.requiresApproval, true);
  assert.equal(
    result.payload.body,
    "Barang sudah diterima.",
  );
});

test("deal lifecycle stage can be inferred", () => {
  assert.equal(
    inferDealStage({
      timeline: [
        {
          kind: "offer",
          summary: "Escrow deposit — 500 STRK",
        },
      ],
    }),
    "funded",
  );
});

test("agent tool allowlist has no execution tools", () => {
  const names = getToolDefinitions().map(
    (tool) => tool.function.name,
  );

  for (const forbidden of [
    "send_transaction",
    "release_escrow",
    "deposit_funds",
    "sign_transaction",
  ]) {
    assert.equal(names.includes(forbidden), false);
  }

  assert.throws(
    () =>
      executeTool(
        "send_transaction",
        {},
        {},
        25,
      ),
    /Tool not allowed/,
  );
});


test("skills expose only domain tools", () => {
  const chatNames =
    toolDefinitionsForSkill(
      getAgentSkill("chat"),
    ).map(
      (tool) =>
        tool.function.name,
    );

  assert.deepEqual(
    chatNames.sort(),
    [
      "draft_message",
      "inspect_deal_state",
    ].sort(),
  );

  const offerNames =
    toolDefinitionsForSkill(
      getAgentSkill("offer"),
    ).map(
      (tool) =>
        tool.function.name,
    );

  assert.equal(
    offerNames.includes(
      "prepare_escrow",
    ),
    false,
  );

  const escrowNames =
    toolDefinitionsForSkill(
      getAgentSkill("escrow"),
    ).map(
      (tool) =>
        tool.function.name,
    );

  assert.equal(
    escrowNames.includes(
      "draft_message",
    ),
    false,
  );
});

test("skill boundary blocks cross-domain tool execution", () => {
  assert.throws(
    () =>
      executeSkillTool(
        getAgentSkill("chat"),
        "draft_offer",
        {},
        {},
        25,
      ),
    /Tool not allowed for chat skill/,
  );

  assert.throws(
    () =>
      executeSkillTool(
        getAgentSkill("offer"),
        "prepare_escrow",
        {},
        {},
        25,
      ),
    /Tool not allowed for offer skill/,
  );

  assert.throws(
    () =>
      executeSkillTool(
        getAgentSkill("escrow"),
        "draft_message",
        {},
        {},
        25,
      ),
    /Tool not allowed for escrow skill/,
  );
});
