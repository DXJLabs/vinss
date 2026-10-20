/**
 * Encrypted MLS wire fragments for the existing Starknet VINSS MessageHelper.
 *
 * The *entire* frame, including identifiers, metadata and binary data, is
 * encrypted inside the existing MessagePayload AES-GCM envelope. Only that
 * ciphertext and its opaque routing tags are posted on chain.
 *
 * MLS ciphertext is always kept byte-for-byte; base64url is only an interior
 * JSON encoding and is never published as plaintext calldata.
 */
export const MLS_WIRE_PREFIX = "vinss:mls:v1:";
export const MLS_FRAME_BYTES = 384;
export const MLS_MAX_PAYLOAD_BYTES = 16 * 1024;
export const MLS_MAX_FRAMES = Math.ceil(MLS_MAX_PAYLOAD_BYTES / MLS_FRAME_BYTES);

export type StarknetMlsPacketKind =
  | "key_package"
  | "welcome"
  | "commit"
  | "application";

export interface StarknetMlsFrame {
  version: 1;
  kind: StarknetMlsPacketKind;
  network: string;
  roomId: string;
  sender: string;
  packetId: string;
  digest: string;
  byteLength: number;
  index: number;
  total: number;
  data: string;
}

export interface StarknetMlsPacket {
  kind: StarknetMlsPacketKind;
  network: string;
  roomId: string;
  sender: string;
  packetId: string;
  bytes: Uint8Array;
}

export interface StarknetMlsFrameSummary {
  complete: StarknetMlsPacket[];
  incomplete: { packetId: string; received: number; expected: number }[];
  rejected: { packetId: string; reason: string }[];
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("Invalid MLS frame data alphabet");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
  if (toBase64Url(bytes) !== value) throw new Error("Non-canonical MLS frame data");
  return bytes;
}

async function digest(bytes: Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes);
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", owned.buffer)));
}

function isHex(value: unknown, count: number): value is string {
  return typeof value === "string" && new RegExp("^[0-9a-f]{" + count + "}$").test(value);
}

function isKind(value: unknown): value is StarknetMlsPacketKind {
  return value === "key_package" || value === "welcome" ||
    value === "commit" || value === "application";
}

function safeScope(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 &&
    value.length <= 128 && /^[A-Za-z0-9_:/.-]+$/.test(value);
}

function parse(value: unknown): StarknetMlsFrame {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Malformed MLS frame");
  }
  const obj = value as Record<string, unknown>;
  if (obj.version !== 1 || !isKind(obj.kind) ||
      !safeScope(obj.network) || !safeScope(obj.roomId) ||
      typeof obj.sender !== "string" || !/^0x[0-9a-f]{1,64}$/.test(obj.sender) ||
      !isHex(obj.packetId, 32) || !isHex(obj.digest, 64) ||
      !Number.isSafeInteger(obj.byteLength) ||
      (obj.byteLength as number) < 1 || (obj.byteLength as number) > MLS_MAX_PAYLOAD_BYTES ||
      !Number.isSafeInteger(obj.index) || !Number.isSafeInteger(obj.total) ||
      (obj.total as number) < 1 || (obj.total as number) > MLS_MAX_FRAMES ||
      (obj.total as number) !== Math.ceil((obj.byteLength as number) / MLS_FRAME_BYTES) ||
      (obj.index as number) < 0 || (obj.index as number) >= (obj.total as number) ||
      typeof obj.data !== "string" || obj.data.length > 512) {
    throw new Error("Invalid MLS frame structure or limits");
  }
  const chunk = fromBase64Url(obj.data as string);
  const expectedLength = Math.min(
    MLS_FRAME_BYTES,
    (obj.byteLength as number) - (obj.index as number) * MLS_FRAME_BYTES,
  );
  if (chunk.length !== expectedLength) {
    throw new Error("MLS frame length does not match declared packet");
  }
  return obj as unknown as StarknetMlsFrame;
}

export function parseStarknetMlsFrame(body: string): StarknetMlsFrame | null {
  if (!body.startsWith(MLS_WIRE_PREFIX)) return null;
  if (body.length > 1700) throw new Error("MLS frame exceeds on-chain envelope budget");
  return parse(JSON.parse(body.slice(MLS_WIRE_PREFIX.length)) as unknown);
}

