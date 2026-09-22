// Old ciphertext chunks were at most 240 bits. This marker cannot be confused
// with a legacy first chunk, and fits within a felt252 without changing the ABI.
export const PACKING_V2 = 1n << 248n;
const WIDTH = 30;
const LIMIT = 1n << 240n;

export function packCiphertext(bytes: Uint8Array, maxChunks = 64): bigint[] {
  const chunks = [PACKING_V2, BigInt(bytes.length)];
  for (let offset = 0; offset < bytes.length; offset += WIDTH) {
    let value = 0n;
    for (const byte of bytes.slice(offset, offset + WIDTH)) value = (value << 8n) | BigInt(byte);
    chunks.push(value);
  }
  if (chunks.length > maxChunks) {
    throw new Error(`Encrypted payload exceeds ${maxChunks} chunks. Shorten the message or attachment.`);
  }
  return chunks;
}

export function unpackCiphertext(chunks: bigint[], maxChunks = 64): Uint8Array {
  if (!chunks.length || chunks.length > maxChunks) throw new Error("Invalid ciphertext length.");
  if (chunks[0] !== PACKING_V2) {
    // Historical writes did not encode chunk lengths. Preserve the original
    // decoder for intact records; lost leading zero bytes cannot be recovered.
    const bytes: number[] = [];
    for (let value of chunks) {
      if (value < 0n || value >= LIMIT) throw new Error("Invalid legacy ciphertext chunk.");
      const part: number[] = [];
      while (value > 0n) { part.unshift(Number(value & 255n)); value >>= 8n; }
      bytes.push(...part);
    }
    return new Uint8Array(bytes);
  }
  const length = chunks[1];
  if (length === undefined || length < 0n || length > BigInt((maxChunks - 2) * WIDTH)) {
    throw new Error("Invalid ciphertext byte length.");
  }
  const size = Number(length);
  if (chunks.length !== 2 + Math.ceil(size / WIDTH)) throw new Error("Truncated ciphertext.");
  const bytes = new Uint8Array(size);
  for (let index = 2; index < chunks.length; index++) {
    let value = chunks[index]!;
    const start = (index - 2) * WIDTH;
    const width = Math.min(WIDTH, size - start);
    if (value < 0n || value >= (1n << BigInt(width * 8))) throw new Error("Invalid ciphertext chunk.");
    for (let offset = width - 1; offset >= 0; offset--) {
      bytes[start + offset] = Number(value & 255n);
      value >>= 8n;
    }
  }
  return bytes;
}
