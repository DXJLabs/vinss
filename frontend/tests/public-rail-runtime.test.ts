import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import * as sdk from "starknet";
import type { WalletAccountV6 } from "starknet";
import type { EscrowActionPayload, MessagePayload, OfferActionPayload } from "../types/deal-room";

// Configure before importing application modules: constants intentionally snapshot env.
Object.assign(process.env, {
  NEXT_PUBLIC_STARKNET_NETWORK: "sepolia", NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:1",
  NEXT_PUBLIC_PRIVACY_POOL_ADDRESS: "0x10", NEXT_PUBLIC_INVITE_ADDRESS: "0x11",
  NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS: "0x12", NEXT_PUBLIC_OFFER_HELPER_ADDRESS: "0x13",
  NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS: "0x14", NEXT_PUBLIC_ESCROW_REKBER_ADDRESS: "0x15",
  NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN: "0x32", NEXT_PUBLIC_OFFER_HELPER_OPEN_NOTE_TOKEN: "0x32",
  NEXT_PUBLIC_STRK_ADDRESS: "0x30", NEXT_PUBLIC_VINSS_TREASURY_ADDRESS: "0x31",
  NEXT_PUBLIC_UNSHIELD_ADAPTER_ADDRESS: "0x20", NEXT_PUBLIC_UNSHIELD_INVITE_ADDRESS: "0x21",
  NEXT_PUBLIC_UNSHIELD_MESSAGE_HELPER_ADDRESS: "0x22", NEXT_PUBLIC_UNSHIELD_OFFER_HELPER_ADDRESS: "0x23",
  NEXT_PUBLIC_UNSHIELD_ESCROW_HELPER_ADDRESS: "0x24", NEXT_PUBLIC_UNSHIELD_REKBER_ADDRESS: "0x25",
  NEXT_PUBLIC_UNSHIELD_FEE_POLICY_ADDRESS: "0x40", NEXT_PUBLIC_UNSHIELD_BACKEND_URL: "https://public.invalid",
});
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

type Actions = Parameters<WalletAccountV6["strk20InvokeTransaction"]>[0];
type Call = { contractAddress: string; entrypoint: string; calldata: string[] };
const hex = (value: bigint | number) => `0x${BigInt(value).toString(16)}`;
const chain = "0x534e5f5345504f4c4941";
const key = new Uint8Array(32).fill(7);

