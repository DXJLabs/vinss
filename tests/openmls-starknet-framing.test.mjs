import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const {
  frameStarknetMlsPacket, parseStarknetMlsFrame,
  reassembleStarknetMlsFrames,
  MLS_FRAME_BYTES, MLS_MAX_PAYLOAD_BYTES,
} = await import("../frontend/lib/openmls-core/starknet-framing.ts");

const ctx = { kind: "welcome", network: "SN_SEPOLIA", roomId: "room-1", sender: "0x123" };
const bytes = (size) => Uint8Array.from({ length: size }, (_, i) => (i * 37) % 256);

test("single MLS ciphertext is preserved byte for byte, including zero bytes", async () => {
  const input = bytes(128); input[0] = 0; input[30] = 0;
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: input });
  assert.equal(chunks.length, 1);
  const out = await reassembleStarknetMlsFrames(chunks);
  assert.equal(out.complete.length, 1);
  assert.deepEqual(out.complete[0].bytes, input);
});
test("larger Welcome/Commit payloads are split, shuffled and recovered", async () => {
  const input = bytes(3800);
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: input });
  assert.equal(chunks.length, Math.ceil(input.length / MLS_FRAME_BYTES));
  const out = await reassembleStarknetMlsFrames([...chunks].reverse());
  assert.equal(out.complete.length, 1);
  assert.deepEqual(out.complete[0].bytes, input);
});
test("missing fragment is never delivered to MLS", async () => {
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: bytes(1300) });
  const out = await reassembleStarknetMlsFrames(chunks.slice(0, -1));
  assert.equal(out.complete.length, 0);
  assert.equal(out.incomplete[0].received, chunks.length - 1);
});
test("duplicate fragments do not duplicate packets", async () => {
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: bytes(820) });
  const out = await reassembleStarknetMlsFrames([...chunks, ...chunks]);
  assert.equal(out.complete.length, 1);
});
test("tampering is rejected by checksum", async () => {
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: bytes(810) });
  const first = parseStarknetMlsFrame(chunks[0]);
  const modified = { ...first, digest: "0".repeat(64) };
  const newFirst = "vinss:mls:v1:" + JSON.stringify(modified);
  const out = await reassembleStarknetMlsFrames([newFirst, ...chunks.slice(1)]);
  assert.equal(out.complete.length, 0);
  assert.equal(out.rejected.length, 1);
});
test("cross-network and cross-room frames never mix", async () => {
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: bytes(900) });
  const out = await reassembleStarknetMlsFrames(chunks, { network: "SN_MAIN", roomId: "room-1" });
  assert.equal(out.complete.length, 0);
});
test("forged duplicate fragment cannot override original", async () => {
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: bytes(820) });
  const altered = { ...parseStarknetMlsFrame(chunks[0]), data: "AA".repeat(256) };
  const out = await reassembleStarknetMlsFrames([...chunks, "vinss:mls:v1:" + JSON.stringify(altered)]);
  assert.equal(out.complete.length, 0);
  assert.ok(out.rejected.length);
});
test("unsupported oversize packet fails before wallet interaction", async () => {
  await assert.rejects(
    frameStarknetMlsPacket({ ...ctx, bytes: bytes(MLS_MAX_PAYLOAD_BYTES + 1) }),
    /exceeds supported/,
  );
});
test("unrelated legacy messages remain outside the MLS decoder", async () => {
  assert.equal(parseStarknetMlsFrame("hello"), null);
  const out = await reassembleStarknetMlsFrames(["hello"]);
  assert.equal(out.complete.length, 0);
});
test("malformed and incorrectly sized frames are rejected", async () => {
  const chunks = await frameStarknetMlsPacket({ ...ctx, bytes: bytes(600) });
  const malformed = "vinss:mls:v1:" + JSON.stringify({ ...parseStarknetMlsFrame(chunks[0]), data: "AA" });
  const out = await reassembleStarknetMlsFrames([malformed]);
  assert.equal(out.complete.length, 0);
  assert.ok(out.rejected.length);
});
