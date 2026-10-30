import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { encryptLocalJson, decryptLocalJson } from "../lib/privacy/encryptedChatCache";
import type { ConversationEntry } from "../components/room/conversation/types";

test("non-exportable device key encrypts local history without exporting raw key bytes", async () => {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const value = { body: "private cached message" };
  const encrypted = await encryptLocalJson(key, value);
  assert.deepEqual(await decryptLocalJson(key, encrypted), value);
  await assert.rejects(crypto.subtle.exportKey("raw", key));
});

test("device history migration and failure recovery", async (t) => {
  const records = new Map<string, string>();
  let failWrite = false;
  const storage = {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { if (failWrite) throw new Error("storage quota"); records.set(key, value); },
    removeItem: (key: string) => { records.delete(key); },
  };
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: new IDBFactory() });
  // Storage is the external boundary; crypto and IndexedDB key persistence remain real.
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  t.after(() => { Reflect.deleteProperty(globalThis, "window"); Reflect.deleteProperty(globalThis, "indexedDB"); });
  const { readDirectHistory, writeDirectHistory } = await import("../lib/privacy/deviceHistory");
  const roomKey = new Uint8Array(32).fill(7);
  const directKey = new Uint8Array(32).fill(9);
  const options = { roomId: "room-a", walletAddress: "0x00123", peerAddress: "0x456", roomKey, directKey };
  const old = "vinss:direct-history:v2:room-a:0x123:0x456";
  const legacy = "vinss:direct-history:v1:room-a:0x123:0x456";
  const next = "vinss:direct-history:v3:room-a:0x123:0x456";
  const entry = (actionLocator: string, summary: string): ConversationEntry => ({ actionLocator, summary, sentAt: "2026-10-31T00:00:00Z", kind: "message", id: actionLocator, transactionHash: "0xaaa" });
  const a = entry("abc", "private legacy history");
  const b = entry("def", "private v2 history");
  records.set(old, JSON.stringify(await encryptLocalJson(roomKey, { version: 1, savedAt: 1, entries: [b] })));
  records.set(legacy, JSON.stringify(await encryptLocalJson(directKey, { version: 1, savedAt: 1, entries: [a] })));

  await t.test("quota failure preserves all old copies", async () => {
    failWrite = true;
    await assert.rejects(readDirectHistory(options), /quota/);
    assert.ok(records.has(old) && records.has(legacy));
    assert.ok(!records.has(next));
    failWrite = false;
  });
  await t.test("migrates both old versions and removes weak copies only after verified write", async () => {
    const history = await readDirectHistory(options);
    assert.deepEqual(history.map(item => item.summary), [a.summary, b.summary]);
    assert.ok(!records.has(old) && !records.has(legacy));
    const saved = JSON.parse(records.get(next)!);
    await assert.rejects(decryptLocalJson(roomKey, saved));
    await assert.rejects(decryptLocalJson(directKey, saved));
    assert.ok(!records.get(next)!.includes("private"));
    assert.deepEqual(await readDirectHistory({ ...options, walletAddress: "0x123" }), history);
  });
  await t.test("concurrent updates retain both entries and preserve read receipts", async () => {
    await Promise.all([
      writeDirectHistory(options, [{ ...a, readAt: "2026-10-31T01:00:00Z" }]),
      writeDirectHistory(options, [entry("fed", "new private message")]),
    ]);
    const history = await readDirectHistory(options);
    assert.equal(history.length, 3);
    assert.equal(history.find(item => item.actionLocator === "abc")?.readAt, "2026-10-31T01:00:00Z");
    assert.deepEqual(await readDirectHistory({ ...options, walletAddress: "0x789" }), []);
  });
  await t.test("first writes for different peers converge on one persisted wallet key", async () => {
    const first = { ...options, walletAddress: "0x987", peerAddress: "0x111" };
    const second = { ...first, peerAddress: "0x222" };
    await Promise.all([writeDirectHistory(first, [a]), writeDirectHistory(second, [b])]);
    assert.equal((await readDirectHistory(first))[0]?.summary, a.summary);
    assert.equal((await readDirectHistory(second))[0]?.summary, b.summary);
    const firstRaw = records.get("vinss:direct-history:v3:room-a:0x987:0x111")!;
    records.set("vinss:direct-history:v3:room-a:0x987:0x222", firstRaw);
    await assert.rejects(readDirectHistory(second), /context mismatch/);
  });
  await t.test("unreadable legacy history survives until the correct key becomes available", async () => {
    const otherRoom = { ...options, roomId: "room-b" };
    const legacyKey = "vinss:direct-history:v2:room-b:0x123:0x456";
    const original = JSON.stringify(await encryptLocalJson(roomKey, { version: 1, savedAt: 1, entries: [a] }));
    records.set(legacyKey, original);
    await writeDirectHistory({ ...otherRoom, roomKey: directKey }, [b]);
    assert.equal(records.get(legacyKey), original);
    assert.equal((await readDirectHistory(otherRoom)).length, 2);
    assert.equal(records.has(legacyKey), false);
  });
  await t.test("corrupt device cache blocks overwrite and preserves legacy recovery", async () => {
    const corrupted = JSON.parse(records.get(next)!);
    corrupted.ciphertext = "AAAA";
    const raw = JSON.stringify(corrupted);
    records.set(next, raw);
    records.set(old, JSON.stringify(await encryptLocalJson(roomKey, { version: 1, savedAt: 1, entries: [b] })));
    await assert.rejects(writeDirectHistory(options, [a]));
    assert.equal(records.get(next), raw);
    assert.ok(records.has(old));
  });
});
