import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { encryptLocalJson, decryptLocalJson } from "../lib/privacy/encryptedChatCache";
import { saveRekberSecrets, loadRekberSecrets, type StoredRekberSecrets } from "../lib/deal-room/rekberSecrets";
import { readOfferHistory, writeOfferHistory } from "../lib/deal-room/offerHistory";
import type { ConversationEntry } from "../components/room/conversation/types";
test("Offer and funded-custody device storage migration, isolation and recovery", async (t) => {
    const records = new Map<string, string>();
    let quota = false;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: new IDBFactory() });
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (k: string) => records.get(k) ?? null, setItem: (k: string, v: string) => {
                    if (quota)
                        throw new Error("quota");
                    records.set(k, v);
                }, removeItem: (k: string) => records.delete(k) } } });
    t.after(() => { Reflect.deleteProperty(globalThis, "window"); Reflect.deleteProperty(globalThis, "indexedDB"); });
    const roomKey = new Uint8Array(32).fill(3);
    const secret: StoredRekberSecrets = { version: 2, custodyCommitment: "9", role: "payer", refundSecret: "12345", certificateSecret: "54321", savedAt: "2026-10-31T00:00:00Z" };
    const old = "vinss:rekber-secrets:v2:room:0xa:9", next = old.replace(":v2:", ":v3:");
    const raw = JSON.stringify(await encryptLocalJson(roomKey, secret));
    records.set(old, raw);
    await t.test("failed migration preserves legacy and a retry retains exact funded capabilities", async () => {
        quota = true;
        await assert.rejects(loadRekberSecrets("room", "0xa", 9n, roomKey), /quota/);
        assert.equal(records.get(old), raw);
        assert.equal(records.has(next), false);
        quota = false;
        assert.deepEqual(await loadRekberSecrets("room", "0x000a", 9n, roomKey), secret);
        assert.equal(records.has(old), false);
        await assert.rejects(decryptLocalJson(roomKey, JSON.parse(records.get(next)!)));
        assert.equal(records.get(next)!.includes(secret.refundSecret!), false);
        assert.deepEqual(await loadRekberSecrets("room", "0xa", 9n, new Uint8Array(32).fill(4)), secret, "device recovery no longer depends on the room key");
    });
    await t.test("pending coordination may update, custody capabilities cannot be silently rotated", async () => {
        await saveRekberSecrets("room", "0xa", 9n, roomKey, { ...secret, pendingCoordinationPayload: { kind: "create", dealOfferLocator: "0x1" }, savedAt: "2026-10-31T00:01:00Z" });
        assert.equal((await loadRekberSecrets("room", "0xa", 9n, roomKey))?.pendingCoordinationPayload?.kind, "create");
        const before = records.get(next);
        await assert.rejects(saveRekberSecrets("room", "0xa", 9n, roomKey, { ...secret, refundSecret: "999" }), /cannot be replaced/);
        assert.equal(records.get(next), before);
    });
    await t.test("another wallet/custody cannot decrypt copied recovery and invalid old data cannot destroy valid device data", async () => {
        records.set("vinss:rekber-secrets:v3:room:0xb:9", records.get(next)!);
        await assert.rejects(loadRekberSecrets("room", "0xb", 9n, roomKey));
        records.set("vinss:rekber-secrets:v3:room:0xa:a", records.get(next)!);
        await assert.rejects(loadRekberSecrets("room", "0xa", 10n, roomKey), /context/);
        records.set(old, "invalid old JSON");
        assert.equal((await loadRekberSecrets("room", "0xa", 9n, roomKey))?.refundSecret, "12345");
        assert.equal(records.get(old), "invalid old JSON");
        records.delete(old);
    });
    await t.test("corrupt device data blocks overwrite instead of generating replacement secrets", async () => {
        const original = records.get(next)!;
        records.set(next, "bad JSON");
        records.set(old, raw);
        await assert.rejects(saveRekberSecrets("room", "0xa", 9n, roomKey, secret));
        assert.equal(records.get(next), "bad JSON");
        assert.equal(records.get(old), raw);
        records.set(next, original);
        records.delete(old);
    });
    await t.test("Offer history migrates and stale pending entries remain removable", async () => {
        const entry = (id: string, tx = "0xabc"): ConversationEntry => ({ id, kind: "offer", actionLocator: id, summary: "private offer", transactionHash: tx, sentAt: "2026-10-31T00:00:00Z" });
        const legacy = "vinss:offer-history:v1:room:0xa";
        records.set(legacy, JSON.stringify(await encryptLocalJson(roomKey, { version: 1, savedAt: 1, entries: [entry("a")] })));
        assert.equal((await readOfferHistory("room", "0xa", roomKey)).length, 1);
        assert.equal(records.has(legacy), false);
        const device = records.get("vinss:offer-history:v2:room:0xa")!;
        await assert.rejects(decryptLocalJson(roomKey, JSON.parse(device)));
        await writeOfferHistory("room", "0xa", roomKey, [entry("a"), entry("b", "")]);
        await writeOfferHistory("room", "0xa", roomKey, [entry("a")]);
        assert.deepEqual((await readOfferHistory("room", "0xa", roomKey)).map(e => e.id), ["a"]);
        await Promise.all([writeOfferHistory("room", "0xa", roomKey, [entry("c")]), writeOfferHistory("room", "0xa", roomKey, [entry("d")])]);
        assert.deepEqual((await readOfferHistory("room", "0xa", roomKey)).map(e => e.id), ["a", "c", "d"]);
    });
    await t.test("unavailable device key storage never falls back to the shared room key", async () => {
        const database = globalThis.indexedDB;
        Reflect.deleteProperty(globalThis, "indexedDB");
        try {
            await assert.rejects(saveRekberSecrets("room", "0xa", 11n, roomKey, { ...secret, custodyCommitment: "11" }));
            assert.equal(records.has("vinss:rekber-secrets:v2:room:0xa:b"), false);
        }
        finally {
            Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: database });
        }
    });
});