/** The sender must approve the fragment count and associated wallet actions. */
export async function frameStarknetMlsPacket(
  input: Omit<StarknetMlsPacket, "packetId"> & { packetId?: string },
): Promise<string[]> {
  const bytes = new Uint8Array(input.bytes);
  if (bytes.length < 1 || bytes.length > MLS_MAX_PAYLOAD_BYTES) {
    throw new Error("MLS packet exceeds supported on-chain payload size");
  }
  if (!isKind(input.kind) || !safeScope(input.network) || !safeScope(input.roomId) ||
      !/^0x[0-9a-f]{1,64}$/.test(input.sender)) {
    throw new Error("Invalid MLS packet scope or sender");
  }
  const packetId = input.packetId ?? hex(crypto.getRandomValues(new Uint8Array(16)));
  if (!isHex(packetId, 32)) throw new Error("Invalid MLS packet ID");
  const sha256 = await digest(bytes);
  const total = Math.ceil(bytes.length / MLS_FRAME_BYTES);
  const frames: string[] = [];
  for (let index = 0; index < total; index++) {
    const offset = index * MLS_FRAME_BYTES;
    const data = toBase64Url(bytes.subarray(offset, offset + MLS_FRAME_BYTES));
    frames.push(MLS_WIRE_PREFIX + JSON.stringify({
      version: 1, kind: input.kind, network: input.network,
      roomId: input.roomId, sender: input.sender, packetId,
      digest: sha256, byteLength: bytes.length, index, total, data,
    } satisfies StarknetMlsFrame));
  }
  return frames;
}

/**
 * Reassemble ciphertext only if every part is present, consistent, and hashes
 * to the announced SHA-256. Tolerates shuffled delivery and exact duplicates.
 * Malformed or conflicting packets are rejected without affecting other IDs.
 */
export async function reassembleStarknetMlsFrames(
  bodies: readonly string[],
  scope?: { network: string; roomId: string },
): Promise<StarknetMlsFrameSummary> {
  const grouped = new Map<string, StarknetMlsFrame[]>();
  const rejected: StarknetMlsFrameSummary["rejected"] = [];
  const invalid = new Set<string>();
  for (const body of bodies.slice(0, 2000)) {
    if (!body.startsWith(MLS_WIRE_PREFIX)) continue;
    let frame: StarknetMlsFrame;
    try {
      frame = parseStarknetMlsFrame(body)!;
    } catch {
      rejected.push({ packetId: "unknown", reason: "Malformed MLS frame" });
      continue;
    }
    if (scope && (frame.network !== scope.network || frame.roomId !== scope.roomId)) continue;
    if (!grouped.has(frame.packetId) && grouped.size >= 128) {
      rejected.push({ packetId: frame.packetId, reason: "Too many pending packets" });
      continue;
    }
    const frames = grouped.get(frame.packetId) ?? [];
    frames.push(frame);
    grouped.set(frame.packetId, frames);
  }

  const complete: StarknetMlsPacket[] = [];
  const incomplete: StarknetMlsFrameSummary["incomplete"] = [];
  for (const [packetId, frames] of grouped) {
    const first = frames[0]!;
    const chunks = new Map<number, string>();
    for (const frame of frames) {
      const fields = ["kind", "network", "roomId", "sender", "digest", "byteLength", "total"] as const;
      if (fields.some((field) => frame[field] !== first[field])) {
        invalid.add(packetId);
        break;
      }
      const previous = chunks.get(frame.index);
      if (previous !== undefined && previous !== frame.data) {
        invalid.add(packetId);
        break;
      }
      chunks.set(frame.index, frame.data);
    }
    if (invalid.has(packetId)) {
      rejected.push({ packetId, reason: "Conflicting MLS fragment metadata" });
      continue;
    }
    if (chunks.size !== first.total) {
      incomplete.push({ packetId, received: chunks.size, expected: first.total });
      continue;
    }
    const bytes = new Uint8Array(first.byteLength);
    let offset = 0;
    for (let i = 0; i < first.total; i++) {
      const value = chunks.get(i);
      if (value === undefined) throw new Error("Internal MLS fragment assembly error");
      const part = fromBase64Url(value);
      bytes.set(part, offset);
      offset += part.length;
    }
    if (offset !== first.byteLength || await digest(bytes) !== first.digest) {
      rejected.push({ packetId, reason: "MLS packet digest mismatch" });
      continue;
    }
    complete.push({
      kind: first.kind, network: first.network, roomId: first.roomId,
      sender: first.sender, packetId, bytes,
    });
  }
  return { complete, incomplete, rejected };
}
