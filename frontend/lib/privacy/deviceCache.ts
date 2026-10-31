"use client";
import { canonicalStarknetAddress } from "./participantKeys";
import { deviceKey } from "./deviceKey";
import { decryptLocalJson, encryptLocalJson } from "./encryptedChatCache";
const queues = new Map<string, Promise<unknown>>();
interface Options<T> {
    storageKey: string;
    legacyStorageKey: string;
    walletAddress: string;
    context: string;
    legacyKey: Uint8Array;
    validate(value: unknown): T;
    mergeLegacy?(current: T, legacy: T): T;
}
async function access<T>(options: Options<T>, update?: (previous: T | null) => T): Promise<T | null> {
    const { storageKey, legacyStorageKey, context, validate } = options;
    const execute = async () => {
        const storage = window.localStorage;
        const key = await deviceKey(canonicalStarknetAddress(options.walletAddress));
        const raw = storage.getItem(storageKey);
        let value: T | null = null;
        if (raw) {
            const decoded = await decryptLocalJson<{
                version: number;
                context: string;
                value: unknown;
            }>(key, JSON.parse(raw));
            if (decoded.version !== 1 || decoded.context !== context)
                throw new Error("Protected cache context mismatch.");
            value = validate(decoded.value);
        }
        const legacyRaw = storage.getItem(legacyStorageKey);
        // Never overwrite recovery data if its old key or format cannot be verified.
        let legacy: T | null = null;
        let legacyVerified = false;
        if (legacyRaw) {
            try {
                legacy = validate(await decryptLocalJson(options.legacyKey, JSON.parse(legacyRaw)));
                legacyVerified = true;
            }
            catch (error) {
                if (value === null)
                    throw error;
            } // Preserve unreadable old data while retaining valid device recovery.
        }
        if (value === null)
            value = legacy;
        else if (legacy !== null) {
            if (options.mergeLegacy)
                value = validate(options.mergeLegacy(value, legacy));
            else if (JSON.stringify(value) !== JSON.stringify(legacy))
                throw new Error("Conflicting legacy recovery data.");
        }
        if (update)
            value = validate(update(value));
        if (value !== null && (update || legacyVerified)) {
            const payload = { version: 1, context, value };
            const serialized = JSON.stringify(await encryptLocalJson(key, payload));
            storage.setItem(storageKey, serialized);
            if (storage.getItem(storageKey) !== serialized)
                throw new Error("Protected cache write could not be verified.");
            const checked = await decryptLocalJson(key, JSON.parse(serialized));
            if (JSON.stringify(checked) !== JSON.stringify(payload))
                throw new Error("Protected cache verification failed.");
            if (legacyVerified && legacyRaw && storage.getItem(legacyStorageKey) === legacyRaw)
                storage.removeItem(legacyStorageKey);
        }
        return value;
    };
    const pending = (queues.get(storageKey) ?? Promise.resolve()).catch(() => undefined).then(async () => {
        if (typeof navigator !== "undefined" && navigator.locks)
            return await navigator.locks.request(storageKey, execute);
        return execute();
    });
    queues.set(storageKey, pending);
    try {
        return await pending;
    }
    finally {
        if (queues.get(storageKey) === pending)
            queues.delete(storageKey);
    }
}
export function readDeviceCache<T>(options: Options<T>): Promise<T | null> { return access(options); }
export async function writeDeviceCache<T>(options: Options<T>, update: (previous: T | null) => T): Promise<void> { await access(options, update); }
