import assert from "node:assert/strict";
import test from "node:test";
import { encryptPayload, decryptPayload } from "../lib/privacy/envelope";
import { encryptLocalJson, decryptLocalJson } from "../lib/privacy/encryptedChatCache";
import { deriveChannelKeyFromRoomSecret } from "../lib/privacy/channelKey";
import { deriveMessageRoutingTag, commitMessagePayloadV2 } from "../lib/privacy/messageRouting";
import { discoverMessages } from "../lib/deal-room/messaging";

const directKey = new Uint8Array(32).fill(19);
const payload = {
  kind: "text", scope: "direct", body: "PRIVATE_AUDIT_SENTINEL_2026",
  senderIdentity: { address: "0x123", messagingPublicKey: "test-public-key" },
  recipientAddress: "0x456", sentAt: "2026-10-31T00:00:00Z",
};

test("message ciphertext roundtrips while wrong keys and tampering fail", async () => {
  const first = await encryptPayload(directKey, payload);
  const second = await encryptPayload(directKey, payload);
  assert.notDeepEqual(first, second, "Fresh encryption must randomize repeated messages");
  assert.deepEqual(await decryptPayload(directKey, first), payload);
  await assert.rejects(decryptPayload(new Uint8Array(32).fill(20), first), /authentication/i);
  const modified = [...first];
  modified[modified.length - 1] = modified.at(-1)! ^ 1n;
  await assert.rejects(decryptPayload(directKey, modified), /authentication/i);
});

test("discovery sends no plaintext/key and joins readable body with chain metadata only locally", async (t) => {
  const locator = 0x987n;
  const senderTag = await deriveMessageRoutingTag(directKey, "sender", "0x123", locator);
  const recipientTag = await deriveMessageRoutingTag(directKey, "recipient", "0x456", locator);
  const chunks = await encryptPayload(directKey, payload);
  const record = {
    actionLocator: String(locator), senderTag: String(senderTag), recipientTag: String(recipientTag),
    payloadCommitment: String(commitMessagePayloadV2(locator, senderTag, recipientTag, chunks)),
    ciphertextChunks: chunks.map(String), blockNumber: 123, transactionHash: "0xabc",
  };
  const wire = JSON.stringify(record);
  assert.ok(!wire.includes(payload.body));
  assert.ok(!("message" in record) && !("body" in record));
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, options?: RequestInit) => {
    assert.equal(String(_url), "https://audit.invalid/discover");
    assert.deepEqual(JSON.parse(String(options?.body)), { kind: "message" });
    return new Response(JSON.stringify([record]), { status: 200 });
  });
  const result = await discoverMessages("https://audit.invalid", new Uint8Array(32), {
    recipientIdentity: "0x456", encryptionKey: directKey, routingKey: directKey,
  });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0]!.message, payload);
  assert.equal(result[0]!.transactionHash, record.transactionHash);
  assert.equal((await discoverMessages("https://audit.invalid", directKey, {
    recipientIdentity: "0x456", encryptionKey: new Uint8Array(32), routingKey: directKey,
  })).length, 0);
});

test("local encrypted cache protects content only while its room-derived key remains secret", async () => {
  const roomSecret = "audit-fixture-room-secret";
  const roomKey = await deriveChannelKeyFromRoomSecret(roomSecret);
  const clearHistory = { entries: [{ summary: payload.body, transactionHash: "0xabc" }] };
  const stored = await encryptLocalJson(roomKey, clearHistory);
  assert.deepEqual(Object.keys(stored).sort(), ["ciphertext", "iv", "version"]);
  assert.ok(!JSON.stringify(stored).includes(payload.body));
  await assert.rejects(decryptLocalJson(directKey, stored));
  // Audit reproducer: the exposed room secret is sufficient to decrypt v2 history.
  const recoveredKey = await deriveChannelKeyFromRoomSecret(roomSecret);
  assert.deepEqual(await decryptLocalJson(recoveredKey, stored), clearHistory);
});
