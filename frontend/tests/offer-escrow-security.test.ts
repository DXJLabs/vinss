import assert from "node:assert/strict";
import test from "node:test";
import { ec, hash, typedData, type WalletAccountV6 } from "starknet";
import type { OfferActionPayload } from "../types/deal-room";
Object.assign(process.env, {
    NEXT_PUBLIC_STARKNET_NETWORK: "sepolia", NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:1",
    NEXT_PUBLIC_PRIVACY_POOL_ADDRESS: "0x10", NEXT_PUBLIC_OFFER_HELPER_ADDRESS: "0x13", NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS: "0x14",
    NEXT_PUBLIC_UNSHIELD_OFFER_HELPER_ADDRESS: "0x23", NEXT_PUBLIC_UNSHIELD_ESCROW_HELPER_ADDRESS: "0x24", NEXT_PUBLIC_UNSHIELD_ADAPTER_ADDRESS: "0x20", NEXT_PUBLIC_UNSHIELD_REKBER_ADDRESS: "0x25",
});
const key = new Uint8Array(32).fill(17);
const chain = "0x534e5f5345504f4c4941";
test("Offer authorship, selected-chain publication and paid-coordination boundaries", async (t) => {
    const { signOfferAction, verifyOfferAuthorship } = await import("../lib/deal-room/offerAuthorization");
    const { discoverOfferActions } = await import("../lib/deal-room/offers");
    const { discoverEscrowActions } = await import("../lib/deal-room/escrow");
    const { encryptPayload, shortStringToFelt } = await import("../lib/privacy/envelope");
    const { deriveMessageRoutingTag } = await import("../lib/privacy/messageRouting");
    const { getProvider } = await import("../lib/starknet/walletClient");
    const { accountForMode } = await import("../lib/starknet/transactionMode");
    const provider = getProvider();
    const { signRekberSetup, signRekberAcceptance } = await import("../lib/deal-room/rekberAuthorization");
    const privateKeys: Record<string, string> = { "0xa": "0x12345", "0xb": "0x67890" };
    function wallet(address: string): WalletAccountV6 { return { address, async signMessage(data: any) { const sig = ec.starkCurve.sign(typedData.getMessageHash(data, address), privateKeys[address]!); return ["0x" + sig.r.toString(16), "0x" + sig.s.toString(16)]; } } as any; }
    const alice = wallet("0xa"), bob = wallet("0xb"), publicAlice = accountForMode(alice, "unshield");
    let records: any[] = [], rpcChain = chain, trace: any;
    const stored = new Map<string, string[]>(), receipts = new Map<string, any>();
    const funded = new Set<string>();
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(records)));
    t.mock.method(provider, "getChainId", async () => rpcChain);
    t.mock.method(provider, "getTransactionTrace", async () => trace);
    t.mock.method(provider, "getTransactionReceipt", async (tx: any) => {
        if (!receipts.has(tx))
            throw new Error("No receipt");
        return receipts.get(tx);
    });
    t.mock.method(provider, "callContract", async (call: any) => {
        if (["isValidSignature", "is_valid_signature"].includes(call.entrypoint)) {
            try {
                const [digest, len, r, s] = call.calldata;
                assert.equal(BigInt(len), 2n);
                const pub = ec.starkCurve.getPublicKey(privateKeys[call.contractAddress]!);
                return [ec.starkCurve.verify(new ec.starkCurve.Signature(BigInt(r), BigInt(s)), "0x" + BigInt(digest).toString(16), pub) ? "0x56414c4944" : "0x0"];
            }
            catch {
                return ["0x0"];
            }
        }
        if (call.entrypoint === "custody_exists")
            return [funded.has(String(BigInt(call.calldata[0]))) ? "0x1" : "0x0"];
        const value = stored.get(call.contractAddress + ":" + BigInt(call.calldata[0]));
        if (!value)
            throw new Error("Helper record missing");
        return value;
    });
    const route = { recipientIdentity: "0xb", encryptionKey: key, routingKey: key };
    const terms: OfferActionPayload = { kind: "create", senderAddress: "0xa", recipientAddress: "0xb", asset: "STRK", amount: "10", paymentTerms: "confidential terms" };
    async function envelope(action: any, locator: bigint, kind: "offer" | "escrow" = "offer", helper = kind === "offer" ? "0x13" : "0x14") {
        const chunks = await encryptPayload(key, action);
        const sender = await deriveMessageRoutingTag(key, "sender", action.senderAddress, locator);
        const recipient = await deriveMessageRoutingTag(key, "recipient", action.recipientAddress, locator);
        const domain = kind === "offer" ? "VINSS_OFFER_COMMIT_V2" : "VINSS_PRIVATE_ESCROW_COMMIT_V2";
        const commitment = hash.computePoseidonHashOnElements([shortStringToFelt(domain), 2n, locator, sender, recipient, BigInt(chunks.length), ...chunks].map(String));
        const record = { actionLocator: String(locator), senderTag: String(sender), recipientTag: String(recipient), payloadCommitment: commitment, ciphertextChunks: chunks.map(String), blockNumber: 10, transactionHash: "0x" + locator.toString(16) };
        stored.set(helper + ":" + locator, ["2", String(locator), String(sender), String(recipient), commitment, String(chunks.length)]);
        receipts.set(record.transactionHash, { type: "INVOKE", transaction_hash: record.transactionHash, execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L2", block_number: 10, events: [{ from_address: helper, keys: [hash.getSelectorFromName(kind === "offer" ? "OfferActionCommitted" : "PrivateEscrowActionCommitted"), String(locator)], data: [commitment, String(sender), String(recipient)] }] });
        return record;
    }
    async function publicSetup() {
        const action: any = { kind: "create", coordinationVersion: 3, senderAddress: "0xa", recipientAddress: "0xb", custodyCommitment: "9", dealOfferLocator: "a1", dealTermsCommitment: "2", refundAfter: "10000", releaseAuthorizationCommitment: "3", refundCommitment: "4", payerConfirmationCommitment: "5", payerDisputeCommitment: "6", revisionChainHead: "7", payerCertificateCommitment: "8" };
        action.coordinationSignature = await signRekberSetup(publicAlice, action);
        return action;
    }
    await t.test("real wallet signature succeeds; peer forgery and replays across terms, locator, rail or helper fail", async () => {
        const signed = await signOfferAction(alice, terms, 1n);
        assert.equal(await verifyOfferAuthorship(signed, 1n, alice), true);
        for (const changed of [{ ...signed, amount: "100" }, { ...signed, parentOfferLocator: "0x123" }, { ...signed, kind: "accept" as const }])
            assert.equal(await verifyOfferAuthorship(changed, 1n, alice), false);
        assert.equal(await verifyOfferAuthorship(signed, 2n, alice), false);
        assert.equal(await verifyOfferAuthorship(signed, 1n, publicAlice), false);
        await assert.rejects(signOfferAction(bob, terms, 1n), /connected wallet/);
        const peerSigned = await signOfferAction(bob, { ...terms, senderAddress: "0xb", recipientAddress: "0xa" }, 3n);
        records = [await envelope({ ...peerSigned, senderAddress: "0xa", recipientAddress: "0xb", kind: "accept" }, 3n)];
        assert.equal((await discoverOfferActions("https://fixture.invalid", key, route, alice)).length, 0);
    });
    await t.test("a malformed record cannot hide a valid signed anchored Offer", async () => {
        records = [null, { actionLocator: "garbage", senderTag: "1", recipientTag: "2" }, await envelope(await signOfferAction(alice, terms, 4n), 4n)];
        const result = await discoverOfferActions("https://fixture.invalid", key, route, alice);
        assert.equal(result.length, 1);
        assert.equal(result[0]!.authorshipVerified, true);
    });
    await t.test("unsigned anchored legacy remains readable but never wallet-authenticated consent", async () => {
        records = [await envelope(terms, 5n)];
        const result = await discoverOfferActions("https://fixture.invalid", key, route, alice);
        assert.equal(result.length, 1);
        assert.equal(result[0]!.authorshipVerified, false);
    });
    await t.test("bad commitments, missing helper records, relabelled receipts, failed receipts and wrong RPC chain fail closed", async () => {
        for (const [i, mutate] of [
            (r: any) => { r.payloadCommitment = "0x1"; },
            (r: any) => { stored.delete("0x13:" + r.actionLocator); },
            (r: any) => { r.transactionHash = "0xfeed"; },
            (r: any) => { receipts.get(r.transactionHash).execution_status = "REVERTED"; },
            (r: any) => { receipts.get(r.transactionHash).events[0].from_address = "0x23"; },
            (r: any) => { receipts.get(r.transactionHash).events[0].data[0] = "0x1"; },
            (r: any) => { r.blockNumber = 11; },
            () => { rpcChain = "0x534e5f4d41494e"; },
        ].entries()) {
            const id = 10n + BigInt(i);
            const record = await envelope(await signOfferAction(alice, terms, id), id);
            mutate(record);
            records = [record];
            assert.equal((await discoverOfferActions("https://fixture.invalid", key, route, alice)).length, 0, "mutation " + i);
            rpcChain = chain;
        }
    });
    await t.test("paid Unshield coordination requires its exact fee-bearing invocation; another paid locator cannot cover a free action", async () => {
        const action = await publicSetup();
        const record = await envelope(action, 30n, "escrow", "0x24");
        records = [record];
        function invocation(r: any, fee: string) { return { contract_address: "0x20", entry_point_selector: hash.getSelectorFromName("post_escrow_action"), calldata: [String(6 + r.ciphertextChunks.length), "2", r.actionLocator, r.senderTag, r.recipientTag, r.payloadCommitment, String(r.ciphertextChunks.length), ...r.ciphertextChunks, fee, "7"], calls: [] }; }
        trace = { execute_invocation: { calls: [invocation(record, "0")] } };
        assert.equal((await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice)).length, 0);
        const other = await envelope(action, 31n, "escrow", "0x24");
        trace = { execute_invocation: { calls: [invocation(record, "0"), invocation(other, String(10n ** 18n))] } };
        assert.equal((await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice)).length, 0);
        trace = { execute_invocation: { calls: [invocation(record, String(10n ** 18n))] } };
        assert.equal((await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice)).length, 1);
        records = [await envelope({ ...action, kind: "fund_confirm" }, 32n, "escrow", "0x24")];
        trace = undefined;
        assert.equal((await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice)).length, 1, "background sync stays free");
        records = [{ ...records[0], payloadCommitment: "0x1" }];
        assert.equal((await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice)).length, 0);
    });
    await t.test("unpaid legacy coordination remains recovery-only when selected on-chain custody already exists", async () => {
        const action = await publicSetup();
        records = [await envelope(action, 40n, "escrow", "0x24")];
        trace = { execute_invocation: { calls: [] } };
        assert.equal((await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice)).length, 0);
        funded.add("9");
        const result = await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice);
        assert.equal(result.length, 1);
        assert.equal(result[0]!.recoveryOnly, true);
        funded.clear();
    });
    await t.test("unsigned setup and bogus release cannot poison signed agreement state", async () => {
        const setup = await publicSetup();
        const forged = { ...setup, coordinationSignature: undefined };
        records = [await envelope(forged, 50n, "escrow", "0x24")];
        funded.add("9");
        trace = { execute_invocation: { calls: [] } };
        assert.equal((await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice)).length, 0);
        const good = await envelope(setup, 51n, "escrow", "0x24");
        const badRelease = await envelope({ kind: "resolve", senderAddress: "0xa", recipientAddress: "0xb", custodyCommitment: "9", releaseAuthorizationSecret: "123" }, 52n, "escrow", "0x24");
        records = [badRelease, good];
        const result = await discoverEscrowActions("https://fixture.invalid", key, route, publicAlice);
        assert.equal(result.length, 1);
        assert.equal(result[0]!.action.kind, "create");
        funded.clear();
    });
    await t.test("legitimate signed setup and acceptance survive reverse discovery order; a forged acceptance is ignored", async () => {
        const setup = await publicSetup();
        const acceptance: any = { kind: "accept", coordinationVersion: 3, senderAddress: "0xb", recipientAddress: "0xa", custodyCommitment: "9", dealOfferLocator: "a1", dealTermsCommitment: "2", refundAfter: "10000", payeeClaimCommitment: "9", payeeDisputeCommitment: "10", payeeRefundConsentCommitment: "11", fulfillmentChainHead: "12", payeeCertificateCommitment: "13" };
        acceptance.coordinationSignature = await signRekberAcceptance(accountForMode(bob, "unshield"), setup, acceptance);
        const setupRecord = await envelope(setup, 60n, "escrow", "0x24");
        const acceptRecord = await envelope(acceptance, 61n, "escrow", "0x24");
        funded.add("9");
        trace = { execute_invocation: { calls: [] } };
        records = [acceptRecord, setupRecord];
        assert.deepEqual((await discoverEscrowActions("https://fixture.invalid", key, [route, { ...route, recipientIdentity: "0xa" }], publicAlice)).map(r => r.action.kind), ["create", "accept"]);
        records = [await envelope({ ...acceptance, payeeClaimCommitment: "999" }, 62n, "escrow", "0x24"), setupRecord];
        assert.deepEqual((await discoverEscrowActions("https://fixture.invalid", key, [route, { ...route, recipientIdentity: "0xa" }], publicAlice)).map(r => r.action.kind), ["create"]);
        funded.clear();
    });
});
test("prepared recovery settles early errors and preserves ambiguous post-preparation wallet errors", async () => {
    const { observeWalletOutcome, waitForWalletPreparation } = await import("../lib/deal-room/walletPreparation");
    const never = new Promise<void>(() => { });
    const outcome = observeWalletOutcome(Promise.reject(new Error("RPC preflight failed")));
    await assert.rejects(waitForWalletPreparation(never, outcome), /RPC preflight/);
    let resolve!: () => void, reject!: (reason: Error) => void;
    const ready = new Promise<void>(r => { resolve = r; });
    const wallet = new Promise<void>((_, r) => { reject = r; });
    const observed = observeWalletOutcome(wallet);
    const preparing = waitForWalletPreparation(ready, observed);
    resolve();
    await preparing;
    reject(new Error("ambiguous timeout"));
    const result = await observed;
    assert.equal(result.kind, "wallet_error");
    await assert.rejects(waitForWalletPreparation(never, observeWalletOutcome(Promise.resolve("without callback"))), /without prepared/);
});
test("signed lifecycle consent requires the proper authenticated parent, parties and unchanged accepted terms", async () => {
    const { validOfferLifecycle } = await import("../lib/deal-room/offerLifecycle");
    const root: OfferActionPayload = { kind: "create", senderAddress: "0xa", recipientAddress: "0xb", asset: "STRK", amount: "10", paymentTerms: "terms" };
    const accepted: OfferActionPayload = { ...root, kind: "accept", senderAddress: "0xb", recipientAddress: "0xa", parentOfferLocator: "0x1", rootOfferLocator: "0x1" };
    const record = (actionLocator: string, action: OfferActionPayload, authorshipVerified = true) => ({ actionLocator, action, authorshipVerified });
    assert.deepEqual([...validOfferLifecycle([record("1", root), record("2", accepted)])], ["1", "2"]);
    for (const changed of [{ ...accepted, senderAddress: "0xa", recipientAddress: "0xb" }, { ...accepted, amount: "100" }, { ...accepted, parentOfferLocator: "0x99" }, { ...accepted, rootOfferLocator: "0x99" }])
        assert.equal(validOfferLifecycle([record("1", root), record("2", changed)]).has("2"), false);
    assert.equal(validOfferLifecycle([record("1", root, false), record("2", accepted)]).has("2"), false);
    const cyclic = { ...accepted, kind: "counter" as const, parentOfferLocator: "0x2", rootOfferLocator: "0x2" };
    assert.equal(validOfferLifecycle([record("2", cyclic)]).size, 0);
});
test("unsigned children stay readable but cannot suppress genuine Offer controls", async () => {
    const { supersededOfferParents } = await import("../lib/deal-room/offerLifecycle");
    const action: OfferActionPayload = { kind: "accept", asset: "STRK", amount: "10", paymentTerms: "forged", parentOfferLocator: "0xabc" };
    assert.equal(supersededOfferParents([{ offerAction: action, offerAuthorshipVerified: false }]).has("abc"), false);
    assert.equal(supersededOfferParents([{ offerAction: action, offerAuthorshipVerified: true }]).has("abc"), true);
});
