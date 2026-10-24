import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { typedData } from "starknet";
import type { EscrowActionPayload } from "../types/deal-room";

Object.assign(process.env, {
  NEXT_PUBLIC_STARKNET_NETWORK: "sepolia", NEXT_PUBLIC_RPC_URL: "http://rpc.invalid",
  NEXT_PUBLIC_BACKEND_URL: "https://shield.invalid", NEXT_PUBLIC_UNSHIELD_BACKEND_URL: "https://public.invalid/",
  NEXT_PUBLIC_UNSHIELD_ADAPTER_ADDRESS: "0x20", NEXT_PUBLIC_UNSHIELD_REKBER_ADDRESS: "0x25",
});

function actions(publicMode = true): [EscrowActionPayload, EscrowActionPayload] {
  const common = { custodyCommitment: "1", dealOfferLocator: "a1", dealTermsCommitment: "2", refundAfter: "10000", coordinationVersion: 3 as const, coordinationSignature: ["0x1", "0x2"], ...(publicMode ? { transactionMode: "unshield" as const, publicRailAddress: "0x20", publicRekberAddress: "0x25" } : {}) };
  return [
    { ...common, kind: "create", senderAddress: "0xabc", recipientAddress: "0xdef", releaseAuthorizationCommitment: "3", refundCommitment: "4", payerConfirmationCommitment: "5", payerDisputeCommitment: "6", revisionChainHead: "7", payerCertificateCommitment: "8" },
    { ...common, kind: "accept", senderAddress: "0xdef", recipientAddress: "0xabc", payeeClaimCommitment: "9", payeeDisputeCommitment: "10", payeeRefundConsentCommitment: "11", fulfillmentChainHead: "12", payeeCertificateCommitment: "13" },
  ];
}

test("public and legacy Shield setup/acceptance reconstruct exactly the frontend signed typed data and hashes", async () => {
  const frontend = await import("../lib/deal-room/rekberAuthorization");
  const { buildDisputeRekberBinding } = await import("../lib/deal-room/disputeAgent");
  const backend = await import("../../backend/src/dispute/binding");
  const config = { network: "sepolia" } as any;
  for (const publicMode of [true, false]) {
    const [setup, acceptance] = actions(publicMode);
    const binding = backend.sanitizeDisputeRekberBinding(buildDisputeRekberBinding(setup, acceptance));
    const frontSetup = frontend.buildRekberSetupTypedData(setup);
    const backSetup = backend.setupTypedData(config, binding.setup);
    const frontAccept = frontend.buildRekberAcceptanceTypedData(setup, acceptance);
    const backAccept = backend.acceptanceTypedData(config, binding.setup, binding.acceptance);
    assert.deepEqual(frontSetup, backSetup);
    assert.deepEqual(frontAccept, backAccept);
    assert.equal(typedData.getMessageHash(frontSetup, "0xabc"), typedData.getMessageHash(backSetup, "0xabc"));
    assert.equal(typedData.getMessageHash(frontAccept, "0xdef"), typedData.getMessageHash(backAccept, "0xdef"));
    assert.equal(binding.setup.transactionMode, publicMode ? "unshield" : undefined);
    assert.equal(binding.acceptance.publicRekberAddress, publicMode ? "0x25" : undefined);
  }
});

test("all four dispute calls and legacy evaluation overload route by signed binding instead of wallet/global mode", async (t) => {
  const api = await import("../lib/deal-room/disputeAgent");
  const calls: { url: string; body: any }[] = [];
  t.mock.method(globalThis, "fetch", async (url: any, options: any) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const disputeCase = { custodyCommitment: "1" } as any;
  for (const publicMode of [true, false]) {
    const binding = api.buildDisputeRekberBinding(...actions(publicMode));
    await api.requestDisputeAgentChallenge(disputeCase, binding);
    await api.submitDisputeAgentAttestation(disputeCase, binding, "payer", ["0x1", "0x2"]);
    await api.getDisputeAgentAttestationStatus(disputeCase, binding);
    await api.evaluateDisputeWithAgent(disputeCase, binding);
    await api.evaluateDisputeWithAgent(disputeCase, { payer: ["0x1", "0x2"], payee: ["0x3", "0x4"] }, binding);
    const batch = calls.splice(0);
    assert.deepEqual(batch.map(item => item.url), ["/dispute/challenge", "/dispute/attestation", "/dispute/attestation/status", "/dispute/evaluate", "/dispute/evaluate"].map(path => `${publicMode ? "https://public.invalid" : "https://shield.invalid"}${path}`));
    for (const call of batch) assert.deepEqual(call.body.binding, binding);
  }
  const [setup, acceptance] = actions();
  delete acceptance.transactionMode;
  assert.throws(() => api.buildDisputeRekberBinding(setup, acceptance), /Shield/);
  const [wrongSetup, wrongAcceptance] = actions();
  wrongSetup.publicRailAddress = wrongAcceptance.publicRailAddress = "0x999";
  assert.throws(() => api.buildDisputeRekberBinding(wrongSetup, wrongAcceptance), /another public deployment/);
  const tampered = api.buildDisputeRekberBinding(...actions());
  delete tampered.setup.publicRailAddress;
  await assert.rejects(api.requestDisputeAgentChallenge(disputeCase, tampered), /missing public rail/);
  assert.equal(calls.length, 0);
});

test("unconfigured public arbitration fails before fetch without Shield fallback", () => {
  const result = spawnSync(process.execPath, ["--import", "./backend/node_modules/tsx/dist/loader.mjs", "--input-type=module", "-e", `
    const { requestDisputeAgentChallenge } = await import('./frontend/lib/deal-room/disputeAgent.ts');
    globalThis.fetch = async () => { throw new Error('unexpected fetch'); };
    const rail = { transactionMode: 'unshield', publicRailAddress: '0x20', publicRekberAddress: '0x25' };
    try { await requestDisputeAgentChallenge({}, { setup: rail, acceptance: rail }); throw new Error('accepted'); }
    catch(error) { if (!error.message.includes('Unshield arbitration backend is not configured')) throw error; }
  `], { cwd: new URL("../../", import.meta.url), encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_UNSHIELD_BACKEND_URL: "" } });
  assert.equal(result.status, 0, result.stderr);
});