// This suite executes the real encryption/domain/gateway code. Only wallet and RPC
// boundaries are fixtures; an unexpected RPC/read or network request fails the test.
test("public rail runtime seams", async (t) => {
  const constants = await import("../lib/starknet/constants");
  const modes = await import("../lib/starknet/transactionMode");
  const execution = await import("../lib/starknet/vinssExecution");
  const feePolicy = await import("../lib/starknet/feePolicy");
  const { getProvider } = await import("../lib/starknet/walletClient");
  const { sendMessage } = await import("../lib/deal-room/messaging");
  const { sendOfferAction } = await import("../lib/deal-room/offers");
  const invitation = await import("../lib/deal-room/invitation");
  const publicInvite = await import("../lib/starknet/publicInvite");
  const settlement = await import("../lib/deal-room/settlement");
  const { sendEscrowCoordinationAction } = await import("../lib/deal-room/escrow");
  const authorization = await import("../lib/deal-room/rekberAuthorization");
  const { decryptPayload } = await import("../lib/privacy/envelope");
  const reads: Call[] = [];
  const executions: Call[][] = [];
  const shieldBundles: unknown[] = [];
  const timeline: string[] = [];
  let walletChain = chain, rpcChain = chain;
  let configuration = ["0x8", "0x31", "0x30", "0x21", "0x22", "0x23", "0x24", "0x25", "0x40"];
  let consumer = "0xabc";
  const account = {
    address: "0xabc",
    async execute(calls: Call | Call[]) {
      const bundle = Array.isArray(calls) ? calls : [calls];
      executions.push(bundle);
      timeline.push(...bundle.map(call => call.entrypoint));
      return { transaction_hash: hex(executions.length) };
    },
    async strk20InvokeTransaction(actions: unknown) {
      shieldBundles.push(actions);
      return { transaction_hash: "0x777" };
    },
  } as unknown as WalletAccountV6;
  modes.bindAccountWallet(account, { features: { "starknet:walletApi": {
    async request(request: { type: string }) {
      assert.equal(request.type, "wallet_requestChainId");
      return walletChain;
    },
  } } });
  const publicAccount = modes.accountForMode(account, "unshield");
  const shieldAccount = modes.accountForMode(account, "shield");
  const publicHelpers = new Set(["0x21", "0x22", "0x23"]);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request in runtime test"); });
  t.mock.method(sdk.RpcProvider.prototype, "callContract", async (call: Call) => {
    reads.push(call);
    switch (call.entrypoint) {
      case "get_configuration": assert.equal(call.contractAddress, "0x20"); return configuration;
      case "get_fee_policy": return [publicHelpers.has(call.contractAddress) ? "0x40" : "0x41"];
      case "quote_fee": return [call.contractAddress === "0x40" ? "0x64" : "0xc8"];
      case "get_revenue_fee_policy": return ["0x41"];
      case "quote_rekber_fee": return ["0x7"];
      case "get_invite": return [hex(Math.floor(Date.now() / 1000) + 3600), "0x0", "0x1"];
      case "get_invite_consumer": return [consumer];
      case "get_custody_parties": return [account.address, "0xdef"];
      case "get_custody": {
        const state = Array<string>(39).fill("0x0");
        state[0] = "0x1"; state[12] = "0x30"; state[13] = "0x64"; state[14] = "0x7";
        return state;
      }
      default: throw new Error(`Unexpected local RPC fixture: ${call.entrypoint}`);
    }
  });
  const provider = getProvider();
  t.mock.method(provider, "getChainId", async () => rpcChain);
  t.mock.method(provider, "waitForTransaction", async () => { throw new Error("Unexpected receipt polling in public capability flow"); });
  t.mock.method(provider, "getBlockNumber", async () => { throw new Error("Unexpected block polling in public capability flow"); });
  function lastCalls(): Call[] { assert.ok(executions.length); return executions.at(-1)!; }
  function adapterCall(entrypoint: string): Call {
    const call = lastCalls().find(item => item.entrypoint === entrypoint);
    assert.ok(call, `Missing ${entrypoint}`); assert.equal(call.contractAddress, "0x20"); return call;
  }
  async function assertEncryptedEnvelope(call: Call, payload: unknown, suffixCount = 1) {
    assert.equal(BigInt(call.calldata[0]!), BigInt(call.calldata.length - 1 - suffixCount));
    const count = Number(BigInt(call.calldata[6]!));
    const ciphertext = call.calldata.slice(7, 7 + count).map(BigInt);
    assert.deepEqual(await decryptPayload(key, ciphertext), payload);
    assert.equal(JSON.stringify(call).includes("confidential"), false);
    const nonce = call.calldata.at(-1)!;
    assert.notEqual(BigInt(nonce), 0n);
    const expectedLocator = sdk.hash.computePoseidonHashOnElements([
      sdk.shortString.encodeShortString("VINSS_PUBLIC_ACTION_V1"), chain, "0x20", account.address, nonce,
    ]);
    assert.equal(BigInt(call.calldata[2]!), BigInt(expectedLocator), "Ciphertext locator binds caller, chain, adapter, nonce");
    await assert.rejects(decryptPayload(new Uint8Array(32).fill(8), ciphertext), /authentication/i);
  }

  await t.test("quotes read distinct helper deployments and retain cache identity", async () => {
    const before = reads.length;
    assert.equal(await feePolicy.quoteRoomActivationFee(publicAccount), 100n);
    assert.equal(await feePolicy.quoteMessageFee(publicAccount), 100n);
    assert.equal(await feePolicy.quoteOfferFee(publicAccount), 100n);
    assert.equal(await feePolicy.quoteRoomActivationFee(shieldAccount), 200n);
    assert.equal(await feePolicy.quoteMessageFee(shieldAccount), 200n);
    assert.equal(await feePolicy.quoteOfferFee(shieldAccount), 200n);
    assert.equal(await feePolicy.quoteRekberFee("0x30", 100n, publicAccount), 7n);
    assert.equal(await feePolicy.quoteRekberFee("0x30", 100n, shieldAccount), 7n);
    const helperReads = reads.slice(before).filter(call => call.entrypoint === "get_fee_policy");
    assert.deepEqual(helperReads.map(call => call.contractAddress), ["0x21", "0x22", "0x23", "0x11", "0x12", "0x13"]);
    assert.deepEqual(reads.filter(call => call.entrypoint === "quote_rekber_fee").map(call => call.contractAddress), ["0x25", "0x15"]);
    const cachedReads = reads.length;
    await feePolicy.quoteMessageFee(publicAccount);
    assert.equal(reads.slice(cachedReads).filter(call => call.entrypoint === "get_fee_policy").length, 0);
  });

  await t.test("actual message encryption reaches ordinary execute with approval, adapter, revoke", async () => {
    const payload: MessagePayload = { kind: "text", body: "confidential message", sentAt: "2026-10-24T00:00:00Z" };
    const result = await sendMessage(publicAccount, key, payload);
    assert.equal(result.transactionHash, hex(executions.length));
    assert.deepEqual(lastCalls().map(call => call.entrypoint), ["approve", "post_message", "approve"]);
    assert.deepEqual(lastCalls()[0], { contractAddress: "0x30", entrypoint: "approve", calldata: ["0x20", "0x64", "0x0"] });
    assert.deepEqual(lastCalls().at(-1)!.calldata, ["0x20", "0x0", "0x0"]);
    await assertEncryptedEnvelope(adapterCall("post_message"), payload);
    assert.equal(shieldBundles.length, 0);
  });

  await t.test("actual Offer encryption keeps plaintext terms out of public calldata", async () => {
    const payload: OfferActionPayload = { kind: "create", asset: "STRK", amount: "19.75", paymentTerms: "confidential offer terms", conditions: "confidential conditions" };
    await sendOfferAction(publicAccount, key, payload);
    assert.deepEqual(lastCalls().map(call => call.entrypoint), ["approve", "post_offer", "approve"]);
    await assertEncryptedEnvelope(adapterCall("post_offer"), payload);
    assert.equal(shieldBundles.length, 0);
  });

  await t.test("Shield keeps original action objects and native dispatch", async () => {
    const bundle: Actions = [{ type: "withdraw", token: "0x30", amount: "0xa", recipient: "0x31" }, { type: "invoke", contract: "0x12", calldata: ["0x1", "${openNoteIds[0]}"] }];
    const before = executions.length;
    await execution.invokeVinssActions(shieldAccount, bundle);
    assert.equal(shieldBundles.at(-1), bundle);
    assert.equal(executions.length, before);
    await sendMessage(shieldAccount, key, { kind: "text", body: "confidential Shield", sentAt: "2026-10-24T00:00:00Z" });
    const messageBundle = shieldBundles.at(-1) as Array<{ type: string; token?: string; contract?: string; calldata?: string[] }>;
    assert.deepEqual(messageBundle.map(action => action.type), ["withdraw", "transfer", "invoke"]);
    assert.equal(messageBundle[0]!.token, "0x32");
    assert.equal(messageBundle[2]!.contract, "0x12");
    assert.equal(messageBundle[2]!.calldata!.at(-1), "${openNoteIds[0]}");
    assert.equal(executions.length, before);
  });

  await t.test("one room can send Unshield then Shield without persisting a room lock", async () => {
    const writes: string[] = [];
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      localStorage: { setItem: (key: string) => writes.push(key) },
    } });
    try {
      const beforePublic = executions.length, beforeShield = shieldBundles.length;
      await sendMessage(modes.accountForMode(account, "unshield", "same-room"), key,
        { kind: "text", body: "public send", sentAt: "2026-10-29T00:00:00Z" });
      await sendMessage(modes.accountForMode(account, "shield", "same-room"), key,
        { kind: "text", body: "shield send", sentAt: "2026-10-29T00:00:01Z" });
      assert.equal(executions.length, beforePublic + 1);
      assert.equal(shieldBundles.length, beforeShield + 1);
      assert.deepEqual(writes, []);
    } finally {
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  });

  async function encryptedInvite(payload: Record<string, unknown>, aad = "VINSS_INVITE_V3") {
    const raw = new Uint8Array(32).fill(9), iv = new Uint8Array(12).fill(4);
    const imported = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, imported, new TextEncoder().encode(JSON.stringify(payload))));
    return { token: Buffer.concat([iv, encrypted]).toString("base64url"), key: Buffer.from(raw).toString("base64url") };
  }
  await t.test("createInviteToken executes public create and authenticated rail roundtrip", async () => {
    const token = await invitation.createInviteToken(publicAccount, { scope: "direct", roomId: "room-confidential", roomSecret: "secret-confidential", label: "confidential invite" });
    const payload = await invitation.decodeInviteToken(token.token, token.key);
    assert.ok(payload); assert.equal(payload.transactionMode, "unshield"); assert.equal(payload.publicRailAddress, "0x20");
    assert.equal(payload.roomSecret, "secret-confidential");
    const capability = publicInvite.computePublicInviteCapability(payload.onchainSecret, account.address);
    assert.equal(payload.publicInviteCommitment, capability.commitment);
    assert.equal(BigInt(token.commitment), BigInt(capability.commitment));
    const created = adapterCall("create_invite");
    assert.equal(created.calldata[1], "0x0");
    assert.equal(created.calldata[2], capability.commitment);
    assert.equal(created.calldata.at(-1), capability.claimPublicKey);
    assert.equal(BigInt(created.calldata[0]!), BigInt(created.calldata.length - 2));
    assert.equal(lastCalls()[0]!.calldata[1], "0x64");
    assert.equal(JSON.stringify(lastCalls()).includes("confidential"), false);
    assert.equal(reads.filter(call => call.entrypoint === "get_invite").at(-1)!.contractAddress, "0x20");
    assert.equal(await invitation.decodeInviteToken(token.token, Buffer.alloc(32).toString("base64url")), null);
  });
  await t.test("legacy invite defaults to Shield and unsupported public payload modes fail closed", async () => {
    const common = { inviteId: "legacy", roomId: "room", roomSecret: "secret", onchainSecret: "0x123", label: "invite", expiresAt: new Date(Date.now() + 3600000).toISOString() };
    const legacy = await encryptedInvite({ ...common, v: 2 }, "VINSS_INVITE_V2");
    const decoded = await invitation.decodeInviteToken(legacy.token, legacy.key);
    assert.ok(decoded); assert.equal(modes.parseTransactionMode(decoded.transactionMode), "shield");
    const capability = publicInvite.computePublicInviteCapability(common.onchainSecret, "0xaaa");
    for (const rail of [
      { transactionMode: "other" },
      { transactionMode: "unshield" },
      { transactionMode: "unshield", publicRailAddress: "0x20", inviterAddress: "0xaaa", publicInviteCommitment: "0x99" },
      { transactionMode: "unshield", publicRailAddress: "0x20", inviterAddress: "0xaab", publicInviteCommitment: capability.commitment },
    ]) {
      const invalid = await encryptedInvite({ ...common, v: 3, scope: "direct", ...rail });
      assert.equal(await invitation.decodeInviteToken(invalid.token, invalid.key), null);
    }
  });
  await t.test("public capability binds creator/deployment and consumption signature binds consumer without secret reveal", async () => {
    const secret = "0x123", creator = "0xaaa";
    const capability = publicInvite.computePublicInviteCapability(secret, creator);
    assert.equal(capability.claimPublicKey, sdk.ec.starkCurve.getStarkKey(secret));
    assert.equal(capability.commitment, sdk.hash.computePoseidonHashOnElements([
      sdk.shortString.encodeShortString("VINSS_PUBLIC_INVITE_V1"), chain, "0x20", creator, capability.claimPublicKey,
    ]));
    assert.notEqual(capability.commitment, publicInvite.computePublicInviteCapability(secret, "0xaab").commitment);
    const before = executions.length, beforeTimeline = timeline.length, beforeShield = shieldBundles.length;
    await invitation.consumeInviteOnchain(publicAccount, secret, capability.commitment);
    assert.equal(executions.length - before, 1);
    assert.deepEqual(timeline.slice(beforeTimeline), ["consume_invite"]);
    const consume = adapterCall("consume_invite");
    assert.equal(consume.calldata.length, 3);
    assert.equal(consume.calldata[0], capability.commitment);
    assert.ok(!consume.calldata.includes(secret));
    const signature = new sdk.ec.starkCurve.Signature(BigInt(consume.calldata[1]!), BigInt(consume.calldata[2]!));
    const digest = (actor: string, adapter = "0x20") => hex(BigInt(sdk.hash.computePoseidonHashOnElements([
      sdk.shortString.encodeShortString("VINSS_PUBLIC_CONSUME_V1"), chain, adapter, actor, capability.commitment,
    ])) % (1n << 251n));
    const pubkey = sdk.ec.starkCurve.getPublicKey(secret);
    assert.equal(sdk.ec.starkCurve.verify(signature, digest(account.address), pubkey), true);
    assert.equal(sdk.ec.starkCurve.verify(signature, digest("0xdef"), pubkey), false);
    assert.equal(sdk.ec.starkCurve.verify(signature, digest(account.address, "0x99"), pubkey), false);
    assert.equal(shieldBundles.length, beforeShield);
    consumer = account.address; assert.equal(await publicInvite.publicInviteConsumedBy(capability.commitment, account.address), true);
    consumer = "0xdef"; assert.equal(await publicInvite.publicInviteConsumedBy(capability.commitment, account.address), false);
    consumer = "0x0"; assert.equal(await publicInvite.publicInviteConsumedBy(capability.commitment, account.address), false);
    assert.deepEqual(reads.filter(call => call.entrypoint === "get_invite_consumer").at(-1)!.calldata, [capability.commitment]);
    await invitation.getInviteOnchainStateForSecret(secret, publicAccount, capability.commitment);
    assert.deepEqual(reads.at(-1), { contractAddress: "0x20", entrypoint: "get_invite", calldata: [capability.commitment] });
    await assert.rejects(invitation.getInviteOnchainStateForSecret(secret, publicAccount), /Missing public invite commitment/);
  });

  await t.test("real custody deposit quotes public Rekber and binds exact principal plus fee and payee", async () => {
    const beforeShield = shieldBundles.length;
    await settlement.depositEscrow(publicAccount, { custodyCommitment: 1n, releaseAuthorizationCommitment: 2n, payeeClaimCommitment: 3n, refundCommitment: 4n, payerConfirmationCommitment: 5n, payerDisputeCommitment: 6n, payeeDisputeCommitment: 7n, payeeRefundConsentCommitment: 8n, fulfillmentChainHead: 9n, revisionChainHead: 10n, payerCertificateCommitment: 11n, payeeCertificateCommitment: 12n, refundAfter: 10000, reviewWindow: 300, verificationPolicy: 2, fulfillmentRounds: 2, revisionRounds: 1, token: "0x30", amount: 100n, payeeAddress: "0xdef" });
    assert.deepEqual(lastCalls().map(call => call.entrypoint), ["approve", "fund_custody", "approve"]);
    assert.deepEqual(lastCalls()[0]!.calldata, ["0x20", "0x6b", "0x0"]);
    const fund = adapterCall("fund_custody");
    assert.equal(fund.calldata[1], "0x1"); assert.equal(fund.calldata.at(-1), "0xdef");
    assert.equal(BigInt(fund.calldata[0]!), BigInt(fund.calldata.length - 2));
    assert.equal(shieldBundles.length, beforeShield);
  });


  await t.test("encrypted Rekber coordination handles paid agreements and replay-only confirmations", async () => {
    const beforeShield = shieldBundles.length;
    const setup: EscrowActionPayload = { kind: "create", dealOfferLocator: "a1", reason: "confidential Rekber agreement" };
    await sendEscrowCoordinationAction(publicAccount, key, setup);
    assert.deepEqual(lastCalls().map(call => call.entrypoint), ["approve", "post_escrow_action", "approve"]);
    assert.equal(lastCalls()[0]!.calldata[1], hex(10n ** 18n));
    assert.equal(adapterCall("post_escrow_action").calldata.at(-2), hex(10n ** 18n));
    await assertEncryptedEnvelope(adapterCall("post_escrow_action"), setup, 2);
    const confirmation: EscrowActionPayload = { kind: "fund_confirm", dealOfferLocator: "a1", reason: "confidential funding confirmation" };
    await sendEscrowCoordinationAction(publicAccount, key, confirmation);
    assert.deepEqual(lastCalls().map(call => call.entrypoint), ["post_escrow_action"]);
    assert.equal(adapterCall("post_escrow_action").calldata.at(-2), "0x0");
    await assertEncryptedEnvelope(adapterCall("post_escrow_action"), confirmation, 2);
    assert.equal(shieldBundles.length, beforeShield);
  });

  await t.test("all real Rekber lifecycle routes execute public custody actions with correct workflow funding", async () => {
    const beforeShield = shieldBundles.length;
    const cases: Array<{ operation: number; paid: boolean; run: () => Promise<unknown> }> = [
      { operation: 2, paid: false, run: () => settlement.releaseEscrow(publicAccount, { custodyCommitment: 1n, releaseAuthorizationSecret: 2n, payeeClaimSecret: 3n }) },
      { operation: 3, paid: false, run: () => settlement.refundEscrow(publicAccount, { custodyCommitment: 1n, refundSecret: 2n }) },
      { operation: 4, paid: true, run: () => settlement.submitRekberFulfillment(publicAccount, { custodyCommitment: 1n, chainSecret: 2n, evidenceCommitment: 3n }) },
      { operation: 5, paid: true, run: () => settlement.confirmRekberFulfillment(publicAccount, { custodyCommitment: 1n, confirmationSecret: 2n, evidenceCommitment: 3n }) },
      { operation: 7, paid: true, run: () => settlement.requestRekberRevision(publicAccount, { custodyCommitment: 1n, chainSecret: 2n, reasonCommitment: 3n }) },
      { operation: 6, paid: true, run: () => settlement.openRekberDispute(publicAccount, { custodyCommitment: 1n, role: "payer", disputeSecret: 2n, evidenceCommitment: 3n }) },
      { operation: 8, paid: false, run: () => settlement.autoReleaseEscrow(publicAccount, { custodyCommitment: 1n, payeeClaimSecret: 2n }) },
      { operation: 9, paid: false, run: () => settlement.mutualRefundEscrow(publicAccount, { custodyCommitment: 1n, refundSecret: 2n, payeeRefundConsentSecret: 3n }) },
      { operation: 10, paid: true, run: () => settlement.claimRekberResolution(publicAccount, { custodyCommitment: 1n, role: "payee", partySecret: 2n }) },
    ];
    const beforeReads = reads.length;
    for (const item of cases) {
      await item.run();
      assert.equal(adapterCall("act_custody").calldata[1], hex(item.operation));
      assert.deepEqual(lastCalls().map(call => call.entrypoint), item.paid ? ["approve", "act_custody", "approve"] : ["act_custody"], `operation ${item.operation}`);
      if (item.paid) assert.deepEqual(lastCalls()[0]!.calldata, ["0x20", hex(10n ** 18n), "0x0"]);
    }
    assert.ok(reads.slice(beforeReads).some(call => call.entrypoint === "get_custody"));
    assert.ok(reads.slice(beforeReads).filter(call => call.entrypoint === "get_custody").every(call => call.contractAddress === "0x25"));
    await settlement.chargeRekberWorkflowAction(publicAccount);
    assert.deepEqual(lastCalls(), [{ contractAddress: "0x30", entrypoint: "transfer", calldata: ["0x31", hex(10n ** 18n), "0x0"] }]);
    assert.equal(shieldBundles.length, beforeShield);
  });

  await t.test("work-confirm and revision attached to encrypted message reuse its paid workflow", async () => {
    const beforeShield = shieldBundles.length;
    for (const invoke of [
      settlement.buildConfirmFulfillmentInvoke({ custodyCommitment: 1n, confirmationSecret: 2n, evidenceCommitment: 3n }),
      settlement.buildRequestRevisionInvoke({ custodyCommitment: 1n, chainSecret: 2n, reasonCommitment: 3n }),
    ]) {
      await sendMessage(publicAccount, key, { kind: "text", body: "confidential work review", sentAt: "2026-10-24T00:00:00Z" }, undefined, undefined, () => [invoke]);
      assert.deepEqual(lastCalls().map(call => call.entrypoint), ["approve", "post_message", "act_custody", "approve"]);
      assert.equal(lastCalls()[0]!.calldata[1], "0x64");
    }
    assert.equal(shieldBundles.length, beforeShield);
  });

  await t.test("public Rekber typed approvals bind adapter and custody deployment", () => {
    const setup: EscrowActionPayload = { kind: "create", dealOfferLocator: "a1", custodyCommitment: "1", dealTermsCommitment: "2", senderAddress: "0xabc", recipientAddress: "0xdef", releaseAuthorizationCommitment: "3", refundCommitment: "4", payerConfirmationCommitment: "5", payerDisputeCommitment: "6", revisionChainHead: "7", payerCertificateCommitment: "8", refundAfter: "10000", transactionMode: "unshield", publicRailAddress: "0x20", publicRekberAddress: "0x25" };
    authorization.assertRekberRail(publicAccount, setup);
    const data = authorization.buildRekberSetupTypedData(setup);
    assert.equal((data.message as Record<string, unknown>)["Public Rail"], "0x20"); assert.equal((data.message as Record<string, unknown>)["Custody Contract"], "0x25");
    assert.ok(data.types[data.primaryType]!.some(field => field.name === "Public Rail" && field.type === "ContractAddress"));
    assert.throws(() => authorization.assertRekberRail(shieldAccount, setup), /another transaction mode/);
    assert.throws(() => authorization.assertRekberRail(publicAccount, { ...setup, publicRailAddress: "0x99" }), /another public deployment/);
    assert.throws(() => authorization.assertRekberRail(publicAccount, { ...setup, publicRekberAddress: "0x99" }), /another public deployment/);
    const acceptance: EscrowActionPayload = { ...setup, kind: "accept", senderAddress: "0xdef", recipientAddress: "0xabc", payeeClaimCommitment: "9", payeeDisputeCommitment: "10", payeeRefundConsentCommitment: "11", fulfillmentChainHead: "12", payeeCertificateCommitment: "13" };
    const approval = authorization.buildRekberAcceptanceTypedData(setup, acceptance);
    assert.equal((approval.message as Record<string, unknown>)["Public Rail"], "0x20"); assert.equal((approval.message as Record<string, unknown>)["Custody Contract"], "0x25");
    assert.throws(() => authorization.buildRekberAcceptanceTypedData(setup, { ...acceptance, publicRailAddress: "0x99" }), /different transaction rails/);
  });

  await t.test("Offer lifecycle uses the room mode in both rails and keeps pairwise terms encrypted", async () => {
    const pairwiseKey = new Uint8Array(32).fill(11);
    for (const mode of ["shield", "unshield"] as const) {
      for (const kind of ["create", "counter", "accept", "reject", "cancel", "expire"] as const) {
        const payload: OfferActionPayload = {
          kind, asset: "STRK", amount: "19.75", parentOfferLocator: "abc",
          paymentTerms: "pairwise offer terms", senderAddress: "0xabc", recipientAddress: "0xdef",
        };
        const beforePublic = executions.length, beforeShield = shieldBundles.length;
        await sendOfferAction(modes.accountForMode(account, mode, "same-offer-room"), key, payload, {
          recipientIdentity: "0xdef", encryptionKey: pairwiseKey, routingKey: pairwiseKey,
        });
        let data: string[];
        if (mode === "shield") {
          assert.equal(executions.length, beforePublic);
          assert.equal(shieldBundles.length, beforeShield + 1);
          const bundle = shieldBundles.at(-1) as Array<{ type: string; contract?: string; calldata?: string[] }>;
          assert.deepEqual(bundle.map(action => action.type), ["withdraw", "transfer", "invoke"]);
          assert.equal(bundle[2]!.contract, "0x13");
          data = bundle[2]!.calldata!;
          assert.equal(BigInt(data.at(-2)!), 200n);
        } else {
          assert.equal(shieldBundles.length, beforeShield);
          assert.deepEqual(lastCalls().map(call => call.entrypoint), ["approve", "post_offer", "approve"]);
          data = adapterCall("post_offer").calldata;
          assert.equal(BigInt(data.at(-3)!), 100n);
        }
        const ciphertext = data.slice(7, 7 + Number(BigInt(data[6]!))).map(BigInt);
        assert.deepEqual(await decryptPayload(pairwiseKey, ciphertext), payload);
        await assert.rejects(decryptPayload(key, ciphertext), /authentication/i);
        assert.ok(!JSON.stringify(data).includes(payload.paymentTerms!));
      }
    }
  });

  await t.test("missing, malformed, mismatched config and wallet/RPC network reject before execute", async () => {
    const actions: Actions = [{ type: "invoke", contract: "0x12", calldata: ["0x1", "0x1"] }];
    const before = executions.length, beforeShield = shieldBundles.length;
    const original = constants.PUBLIC_CONTRACTS.messageHelper;
    try {
      constants.PUBLIC_CONTRACTS.messageHelper = "";
      await assert.rejects(execution.invokeVinssActions(publicAccount, actions), /not configured/);
      constants.PUBLIC_CONTRACTS.messageHelper = "malformed";
      await assert.rejects(execution.invokeVinssActions(publicAccount, actions), /Invalid Starknet/);
    } finally { constants.PUBLIC_CONTRACTS.messageHelper = original; }
    const originalConfiguration = configuration;
    try {
      configuration = [...originalConfiguration]; configuration[4] = "0x99";
      await assert.rejects(execution.invokeVinssActions(publicAccount, actions), /configuration does not match/);
      configuration = ["0x0"];
      await assert.rejects(execution.invokeVinssActions(publicAccount, actions), /configuration does not match/);
    } finally { configuration = originalConfiguration; }
    try {
      walletChain = "0x534e5f4d41494e";
      await assert.rejects(execution.invokeVinssActions(publicAccount, actions), /Wallet network/);
      walletChain = chain; rpcChain = "0x534e5f4d41494e";
      await assert.rejects(execution.invokeVinssActions(publicAccount, actions), /RPC network/);
    } finally { walletChain = chain; rpcChain = chain; }
    const unbound = modes.accountForMode({ address: "0xabc", execute: account.execute } as WalletAccountV6, "unshield");
    await assert.rejects(execution.invokeVinssActions(unbound, actions), /Reconnect/);
    await assert.rejects(execution.invokeVinssActions(publicAccount, actions), /public locator nonce/);
    await assert.rejects(execution.invokeVinssActions(publicAccount, [{ type: "invoke", contract: "0x999", calldata: ["0x1", "0x1"] }]), /unregistered/);
    await assert.rejects(execution.invokeVinssActions(publicAccount, [{ type: "invoke", contract: "0x12", calldata: ["0x2", "0x1"] }]), /envelope length/);
    assert.equal(executions.length, before); assert.equal(shieldBundles.length, beforeShield);
  });
});
