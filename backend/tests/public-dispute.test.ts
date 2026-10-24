import assert from "node:assert/strict";
import test from "node:test";
import { RpcProvider, typedData } from "starknet";
import type { AppConfig } from "../src/config.ts";
import { acceptanceTypedData, assertDisputeBindingDeployment, sanitizeDisputeRekberBinding, setupTypedData, verifyDisputeRekberBinding } from "../src/dispute/binding.ts";
import { buildDisputeAttestationTypedData } from "../src/dispute/attestation.ts";
import { parseRekberCustodyResult } from "../src/dispute/chain.ts";
import { computeDisputeCaseCommitment, sanitizeDisputeCase } from "../src/dispute/evidence.ts";
import { createDisputeRouter } from "../src/routes/dispute.ts";

const config = {
  rpcUrl: "http://rpc.invalid", network: "sepolia", contracts: { escrowRekber: "0x25", publicRailAdapter: "0x20" },
  agent: { defaultProvider: "groq" },
} as AppConfig;
const shieldConfig = { ...config, contracts: { ...config.contracts, publicRailAdapter: undefined, escrowRekber: "0x15" } };
function binding(publicMode = true): any {
  const common = { custodyCommitment: "1", dealOfferLocator: "a1", dealTermsCommitment: "2", payerAddress: "0xabc", payeeAddress: "0xdef", fulfillmentDeadline: "10000", signature: ["0x1", "0x2"], ...(publicMode ? { transactionMode: "unshield", publicRailAddress: "0x20", publicRekberAddress: "0x25" } : {}) };
  return { setup: { ...common, releaseAuthorizationCommitment: "3", refundCommitment: "4", payerConfirmationCommitment: "5", payerDisputeCommitment: "6", revisionChainHead: "7", payerCertificateCommitment: "8" }, acceptance: { ...common, payeeClaimCommitment: "9", payeeDisputeCommitment: "10", payeeRefundConsentCommitment: "11", fulfillmentChainHead: "12", payeeCertificateCommitment: "13" } };
}
const packet = (role: string, walletAddress: string) => ({ role, walletAddress, consentToAgentReview: true, statement: "Explicit evidence", evidence: [{ kind: "statement", label: "Evidence", value: "Private statement" }], submittedAt: "2026-10-24T00:00:00Z" });
const disputeCase = sanitizeDisputeCase({ custodyCommitment: "1", verificationClass: "digital_review", principal: { asset: "USDC", rawAmount: "100" }, acceptedTerms: { dealType: "freelance", summary: "Confidential terms", obligations: ["Deliver"], completionCriteria: ["Accepted"] }, fulfillment: { submitted: true, confirmed: false, evidenceCommitment: "99" }, payer: packet("payer", "0xabc"), payee: packet("payee", "0xdef"), onChain: { disputed: true, consumed: false, resolutionAuthorized: false, fulfillmentSubmitted: true, fulfillmentConfirmed: false } });
function custodyResult() {
  const state = Array<string>(39).fill("0x0");
  for (const [index, value] of [[0,1],[1,3],[2,9],[3,4],[4,5],[5,6],[6,10],[7,11],[8,100],[9,101],[10,8],[11,13],[12,48],[13,100],[15,10000],[19,1],[22,99],[27,1],[30,1]]) state[index!] = `0x${value!.toString(16)}`;
  return state;
}
function signedBinding(publicMode = true) {
  const b = sanitizeDisputeRekberBinding(binding(publicMode));
  const c = publicMode ? config : shieldConfig;
  b.setup.signature = [typedData.getMessageHash(setupTypedData(c, b.setup), b.setup.payerAddress), "0x1"];
  b.acceptance.signature = [typedData.getMessageHash(acceptanceTypedData(c, b.setup, b.acceptance), b.acceptance.payeeAddress), "0x1"];
  return b;
}

test("binding rail parser rejects missing, malformed and mixed deployment fields", () => {
  assert.deepEqual(sanitizeDisputeRekberBinding(binding()), binding());
  for (const key of ["publicRailAddress", "publicRekberAddress"]) {
    const b = binding(); delete b.setup[key]; assert.throws(() => sanitizeDisputeRekberBinding(b), /required/);
  }
  for (const value of [null, "unknown", "", 1]) {
    const b = binding(); b.setup.transactionMode = value; assert.throws(() => sanitizeDisputeRekberBinding(b), /Unsupported/);
  }
  const dropped = binding(); delete dropped.setup.transactionMode;
  assert.throws(() => sanitizeDisputeRekberBinding(dropped), /Shield/);
  const mixed = binding(); mixed.acceptance = binding(false).acceptance;
  assert.throws(() => sanitizeDisputeRekberBinding(mixed), /different transaction rails/);
  for (const address of ["0x0", "xyz", "0x" + (1n << 251n).toString(16)]) {
    const b = binding(); b.setup.publicRailAddress = address; assert.throws(() => sanitizeDisputeRekberBinding(b), /valid Starknet address/);
  }
});

