import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { IDBFactory } from "fake-indexeddb";
import { ec, hash, typedData, type WalletAccountV6 } from "starknet";
import type { GeneratedOpenMlsWasmModule } from "../lib/openmls-core/openmls/wasm-api";
Object.assign(process.env, {
    NEXT_PUBLIC_STARKNET_NETWORK: "sepolia", NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:1", NEXT_PUBLIC_BACKEND_URL: "https://shield.invalid",
    NEXT_PUBLIC_PRIVACY_POOL_ADDRESS: "0x10", NEXT_PUBLIC_INVITE_ADDRESS: "0x11", NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS: "0x12", NEXT_PUBLIC_OFFER_HELPER_ADDRESS: "0x13", NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS: "0x14", NEXT_PUBLIC_ESCROW_REKBER_ADDRESS: "0x15",
    NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN: "0x32", NEXT_PUBLIC_OFFER_HELPER_OPEN_NOTE_TOKEN: "0x32", NEXT_PUBLIC_STRK_ADDRESS: "0x30", NEXT_PUBLIC_VINSS_TREASURY_ADDRESS: "0x31",
    NEXT_PUBLIC_UNSHIELD_ADAPTER_ADDRESS: "0x20", NEXT_PUBLIC_UNSHIELD_INVITE_ADDRESS: "0x21", NEXT_PUBLIC_UNSHIELD_MESSAGE_HELPER_ADDRESS: "0x22", NEXT_PUBLIC_UNSHIELD_OFFER_HELPER_ADDRESS: "0x23", NEXT_PUBLIC_UNSHIELD_ESCROW_HELPER_ADDRESS: "0x24", NEXT_PUBLIC_UNSHIELD_REKBER_ADDRESS: "0x25", NEXT_PUBLIC_UNSHIELD_FEE_POLICY_ADDRESS: "0x40", NEXT_PUBLIC_UNSHIELD_BACKEND_URL: "https://public.invalid",
});
test("actual WASM over real VINSS Shield/Unshield messaging: signed onboarding, receipts, reload and pending recovery", async (t) => {
    const { StarknetOpenMlsChat } = await import("../lib/openmls-core/starknet-mls-chat");
    const { getProvider } = await import("../lib/starknet/walletClient");
    const { accountForMode, bindAccountWallet } = await import("../lib/starknet/transactionMode");
    const { createOpenMlsWasmLoader } = await import("../lib/openmls-core/openmls/runtime");
    const { BrowserOpenMlsBridge } = await import("../lib/openmls-core/openmls/browser-bridge");
    const { IndexedDbOpenMlsCheckpointStore } = await import("../lib/openmls-core/openmls/indexeddb-checkpoint-store");
    const loader = createOpenMlsWasmLoader(async () => await import("../lib/openmls/vinss_mls.js") as unknown as GeneratedOpenMlsWasmModule, { module_or_path: await readFile(new URL("../lib/openmls/vinss_mls_bg.wasm", import.meta.url)) });
    const store = new IndexedDbOpenMlsCheckpointStore({ dbName: "mls-ledger-test", indexedDB: new IDBFactory(), crypto: globalThis.crypto });
    const chain = "0x534e5f5345504f4c4941", room = "ca2c0073-e2a8-4000-a000-123456789012";
    const aliceAddress = "0x1" + "a".repeat(62), bobAddress = "0x2" + "b".repeat(62);
    const keys: Record<string, string> = { [aliceAddress]: "0x12345", [bobAddress]: "0x67890" };
    const records: any[] = [], stored = new Map<string, string[]>(), receipts = new Map<string, any>();
    let transactions = 0, hideDiscovery = false, unknownWallet = false;
    function publish(helper: string, data: string[]) {
        const [version, locator, senderTag, recipientTag, commitment, count] = data;
        const chunks = data.slice(6, 6 + Number(BigInt(count!)));
        const transactionHash = "0x" + (++transactions).toString(16), blockNumber = transactions;
        stored.set(helper + ":" + BigInt(locator!), [version!, locator!, senderTag!, recipientTag!, commitment!, count!]);
        records.push({ helper, actionLocator: locator, payloadCommitment: commitment, senderTag, recipientTag, ciphertextChunks: chunks, blockNumber, transactionHash });
        receipts.set(transactionHash, { type: "INVOKE", transaction_hash: transactionHash, execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L2", block_number: blockNumber, events: [{ from_address: helper, keys: [hash.getSelectorFromName("MessageCommitted"), locator], data: [commitment, senderTag, recipientTag] }] });
        return { transaction_hash: transactionHash };
    }
    function wallet(address: string): WalletAccountV6 {
        const account = { address, async signMessage(data: any) { const signature = ec.starkCurve.sign(typedData.getMessageHash(data, address), keys[address]!); return ["0x" + signature.r.toString(16), "0x" + signature.s.toString(16)]; },
            async strk20InvokeTransaction(actions: any[]) { const invoke = actions.find(action => action.type === "invoke"); const result = publish(invoke.contract, invoke.calldata.slice(1, -2)); if (unknownWallet)
                throw new Error("mobile callback interrupted"); return result; },
            async execute(calls: any[]) { const call = calls.find(call => call.entrypoint === "post_message"); assert.ok(call); return publish("0x22", call.calldata.slice(1, 1 + Number(BigInt(call.calldata[0])))); }
        } as unknown as WalletAccountV6;
        bindAccountWallet(account, { features: { "starknet:walletApi": { request: async () => chain } } });
        return account;
    }
    const a = wallet(aliceAddress), b = wallet(bobAddress), provider = getProvider();
    t.mock.method(globalThis, "fetch", async (url: any) => new Response(JSON.stringify(hideDiscovery ? [] : records.filter(record => record.helper === (String(url).startsWith("https://public.invalid") ? "0x22" : "0x12")))));
    t.mock.method(provider, "getChainId", async () => chain);
    t.mock.method(provider, "getTransactionReceipt", async (tx: any) => { const value = receipts.get(tx); if (!value)
        throw new Error("Unknown receipt"); return value; });
    t.mock.method(provider, "callContract", async (call: any) => {
        if (call.entrypoint === "get_configuration")
            return ["8", "0x31", "0x30", "0x21", "0x22", "0x23", "0x24", "0x25", "0x40"];
        if (call.entrypoint === "get_fee_policy")
            return [call.contractAddress === "0x22" ? "0x40" : "0x41"];
        if (call.entrypoint === "quote_fee")
            return ["0x64"];
        if (["isValidSignature", "is_valid_signature"].includes(call.entrypoint)) {
            try {
                const [digest, len, r, s] = call.calldata;
                assert.equal(BigInt(len), 2n);
                return [ec.starkCurve.verify(new ec.starkCurve.Signature(BigInt(r), BigInt(s)), "0x" + BigInt(digest).toString(16), ec.starkCurve.getPublicKey(keys[call.contractAddress]!)) ? "0x56414c4944" : "0x0"];
            }
            catch {
                return ["0x0"];
            }
        }
        const record = stored.get(call.contractAddress + ":" + BigInt(call.calldata[0]));
        if (!record)
            throw new Error("Unknown helper record");
        return record;
    });
    const wrapperKey = new Uint8Array(32).fill(9);
    async function session(account: WalletAccountV6, peer: string, installationId: string, mode: "shield" | "unshield" = "shield") {
        const scoped = accountForMode(account, mode);
        return StarknetOpenMlsChat.initialize({ identity: { chainId: chain, roomId: room, walletAddress: account.address, installationId }, peerAddress: peer,
            transport: { account: scoped, network: chain, roomId: room, scope: "direct", encryptionKey: wrapperKey, messagingPublicKey: "0x04" + "ab".repeat(64), outboundRoute: { recipientIdentity: peer, encryptionKey: wrapperKey, routingKey: wrapperKey }, inboundRoutes: [account.address, peer].map(recipientIdentity => ({ recipientIdentity, encryptionKey: wrapperKey, routingKey: wrapperKey })), backendUrl: mode === "shield" ? "https://shield.invalid" : "https://public.invalid" },
            sessionFactory: async (identity) => { const bridge = new BrowserOpenMlsBridge(loader, store); const scope = [identity.chainId, identity.roomId, identity.walletAddress, identity.installationId].join(":"); await bridge.initialize({ userId: identity.walletAddress, installationId: scope, credential: new TextEncoder().encode(scope) }); return bridge; } });
    }
    let alice = await session(a, bobAddress, "phone-a");
    const bob = await session(b, aliceAddress, "phone-b");
    const approve = async () => true;
    await alice.publishKeyPackage(approve);
    await bob.publishKeyPackage(approve);
    await assert.rejects(bob.invitePeer(approve), /designated/);
    // The membership commit is durable before the wallet signs its Welcome.
    const cancelledSignature = t.mock.method(a, "signMessage", async () => { throw new Error("wallet signature cancelled"); });
    await assert.rejects(alice.invitePeer(approve), /signature cancelled/);
    cancelledSignature.mock.restore();
    alice = await session(a, bobAddress, "phone-a");
    assert.equal((await alice.status()).pending, "welcome", "a prepared membership commit must remain resumable before a transport plan exists");
    // A newer device package must not retarget an already prepared Welcome.
    const newerBob = await session(b, aliceAddress, "phone-b-new");
    await newerBob.publishKeyPackage(approve);
    // Crash after the Welcome is proved and the commit merged, before transport cleanup.
    const interrupted = t.mock.method(alice.bridge, "markGroupStatePublished", async () => { throw new Error("simulated browser close"); });
    await assert.rejects(alice.resumePending(approve), /browser close/);
    interrupted.mock.restore();
    const afterWelcome = transactions;
    alice = await session(a, bobAddress, "phone-a");
    await assert.rejects(alice.sendText("Do not advance the ratchet during Welcome recovery", approve), /unfinished packet/);
    assert.equal((await alice.status()).pendingBody, undefined, "a conflicting operation must not encrypt another message");
    await alice.resumePending(approve);
    assert.equal(transactions, afterWelcome, "recovery must not republish an already proved Welcome");
    assert.equal((await alice.status()).pending, undefined);
    assert.equal(await bob.joinFromPeerWelcome(), true);
    const { signMlsWelcome, verifyMlsWelcome } = await import("../lib/openmls-core/starknet-keypackage-attestation");
    const now = Date.now(), bytes = new Uint8Array([0, 1, 2, 255]);
    const signed = await signMlsWelcome({ chainId: chain, roomId: room, conversationId: alice.conversationId, walletAddress: a.address, recipientAddress: b.address, installationId: "phone-a", recipientInstallationId: "phone-b", issuedAt: now, expiresAt: now + 60000 }, bytes, async (data) => await a.signMessage(data) as string[]);
    const scope = { chainId: chain, roomId: room, conversationId: alice.conversationId, senderAddress: a.address, recipientAddress: b.address, recipientInstallationId: "phone-b" };
    assert.deepEqual(await verifyMlsWelcome(signed, scope, StarknetOpenMlsChat.walletVerifier), bytes);
    await assert.rejects(verifyMlsWelcome({ ...signed, installationId: "forged-device" }, scope, StarknetOpenMlsChat.walletVerifier), /authentication/);
    await assert.rejects(verifyMlsWelcome(signed, { ...scope, roomId: "other-room" }, StarknetOpenMlsChat.walletVerifier), /scope/);
    await assert.rejects(verifyMlsWelcome(signed, { ...scope, recipientInstallationId: "other-device" }, StarknetOpenMlsChat.walletVerifier), /scope/);
    const first = await alice.sendText("Actual OpenMLS secret", approve);
    assert.ok(first.receipts.length > 0);
    assert.ok(first.receipts.every(receipt => receipts.has(receipt.transactionHash)));
    assert.equal((await bob.receiveTexts()).at(-1)?.message.body, "Actual OpenMLS secret");
    // Reload consumes the durable encrypted inbox, not the already-deleted message ratchet secret.
    const reloadedBob = await session(b, aliceAddress, "phone-b", "unshield");
    assert.equal((await reloadedBob.receiveTexts()).at(-1)?.message.body, "Actual OpenMLS secret");
    await reloadedBob.sendText("Reply through Unshield", approve);
    assert.equal((await alice.receiveTexts()).at(-1)?.message.body, "Reply through Unshield");
    assert.ok(records.some(record => record.helper === "0x22"));
    const before = transactions;
    unknownWallet = true;
    await alice.sendText("Confirmed despite ambiguous callback", approve);
    unknownWallet = false;
    assert.ok(transactions > before);
    assert.equal((await reloadedBob.receiveTexts()).at(-1)?.message.body, "Confirmed despite ambiguous callback");
    // A persisted but unsubmitted logical message resumes its original MLS ciphertext.
    await assert.rejects(alice.sendText("Resume this exact message", async () => false), /not approved/);
    const restoredAlice = await session(a, bobAddress, "phone-a");
    assert.equal((await restoredAlice.status()).pendingBody, "Resume this exact message");
    await assert.rejects(restoredAlice.sendText("Different message", approve), /pending message/);
    await restoredAlice.sendText("Resume this exact message", approve);
    assert.equal((await reloadedBob.receiveTexts()).at(-1)?.message.body, "Resume this exact message");
    const all = await reloadedBob.receiveTexts();
    assert.equal(all.filter(item => item.message.body === "Resume this exact message").length, 1);
    // Crash between the atomic ratchet/application checkpoint and packet framing.
    const beforeFraming = transactions;
    const encrypt = restoredAlice.bridge.encryptApplicationMessage.bind(restoredAlice.bridge);
    const closedAfterEncryption = t.mock.method(restoredAlice.bridge, "encryptApplicationMessage", async (input: Parameters<typeof encrypt>[0]) => {
        await encrypt(input);
        throw new Error("browser closed before framing");
    });
    await assert.rejects(restoredAlice.sendText("Resume before transport exists", approve), /before framing/);
    closedAfterEncryption.mock.restore();
    assert.equal(transactions, beforeFraming);
    const durable = JSON.parse(new TextDecoder().decode(restoredAlice.bridge.readApplicationState()));
    assert.ok(durable.pendingApplication.ciphertext.length > 0);
    assert.equal(durable.pendingTransport, undefined);
    const afterEncryption = await session(a, bobAddress, "phone-a");
    assert.equal((await afterEncryption.status()).pending, "application");
    const forbiddenReencrypt = t.mock.method(afterEncryption.bridge, "encryptApplicationMessage", async () => { throw new Error("must reuse the persisted ciphertext"); });
    await afterEncryption.resumePending(approve);
    forbiddenReencrypt.mock.restore();
    assert.equal((await afterEncryption.status()).pending, undefined);
    assert.equal((await reloadedBob.receiveTexts()).filter(item => item.message.body === "Resume before transport exists").length, 1);
    // Crash after the first fragment reaches chain, before its receipt is checkpointed.
    const beforeFragment = transactions;
    const save = afterEncryption.bridge.saveApplicationState.bind(afterEncryption.bridge);
    const closedAfterFragment = t.mock.method(afterEncryption.bridge, "saveApplicationState", async (bytes: Uint8Array) => {
        const state = JSON.parse(new TextDecoder().decode(bytes));
        if (state.pendingTransport?.frames.some((frame: any) => frame.receipt))
            throw new Error("browser closed after fragment publication");
        await save(bytes);
    });
    const fragmentedBody = "Partial publication ".repeat(60);
    await assert.rejects(afterEncryption.sendText(fragmentedBody, approve), /after fragment publication/);
    closedAfterFragment.mock.restore();
    assert.equal(transactions, beforeFragment + 1);
    const interruptedPlan = JSON.parse(new TextDecoder().decode(afterEncryption.bridge.readApplicationState())).pendingTransport;
    assert.ok(interruptedPlan.frames.length > 1);
    const wrongRail = await session(a, bobAddress, "phone-a", "unshield");
    await assert.rejects(wrongRail.resumePending(approve), /another transaction mode/);
    assert.equal(transactions, beforeFragment + 1, "switching rails cannot republish a pending fragment");
    const resumedFragment = await session(a, bobAddress, "phone-a");
    await resumedFragment.resumePending(approve);
    assert.equal(transactions, beforeFragment + interruptedPlan.frames.length, "recovery publishes only the missing fragments");
    assert.equal((await reloadedBob.receiveTexts()).filter(item => item.message.body === fragmentedBody.trim()).length, 1);
    assert.equal(JSON.stringify(records).includes("Actual OpenMLS secret"), false);
});
