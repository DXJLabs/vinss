export interface InvitePayload {
  v: 1;
  roomId: string;
  roomSecret: string;
  label: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function createInviteToken(payload: InvitePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeInviteToken(token: string): InvitePayload | null {
  try {
    const bytes = base64UrlToBytes(token);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as InvitePayload;

    if (
      payload?.v !== 1 ||
      typeof payload.roomId !== "string" ||
      typeof payload.roomSecret !== "string" ||
      typeof payload.label !== "string"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