test("deployment authority rejects public bindings on Shield and Shield on public backend", () => {
  assert.doesNotThrow(() => assertDisputeBindingDeployment(config, sanitizeDisputeRekberBinding(binding())));
  assert.doesNotThrow(() => assertDisputeBindingDeployment(shieldConfig, sanitizeDisputeRekberBinding(binding(false))));
  assert.throws(() => assertDisputeBindingDeployment(shieldConfig, sanitizeDisputeRekberBinding(binding())), /not configured/);
  assert.throws(() => assertDisputeBindingDeployment(config, sanitizeDisputeRekberBinding(binding(false))), /Shield arbitration/);
  for (const key of ["publicRailAddress", "publicRekberAddress"]) {
    const b = binding(); b.setup[key] = b.acceptance[key] = "0x777";
    assert.throws(() => assertDisputeBindingDeployment(config, sanitizeDisputeRekberBinding(b)), /does not match/);
  }
});

test("public arbitration attestation binds chain, adapter and actual custody deployment; Shield data remains legacy", () => {
  const publicData = buildDisputeAttestationTypedData(config, disputeCase, "payer");
  assert.equal(publicData.message["Public Rail"], "0x20");
  assert.equal(publicData.message["Custody Contract"], "0x25");
  const legacy = buildDisputeAttestationTypedData(shieldConfig, disputeCase, "payer");
  assert.equal(legacy.types.DisputeAttestation!.length, 6);
  const hash = (data: any) => typedData.getMessageHash(data, "0xabc");
  assert.notEqual(hash(publicData), hash(legacy));
  assert.notEqual(hash(publicData), hash(buildDisputeAttestationTypedData({ ...config, network: "mainnet" }, disputeCase, "payer")));
  assert.notEqual(hash(publicData), hash(buildDisputeAttestationTypedData({ ...config, contracts: { ...config.contracts, escrowRekber: "0x26" } }, disputeCase, "payer")));
});

test("public and default Shield original signatures validate against exact custody, including advanced chain heads", async (t) => {
  t.mock.method(RpcProvider.prototype, "callContract", async (call: any) => {
    assert.match(call.entrypoint, /isValidSignature|is_valid_signature/);
    return [BigInt(call.calldata[0]) === BigInt(call.calldata[2]) ? "0x1" : "0x0"];
  });
  const stripped = signedBinding();
  for (const approval of [stripped.setup, stripped.acceptance]) {
    delete approval.transactionMode; delete approval.publicRailAddress; delete approval.publicRekberAddress;
  }
  await assert.rejects(verifyDisputeRekberBinding(shieldConfig, disputeCase, parseRekberCustodyResult(custodyResult()), stripped), /signature is invalid/);
  for (const isPublic of [true, false]) {
    const c = isPublic ? config : shieldConfig;
    await verifyDisputeRekberBinding(c, disputeCase, parseRekberCustodyResult(custodyResult()), signedBinding(isPublic));
    const tampered = signedBinding(isPublic); tampered.setup.dealTermsCommitment = tampered.acceptance.dealTermsCommitment = "999";
    await assert.rejects(verifyDisputeRekberBinding(c, disputeCase, parseRekberCustodyResult(custodyResult()), tampered), /signature is invalid/);
  }
});

