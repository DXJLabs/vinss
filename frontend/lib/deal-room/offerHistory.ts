"use client";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { canonicalStarknetAddress } from "@/lib/privacy/participantKeys";
import { readDeviceCache, writeDeviceCache } from "@/lib/privacy/deviceCache";
interface History {
    version: 1;
    savedAt: number;
    entries: ConversationEntry[];
}
function merge(left: History, right: History): History {
    const entries = new Map<string, ConversationEntry>();
    for (const entry of [...left.entries, ...right.entries]) {
        const locator = entry.actionLocator.replace(/^0x/, "").toLowerCase();
        const previous = entries.get(locator);
        entries.set(locator, { ...previous, ...entry, readAt: entry.readAt ?? previous?.readAt });
    }
    return { version: 1, savedAt: Date.now(), entries: [...entries.values()].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt)) };
}
function options(roomId: string, walletAddress: string, legacyKey: Uint8Array) {
    const context = `${roomId}:${canonicalStarknetAddress(walletAddress)}`;
    return { storageKey: `vinss:offer-history:v2:${context}`, legacyStorageKey: `vinss:offer-history:v1:${context}`, walletAddress, context, legacyKey,
        validate(value: unknown): History {
            const data = value as History;
            if (!data || data.version !== 1 || !Array.isArray(data.entries) || data.entries.some(e => !e || typeof e.actionLocator !== "string" || typeof e.sentAt !== "string" || typeof e.summary !== "string"))
                throw new Error("Invalid Offer history.");
            return data;
        }, mergeLegacy: (current: History, legacy: History) => merge(legacy, current),
    };
}
export async function readOfferHistory(roomId: string, wallet: string, key: Uint8Array): Promise<ConversationEntry[]> {
    return (await readDeviceCache(options(roomId, wallet, key)))?.entries ?? [];
}
export async function writeOfferHistory(roomId: string, wallet: string, key: Uint8Array, entries: ConversationEntry[]): Promise<void> {
    await writeDeviceCache(options(roomId, wallet, key), previous => merge({ version: 1, savedAt: Date.now(), entries: previous?.entries.filter(entry => Boolean(entry.transactionHash)) ?? [] }, { version: 1, savedAt: Date.now(), entries }));
}
