"use client";

import type { ConversationEntry } from "@/components/room/conversation/types";
import { canonicalStarknetAddress } from "./participantKeys";
import { decryptLocalJson, encryptLocalJson, type EncryptedLocalRecord } from "./encryptedChatCache";

interface HistoryOptions {
  roomId: string;
  walletAddress: string;
  peerAddress: string;
  roomKey: Uint8Array;
  directKey?: Uint8Array | null;
}
interface History { version: 1; savedAt: number; entries: ConversationEntry[]; context?: string }
const queues = new Map<string, Promise<unknown>>();

// This key is independent of shared room material and is never serialized to
// localStorage. IndexedDB stores a structured clone of a non-exportable key.
async function deviceKey(walletAddress: string): Promise<CryptoKey> {
  const candidate = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("vinss-device-history", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Device history key database is blocked"));
  });
  try {
    return await new Promise<CryptoKey>((resolve, reject) => {
      const tx = db.transaction("keys", "readwrite");
      const store = tx.objectStore("keys");
      const request = store.get(walletAddress);
      let key: CryptoKey;
      request.onsuccess = () => {
        key = request.result ?? candidate;
        if (!request.result) store.add(candidate, walletAddress);
      };
      tx.oncomplete = () => {
        if (!key || key.extractable !== false || key.algorithm.name !== "AES-GCM") {
          reject(new Error("Invalid device history key"));
        } else resolve(key);
      };
      tx.onabort = () => reject(tx.error ?? new Error("Device history key storage failed"));
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

function validateHistory(value: unknown): History {
  const history = value as History;
  if (!history || history.version !== 1 || !Array.isArray(history.entries) ||
      history.entries.some(entry => !entry || typeof entry.actionLocator !== "string" ||
        typeof entry.sentAt !== "string" || typeof entry.summary !== "string")) {
    throw new Error("Invalid local history record");
  }
  return history;
}

function mergeEntries(entries: ConversationEntry[]): ConversationEntry[] {
  const merged = new Map<string, ConversationEntry>();
  for (const entry of entries) {
    const locator = entry.actionLocator.replace(/^0x/, "").toLowerCase();
    const previous = merged.get(locator);
    merged.set(locator, { ...previous, ...entry, readAt: entry.readAt ?? previous?.readAt });
  }
  return [...merged.values()].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
}

async function accessHistory(options: HistoryOptions, additions?: ConversationEntry[]): Promise<ConversationEntry[]> {
  const wallet = canonicalStarknetAddress(options.walletAddress);
  const peer = canonicalStarknetAddress(options.peerAddress);
  if (!options.roomId || !wallet || !peer) throw new Error("Missing local history identity");
  const suffix = `${options.roomId}:${wallet}:${peer}`;
  const storageKey = `vinss:direct-history:v3:${suffix}`;
  const execute = async () => {
    const storage = window.localStorage;
    const key = await deviceKey(wallet);
    const raw = storage.getItem(storageKey);
    // A damaged/new-key cache must not be silently replaced with an empty one.
    const current = raw ? validateHistory(await decryptLocalJson(key, JSON.parse(raw))) : null;
    if (current && current.context !== suffix) throw new Error("Device history context mismatch");
    const migrated: { storageKey: string; raw: string; history: History }[] = [];
    for (const [version, legacyKey] of [["v1", options.directKey], ["v2", options.roomKey]] as const) {
      const legacyStorageKey = `vinss:direct-history:${version}:${suffix}`;
      const legacyRaw = storage.getItem(legacyStorageKey);
      if (!legacyRaw || !legacyKey) continue;
      try {
        const history = validateHistory(await decryptLocalJson(legacyKey, JSON.parse(legacyRaw)));
        migrated.push({ storageKey: legacyStorageKey, raw: legacyRaw, history });
      } catch {
        // Keep legacy recovery material unchanged when the key or format is wrong.
      }
    }
    const entries = mergeEntries([
      ...migrated.flatMap(record => record.history.entries),
      ...(current?.entries ?? []), ...(additions ?? []),
    ]);
    if (migrated.length || additions !== undefined) {
      const history: History = { version: 1, savedAt: Date.now(), entries, context: suffix };
      const encrypted = await encryptLocalJson(key, history);
      const serialized = JSON.stringify(encrypted);
      storage.setItem(storageKey, serialized);
      if (storage.getItem(storageKey) !== serialized) throw new Error("Device history write could not be verified");
      const checked = await decryptLocalJson<History>(key, JSON.parse(serialized) as EncryptedLocalRecord);
      if (JSON.stringify(checked) !== JSON.stringify(history)) throw new Error("Device history verification failed");
      for (const legacy of migrated) {
        if (storage.getItem(legacy.storageKey) === legacy.raw) storage.removeItem(legacy.storageKey);
      }
    }
    return entries;
  };
  const previous = queues.get(storageKey) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(async () => {
    // Serialize participating tabs too where Web Locks is available.
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request(storageKey, execute);
    }
    return execute();
  });
  queues.set(storageKey, pending);
  try { return await pending; }
  finally { if (queues.get(storageKey) === pending) queues.delete(storageKey); }
}

export function readDirectHistory(options: HistoryOptions): Promise<ConversationEntry[]> {
  return accessHistory(options);
}

export async function writeDirectHistory(options: HistoryOptions, entries: ConversationEntry[]): Promise<void> {
  await accessHistory(options, entries);
}
