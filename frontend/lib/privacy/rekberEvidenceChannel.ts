"use client";

import type {
  AttachmentRef,
  DealType,
  WorkReviewDecision,
} from "@/types/deal-room";
import {
  decryptPayload,
  encryptPayload,
} from "@/lib/privacy/envelope";

const DOMAIN =
  "VINSS_REKBER_EVIDENCE_V1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface RekberWorkEvidencePacket {
  version: 1;
  custodyCommitment: string;
  evidenceCommitment: string;
  dealType?: DealType;
  note: string;
  submittedAt: string;
  attachment?: AttachmentRef;
}

export interface RekberWorkReviewPacket {
  version: 1;
  custodyCommitment: string;
  evidenceCommitment: string;
  submissionLocator: string;
  decision: WorkReviewDecision;
  note?: string;
  reviewedAt: string;
}

function toArrayBuffer(
  bytes: Uint8Array,
): ArrayBuffer {
  const copy =
    new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64Url(
  bytes: Uint8Array,
): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function digest(
  directKey: Uint8Array,
  label: string,
): Promise<Uint8Array> {
  const labelBytes =
    encoder.encode(label);
  const input =
    new Uint8Array(
      directKey.length +
        labelBytes.length,
    );

  input.set(directKey, 0);
  input.set(
    labelBytes,
    directKey.length,
  );

  return new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      toArrayBuffer(input),
    ),
  );
}

function uuidFromBytes(
  source: Uint8Array,
): string {
  const bytes =
    new Uint8Array(
      source.slice(0, 16),
    );

  // Backend accepts UUID v4. Force version/variant while keeping this
  // encrypted evidence locator deterministic for both direct participants.
  bytes[6] =
    (bytes[6]! & 0x0f) | 0x40;
  bytes[8] =
    (bytes[8]! & 0x3f) | 0x80;

  const hex =
    Array.from(bytes)
      .map((byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");

  return (
    `${hex.slice(0, 8)}-` +
    `${hex.slice(8, 12)}-` +
    `${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-` +
    hex.slice(20)
  );
}

async function packetAddress(
  directKey: Uint8Array,
  kind: "work" | "review",
  custodyCommitment: string,
  evidenceCommitment: string,
): Promise<{
  id: string;
  token: string;
}> {
  const scope =
    `${DOMAIN}:${kind}:` +
    `${custodyCommitment}:` +
    evidenceCommitment;

  const [idBytes, tokenBytes] =
    await Promise.all([
      digest(
        directKey,
        `${scope}:id`,
      ),
      digest(
        directKey,
        `${scope}:token`,
      ),
    ]);

  return {
    id: uuidFromBytes(idBytes),
    token:
      bytesToBase64Url(
        tokenBytes,
      ),
  };
}

async function loadPacket<T>(
  backendUrl: string,
  directKey: Uint8Array,
  kind: "work" | "review",
  custodyCommitment: string,
  evidenceCommitment: string,
): Promise<T | null> {
  const { id, token } =
    await packetAddress(
      directKey,
      kind,
      custodyCommitment,
      evidenceCommitment,
    );

  const response =
    await fetch(
      `${backendUrl}/attachments/${id}`,
      {
        headers: {
          "X-VINSS-Attachment-Token":
            token,
        },
        cache: "no-store",
      },
    );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Encrypted Rekber evidence could not be loaded (${response.status}).`,
    );
  }

  const encoded =
    decoder.decode(
      await response.arrayBuffer(),
    );

  const rawChunks =
    JSON.parse(encoded) as string[];

  const payload =
    await decryptPayload(
      directKey,
      rawChunks.map(BigInt),
    );

  return payload as T;
}

async function savePacket(
  backendUrl: string,
  directKey: Uint8Array,
  kind: "work" | "review",
  custodyCommitment: string,
  evidenceCommitment: string,
  packet: unknown,
): Promise<void> {
  const { id, token } =
    await packetAddress(
      directKey,
      kind,
      custodyCommitment,
      evidenceCommitment,
    );

  const chunks =
    await encryptPayload(
      directKey,
      packet,
    );

  const body =
    encoder.encode(
      JSON.stringify(
        chunks.map(String),
      ),
    );

  const response =
    await fetch(
      `${backendUrl}/attachments/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/octet-stream",
          "X-VINSS-Attachment-Token":
            token,
        },
        body:
          toArrayBuffer(body),
      },
    );

  // The packet location is immutable. A retry after a wallet callback problem
  // may find the first encrypted upload already stored.
  if (
    response.ok ||
    response.status === 409
  ) {
    return;
  }

  throw new Error(
    `Encrypted Rekber evidence could not be stored (${response.status}).`,
  );
}

/*
 * Starknet remains authoritative. The frontend only loads this readable
 * packet after custody exposes the exact matching evidence commitment.
 */
export async function saveRekberWorkEvidence(
  backendUrl: string,
  directKey: Uint8Array,
  packet: RekberWorkEvidencePacket,
): Promise<void> {
  const existing =
    await loadRekberWorkEvidence(
      backendUrl,
      directKey,
      packet.custodyCommitment,
      packet.evidenceCommitment,
    );

  if (existing) return;

  await savePacket(
    backendUrl,
    directKey,
    "work",
    packet.custodyCommitment,
    packet.evidenceCommitment,
    packet,
  );
}

export async function loadRekberWorkEvidence(
  backendUrl: string,
  directKey: Uint8Array,
  custodyCommitment: string,
  evidenceCommitment: string,
): Promise<RekberWorkEvidencePacket | null> {
  const packet =
    await loadPacket<RekberWorkEvidencePacket>(
      backendUrl,
      directKey,
      "work",
      custodyCommitment,
      evidenceCommitment,
    );

  if (!packet) return null;

  if (
    packet.version !== 1 ||
    packet.custodyCommitment !==
      custodyCommitment ||
    packet.evidenceCommitment !==
      evidenceCommitment
  ) {
    throw new Error(
      "Encrypted work evidence does not match this Rekber.",
    );
  }

  return packet;
}

/*
 * Reject is only a review decision. It does not refund the Payer and does not
 * open a dispute until the Payee explicitly challenges the rejection.
 */
export async function saveRekberWorkReview(
  backendUrl: string,
  directKey: Uint8Array,
  packet: RekberWorkReviewPacket,
): Promise<void> {
  const existing =
    await loadRekberWorkReview(
      backendUrl,
      directKey,
      packet.custodyCommitment,
      packet.evidenceCommitment,
    );

  if (existing) {
    if (
      existing.decision ===
        packet.decision &&
      (existing.note ?? "") ===
        (packet.note ?? "")
    ) {
      return;
    }

    throw new Error(
      "A review decision already exists for this work submission.",
    );
  }

  await savePacket(
    backendUrl,
    directKey,
    "review",
    packet.custodyCommitment,
    packet.evidenceCommitment,
    packet,
  );
}

export async function loadRekberWorkReview(
  backendUrl: string,
  directKey: Uint8Array,
  custodyCommitment: string,
  evidenceCommitment: string,
): Promise<RekberWorkReviewPacket | null> {
  const packet =
    await loadPacket<RekberWorkReviewPacket>(
      backendUrl,
      directKey,
      "review",
      custodyCommitment,
      evidenceCommitment,
    );

  if (!packet) return null;

  if (
    packet.version !== 1 ||
    packet.custodyCommitment !==
      custodyCommitment ||
    packet.evidenceCommitment !==
      evidenceCommitment
  ) {
    throw new Error(
      "Encrypted work review does not match this Rekber.",
    );
  }

  return packet;
}