test("all four dispute routes reject wrong deployments before custody RPC or persistence and accept public custody", async (t) => {
  const reads: any[] = [];
  t.mock.method(RpcProvider.prototype, "callContract", async (call: any) => {
    reads.push(call);
    if (call.entrypoint === "get_custody") { assert.equal(call.contractAddress, "0x25"); return custodyResult(); }
    if (/isValidSignature|is_valid_signature/.test(call.entrypoint)) return [BigInt(call.calldata[0]) === BigInt(call.calldata[2]) ? "0x1" : "0x0"];
    if (call.entrypoint === "get_supported_tokens") return ["0x30", "0x31"];
    throw new Error(`Unexpected RPC ${call.entrypoint}`);
  });
  let queries = 0;
  const db = { async query(sql: string) {
    queries++;
    if (sql.includes("SELECT") && sql.includes("vinss_dispute_attestations")) return { rows: [] };
    if (sql.includes("SELECT") && sql.includes("vinss_dispute_evaluations")) return { rows: [{ state: "complete", decision: { decision: "needs_review", payerBps: 5000, payeeBps: 5000, confidence: 0.5, reason: "Review required", evidenceCommitment: computeDisputeCaseCommitment(disputeCase), flags: [] }, provider: "fixture", model: "fixture" }] };
    return { rows: [], rowCount: 0 };
  } };
  const router = createDisputeRouter(config, db as any);
  for (const path of ["/dispute/challenge", "/dispute/attestation", "/dispute/attestation/status", "/dispute/evaluate"]) {
    const route = (router as any).stack.find((layer: any) => layer.route?.path === path).route.stack[0].handle;
    async function invoke(b: any, extra: any = {}) {
      const result = { status: 200, body: {} as any };
      const res = { status(code: number) { result.status = code; return this; }, json(body: any) { result.body = body; return this; } };
      await route({ body: { case: disputeCase, binding: b, role: "payer", signature: ["0x1", "0x2"], ...extra } }, res);
      return result;
    }
    const beforeReads = reads.length, beforeQueries = queries;
    const rejected = await invoke(binding(false));
    assert.equal(rejected.status, 400, path); assert.match(rejected.body.error, /Shield arbitration/);
    for (const key of ["publicRailAddress", "publicRekberAddress"]) {
      const wrong = binding(); wrong.setup[key] = wrong.acceptance[key] = "0x777";
      const wrongDeployment = await invoke(wrong);
      assert.equal(wrongDeployment.status, 400, path); assert.match(wrongDeployment.body.error, /does not match/);
    }
    assert.equal(reads.length, beforeReads, path); assert.equal(queries, beforeQueries, path);
    const b = signedBinding();
    const payer = typedData.getMessageHash(buildDisputeAttestationTypedData(config, disputeCase, "payer"), "0xabc");
    const payee = typedData.getMessageHash(buildDisputeAttestationTypedData(config, disputeCase, "payee"), "0xdef");
    const accepted = await invoke(b, { signature: [payer, "0x1"], ...(path.endsWith("evaluate") ? { attestations: { payer: [payer,"0x1"], payee: [payee,"0x1"] } } : {}) });
    assert.equal(accepted.status, 200, `${path}: ${JSON.stringify(accepted.body)}`);
  }
});

test("binding parser rejects invalid signed felts, oversized signature limbs and deadlines", () => {
  const prime = 2n ** 251n + 17n * 2n ** 192n + 1n;
  for (const [key, value] of [["custodyCommitment", "-1"], ["dealTermsCommitment", "garbage"], ["fulfillmentDeadline", (1n << 128n).toString()], ["payerAddress", "0x0"], ["revisionChainHead", prime.toString()]]) {
    const b = binding(); b.setup[key!] = value;
    assert.throws(() => sanitizeDisputeRekberBinding(b), /valid felt|allowed range/);
  }
  const b = binding(); b.setup.signature = [`0x${prime.toString(16)}`, "0x1"];
  assert.throws(() => sanitizeDisputeRekberBinding(b), /invalid felt/);
});

test("PUBLIC_RAIL_ADAPTER_ADDRESS is optional for Shield and parsed strictly when configured", async () => {
  const env = {
    STARKNET_NETWORK: "sepolia", RPC_URL: "https://rpc.invalid", DATABASE_URL: "postgres://fixture/database",
    PRIVACY_POOL_ADDRESS: "0x1", MESSAGE_HELPER_ADDRESS: "0x2", OFFER_HELPER_ADDRESS: "0x3", PRIVATE_ESCROW_HELPER_ADDRESS: "0x4", ESCROW_REKBER_ADDRESS: "0x25", SETTLEMENT_CERTIFICATE_ADDRESS: "0x6",
    MESSAGE_HELPER_START_BLOCK: "0", OFFER_HELPER_START_BLOCK: "0", PRIVATE_ESCROW_HELPER_START_BLOCK: "0", ESCROW_REKBER_START_BLOCK: "0", SETTLEMENT_CERTIFICATE_START_BLOCK: "0",
  };
  // config.ts also loads its process singleton at module import time.
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  let loadConfig: typeof import("../src/config.ts").loadConfig;
  try { ({ loadConfig } = await import("../src/config.ts")); }
  finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  assert.equal(loadConfig(env).contracts.publicRailAdapter, undefined);
  assert.equal(loadConfig({ ...env, PUBLIC_RAIL_ADAPTER_ADDRESS: "0x0020" }).contracts.publicRailAdapter, "0x20");
  assert.throws(() => loadConfig({ ...env, PUBLIC_RAIL_ADAPTER_ADDRESS: "0x0" }), /non-zero/);
  assert.throws(() => loadConfig({ ...env, PUBLIC_RAIL_ADAPTER_ADDRESS: "invalid" }), /Starknet address/);
});
