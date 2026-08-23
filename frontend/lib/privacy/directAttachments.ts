"use client";

import type { AttachmentRef } from "@/types/deal-room";

const encoder = new TextEncoder();
export const MAX_DIRECT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return (
    "0x" +
    Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  );
}

async function deriveAttachmentKey(
  directKey: Uint8Array,
  attachmentId: string,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(directKey),
    "HKDF",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(encoder.encode(attachmentId)),
      info: toArrayBuffer(encoder.encode("VINSS_DIRECT_ATTACHMENT_V1")),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function uploadDirectAttachment(
  backendUrl: string,
  directKey: Uint8Array,
  file: File,
): Promise<AttachmentRef> {
  if (file.size <= 0) throw new Error("The selected file is empty.");
  if (file.size > MAX_DIRECT_ATTACHMENT_BYTES) {
    throw new Error("File is too large. VINSS currently supports files up to 20 MB.");
  }

  const id = crypto.randomUUID();
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = await file.arrayBuffer();
  const sha256 = await sha256Hex(plaintext);
  const key = await deriveAttachmentKey(directKey, id);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(encoder.encode(id)),
    },
    key,
    plaintext,
  );

  const response = await fetch(`${backendUrl}/attachments/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-VINSS-Attachment-Token": token,
    },
    body: encrypted,
  });

  if (!response.ok) {
    throw new Error(`Encrypted file upload failed (${response.status}).`);
  }

  return {
    version: 1,
    id,
    accessToken: token,
    iv: bytesToBase64Url(iv),
    fileName: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    sha256,
  };
}

export async function downloadDirectAttachment(
  backendUrl: string,
  directKey: Uint8Array,
  attachment: AttachmentRef,
): Promise<Blob> {
  const response = await fetch(`${backendUrl}/attachments/${attachment.id}`, {
    headers: {
      "X-VINSS-Attachment-Token": attachment.accessToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Encrypted file download failed (${response.status}).`);
  }

  const encrypted = await response.arrayBuffer();
  const key = await deriveAttachmentKey(directKey, attachment.id);
  const iv = base64UrlToBytes(attachment.iv);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(encoder.encode(attachment.id)),
    },
    key,
    encrypted,
  );

  const actualHash = await sha256Hex(plaintext);
  if (actualHash.toLowerCase() !== attachment.sha256.toLowerCase()) {
    throw new Error("Attachment integrity check failed.");
  }

  return new Blob([plaintext], {
    type: attachment.mimeType || "application/octet-stream",
  });
}
