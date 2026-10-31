# Device-encrypted direct history (v3)

Direct conversation history is encrypted with a random 256-bit AES-GCM key belonging to this browser origin and canonical wallet address. The key is generated non-exportable and stored as a CryptoKey in IndexedDB database `vinss-device-history`, store `keys`. It is not derived from the room secret, peer public key, wallet signature, or pairwise message key, and no raw key is written to localStorage.

Ciphertext lives in `vinss:direct-history:v3:<roomId>:<canonical-self>:<canonical-peer>`. The encrypted record binds the room/account/peer context; moving one record to another conversation fails validation. Public storage-key metadata (room/account/peer) remains visible on the device.

## Migration and failure behavior

`deviceHistory.ts` is used by the direct conversation hook for hydration and all history writes. It authenticates existing v3 ciphertext, then attempts legacy v1 with the available pairwise key and v2 with the room key. It merges by locator, retains read receipts, encrypts the result under the device key, verifies the persisted value and decrypted content, and only then removes successfully migrated unchanged legacy copies.

Legacy records that cannot be decrypted are kept for a later retry with the correct key. An unreadable v3 record blocks overwriting that record. Quota/IndexedDB failures are reported in the chat UI; there is no fallback to plaintext or room-key encryption. The app does not remove current history to make space. The queue covers concurrent hooks; Web Locks also serializes cooperating tabs where supported. Close/reload older VINSS tabs after deployment, since older code can still recreate v2 records.

Migration runs as each conversation is opened or written. It is not a bulk wipe of every room in localStorage. A room/peer not opened yet can still contain its old v2 copy until migration runs. V1 ciphertext whose historical pairwise key is no longer available remains preserved, but may be unrecoverable.

## Scope and recovery limits

This closes the audited weakness where a copy of localStorage included both the direct-history ciphertext and enough room-secret material to decrypt it. A copy of localStorage alone no longer contains the key for migrated v3 history. It does not protect an active browser from same-origin malicious scripts, malicious extensions, or a full browser-profile compromise including usable IndexedDB keys.

Room/group secrets retain their existing storage and invitation behavior. Pending direct messages retain pairwise encryption; message/attachment/network encryption, contracts, and fee amounts are unchanged. This is not a claim to have protected every local secret or added OpenMLS.

The new key is device/origin-local. Copying only localStorage to another browser cannot restore v3 history. Deleting IndexedDB/site data can remove the local history key; the client does not silently replace an unreadable v3 cache. Re-discovery of on-chain direct messages still independently requires the original pairwise messaging identity. No new backup or cross-device restore feature is provided.

## Verification

`frontend/tests/device-history.test.ts` uses real WebCrypto and fake-indexeddb's IndexedDB implementation. It covers non-exportability, room/direct-key rejection for v3, v1/v2 migration, canonical address reconnect, concurrent initial key creation and updates, read receipts, account/context isolation, bad legacy keys, quota failure, and corrupt target preservation. Browser-specific IndexedDB CryptoKey persistence still needs a live browser smoke test; the test runner does not simulate Ready wallet behavior.

Validation run: 42 frontend runtime test results and 61 root regression tests passed, along with privacy boundary checks, frontend TypeScript checks, and a production Next.js build. No live Ready/browser transaction or frontend deployment was performed.


The non-exportable key provider now lives in `frontend/lib/privacy/deviceKey.ts` and is reused by protected Offer history and Rekber recovery. The direct-history API, v3 format and migration behavior remain unchanged. See `docs/technical/audits/offer-escrow-remediation-2026-10-31.md`.
