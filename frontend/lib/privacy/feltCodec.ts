/**
 * Lossless byte encoding for Starknet ciphertext felts.
 *
 * Outer Cairo Message V2 layout/commitment remain unchanged.
 * Inner V2 layout: [magic, byteLength, ...(0x01 sentinel || up to 30 bytes)].
 * Legacy felts have no version/length: recover possible final lengths and
 * select only after AES-GCM authenticated decryption.
 */
export const ENCRYPTED_FELT_CODEC_MAGIC = 0x56494e53535f454e435f5632n;
const BLOCK = 30;
const MAX_CHUNKS = 64;
const PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const OLD_MAX = (1n << 240n) - 1n;
export function packEncryptedBytes(bytes: Uint8Array, maxChunks = MAX_CHUNKS): bigint[] {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error("Encrypted payload must contain bytes.");
  if (!Number.isInteger(maxChunks) || maxChunks < 3 || maxChunks > MAX_CHUNKS) {
    throw new Error("Invalid maximum encrypted chunk count.");
  }
  const encoded: bigint[] = [ENCRYPTED_FELT_CODEC_MAGIC, BigInt(bytes.length)];
  for (let i = 0; i < bytes.length; i += BLOCK) {
    let v = 1n;
    for (const b of bytes.subarray(i, i + BLOCK)) v = (v << 8n) | BigInt(b);
    encoded.push(v);
    if (encoded.length > maxChunks) throw new Error("Encrypted payload exceeds 64 ciphertext chunks.");
  }
  return encoded;
}
function decodeNew(felts: readonly bigint[]): Uint8Array {
  if (felts.length < 3) throw new Error("Invalid v2 ciphertext chunk count.");
  const n = felts[1]!;
  if (n < 1n || n > BigInt((felts.length - 2) * BLOCK) ||
      n <= BigInt((felts.length - 3) * BLOCK)) {
    throw new Error("Invalid v2 ciphertext byte length.");
  }
  const result = new Uint8Array(Number(n));
  for (let i = 2; i < felts.length; i++) {
    const offset = (i - 2) * BLOCK;
    const len = Math.min(BLOCK, result.length - offset);
    let v = felts[i]!;
    for (let j = len - 1; j >= 0; j--) {
      result[offset + j] = Number(v & 255n);
      v >>= 8n;
    }
    if (v !== 1n) throw new Error("Invalid v2 encrypted chunk sentinel.");
  }
  return result;
}
function minimalBytes(value: bigint): number[] {
  const result: number[] = [];
  while (value) { result.unshift(Number(value & 255n)); value >>= 8n; }
  return result;
}
/** V2 yields one exact candidate; legacy yields <=30 candidates for auth checking. */
export function recoverEncryptedByteCandidates(felts: readonly bigint[]): Uint8Array[] {
  if (!Array.isArray(felts) || felts.length === 0 || felts.length > MAX_CHUNKS ||
      felts.some(v => typeof v !== "bigint" || v < 0n || v >= PRIME)) {
    throw new Error("Invalid or empty encrypted felt payload.");
  }
  if (felts[0] === ENCRYPTED_FELT_CODEC_MAGIC) return [decodeNew(felts)];
  if (felts.some(v => v > OLD_MAX) || (felts.length === 1 && felts[0] === 0n)) {
    throw new Error("Invalid empty or oversized legacy ciphertext.");
  }
  const head = new Uint8Array((felts.length - 1) * BLOCK);
  for (let i = 0; i < felts.length - 1; i++) {
    let v = felts[i]!;
    for (let j = BLOCK - 1; j >= 0; j--) {
      head[i * BLOCK + j] = Number(v & 255n);
      v >>= 8n;
    }
  }
  const tail = minimalBytes(felts[felts.length - 1]!);
  const candidates: Uint8Array[] = [];
  for (let len = Math.max(1, tail.length); len <= BLOCK; len++) {
    const value = new Uint8Array(head.length + len);
    value.set(head);
    value.set(tail, head.length + len - tail.length);
    candidates.push(value);
  }
  return candidates;
}
