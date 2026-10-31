"use client";
// This key is independent of shared room material and is never serialized to
// localStorage. IndexedDB stores a structured clone of a non-exportable key.
export async function deviceKey(walletAddress: string): Promise<CryptoKey> {
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
                if (!request.result)
                    store.add(candidate, walletAddress);
            };
            tx.oncomplete = () => {
                if (!key || key.extractable !== false || key.algorithm.name !== "AES-GCM") {
                    reject(new Error("Invalid device history key"));
                }
                else
                    resolve(key);
            };
            tx.onabort = () => reject(tx.error ?? new Error("Device history key storage failed"));
            tx.onerror = () => reject(tx.error);
        });
    }
    finally {
        db.close();
    }
}
