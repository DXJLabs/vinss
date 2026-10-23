# VINSS Starknet Messaging — Code Audit and Security Boundaries

> Audited 23 October 2026 from branch `feat/strk20-unshield-fees`, baseline `aaa47da`. **This is an implementation audit, not a new messaging protocol and not live-chain proof.** The separate OpenMLS branch has not been integrated here.

## 1. Architectural thesis

VINSS combines private *commercial coordination* with public verifiable settlement. Messages, offers and negotiation content require confidentiality; settlement and encrypted-action persistence require chain-backed evidence. These are distinct properties, not equivalent to full anonymity.

- **Client:** owns plaintext, encryption/decryption, per-room messaging identity, and secret routing contexts.
- **Wallet / STRK20:** authorizes native private action bundles via `WalletAccountV6.strk20InvokeTransaction`; it is not responsible for encrypting the app's JSON automatically.
- **Cairo MessageHelper:** validates structural V2 ciphertext envelopes, Poseidon commitment, replay/locator guards and FeePolicy minimum; stores ciphertext chunks and emits a public commitment event.
- **Backend indexer:** follows public events, reads on-chain ciphertext into PostgreSQL, and serves candidates by `POST /discover` without app decryption keys.
- **Receiving browser:** validates routing tags, decrypts ciphertext locally, filters direct-peer/group scope and reconciles pending state.

The currently implemented application cryptography is **WebCrypto AES-GCM + HMAC-SHA-256 + P-256 ECDH/HKDF**, not OpenMLS or a claim of MLS-style forward secrecy.

## 2. Source-of-truth map

| Concern | Audited code |
|---|---|
| Encrypt/decrypt and packing | `frontend/lib/privacy/envelope.ts` |
| Direct identity and pairwise keys | `frontend/lib/privacy/participantKeys.ts` |
| Room/group secret derivation | `frontend/lib/privacy/channelKey.ts` |
| V2 tags and Poseidon commitment | `frontend/lib/privacy/messageRouting.ts` |
| Wallet send and local discovery | `frontend/lib/deal-room/messaging.ts` |
| Direct send, encrypted history, pending reconciliation | `frontend/hooks/room/useDirectConversation.ts` |
| Group send/discovery | `frontend/hooks/room/useGroupConversation.ts` |
| Local encrypted JSON cache | `frontend/lib/privacy/encryptedChatCache.ts` |
| Encrypted attachment upload | `frontend/lib/privacy/directAttachments.ts` |
| Message Cairo storage/authorization | `contracts/src/messaging/vinss_message_helper.cairo` |
| Contract format/limits | `contracts/src/messaging/messaging_validation.cairo` and `contracts/src/utils/constants.cairo` |
| Event scan and ciphertext hydration | `backend/src/indexer/poolEvents.ts`, `definitions.ts`, `service.ts`, `store.ts` |
| Read-only discovery API | `backend/src/routes/discover.ts` |

## 3. Key hierarchy and participant trust

**Room:** `generateRoomSecret()` produces a browser-local random secret; `deriveChannelKeyFromRoomSecret` hashes a domain-separated input (`VINSS_ROOM_KEY_V1`). Room secrets are *currently stored plaintext in localStorage*; they should be treated as sensitive bearer-like access material.

**Direct:** for each room and wallet, `participantKeys.ts` generates/restores a P-256 ECDH identity in IndexedDB. It stores a **non-exportable private CryptoKey** and exports only the public key. Alice and Bob use P-256 ECDH and **HKDF-SHA-256**, salted with SHA-256 of the room ID and info `VINSS_DIRECT_MESSAGE_KEY_V1`, to derive a 32-byte pairwise message key. Group members with only a room secret cannot reconstruct the direct pairwise key. However, the peer public key's provenance matters: possession of a key is not independently proof of which wallet/person owns it. Do not claim authenticated identity enrollment without verifying its binding steps.

**Group:** `deriveGroupKeyFromSecret` uses a *different* domain (group vs room) and supplies `sendMessage` with a group key. Group ID and scope are inside ciphertext, not on the public helper record. Group key sharing/membership is **not** MLS epoch ratcheting or post-compromise recovery.

**Viewing key distinction:** `deriveChannelKeyViaEcdh` is a scaffolded STRK20 viewing-key proposal, explicitly **not** the active UI path. Wallet view keys, Cairo account signing keys, room secrets, and VINSS P-256 message identities are four different trust boundaries.

## 4. Exact Message V2 wire model

Client constructs `message_locator` from cryptographic randomness and an app channel key. HMAC-SHA-256 tags depend on the routing key, role, canonicalized identity and **this locator**, so tags are per action rather than stable public chat IDs.

| Calldata index | Value | Exposure |
|---|---|---|
| 0 | `envelope_version = 2` | public |
| 1 | `message_locator` | public one-time locator |
| 2 | `sender_tag` | public opaque HMAC tag |
| 3 | `recipient_tag` | public opaque HMAC tag |
| 4 | `claimed_payload_commitment` | public Poseidon hash |
| 5 | `payload_chunk_count` | public; Cairo requires 1–64 |
| 6 onward | `ciphertext_chunks` | **public ciphertext** in contract storage |
| last minus one | `quoted_fee` | public/transaction revenue amount |
| last | `open_note_id` | wallet-managed placeholder, not invented by VINSS |

Domain-separated commitment:
`Poseidon('VINSS_MSG_COMMIT_V2', 2, locator, sender_tag, recipient_tag, chunk_count, ...ciphertext_chunks)`.

`VinssMessageHelper.privacy_invoke` accepts calls **only from the configured Privacy Pool**. It checks exact length, version, nonzero locator/tags/commitment, valid chunk count, Poseidon equality and no duplicate locator/commitment before writing storage and emitting `MessageCommitted`. The contract **does not know the plaintext, real peer addresses, message kind or conversation ID**, and the Poseidon hash is not a signature proving real-world authorship. Its public event contains locator, commitment and tags, **not the whole ciphertext**. Ciphertext chunks are separately retrievable on-chain.

## 5. Payment logic: service fee vs STRK20 fee

`sendMessage` builds one wallet-authorized STRK20 bundle:
1. `withdraw` currently quoted revenue token amount to MessageHelper.
2. `transfer` the wallet's `OPEN` note output to VINSS treasury.
3. `invoke` the MessageHelper using a count-prefixed private calldata and wallet-managed OpenNote ID.
4. Optional additional privacy invokes, if explicitly requested by the calling workflow.

`quoteMessageFee()` resolves `MessageHelper.get_fee_policy()` then queries `FeePolicy.quote_fee(2)`. Cairo requires `quoted_fee >= minimum_fee`. The **new source** Message base floor is **$0.01**, not a guaranteed live deployment charge: oracle conversion, sponsor-cost floor and deployed policy version can produce a higher quote.

Distinguish **principal** moved in a transaction, **VINSS app revenue**, and **STRK20/wallet/network fees**. For plain Shield/Unshield routes VINSS adds **no** service-fee transfer. The protocol fee is not controlled by VINSS; a transaction receipt's `actual_fee` is not itself the total STRK20 cost.

## 6. Send, discover, decrypt and recover

`sendMessage` first resolves encryption/routing keys, encrypts JSON payload with AES-GCM (fresh 12-byte IV), computes ephemeral tags and commitment, fetches the live fee, and builds wallet actions. Only after preflight succeeds does it call `onPrepared(locator, commitment)`. The UI may persist an *encrypted pending body* and show an optimistic bubble. Wallet callback/hash is **submitted**, not chain-confirmed.

Backend scans `MessageCommitted` via `starknet_getEvents` with pagination and block checkpoints. For each locator it reads `get_message` and `get_payload_chunk`, indexing ciphertext in PostgreSQL. It exposes:

~~~http
POST /discover
Content-Type: application/json

{"kind":"message"}
~~~

The endpoint accepts only `kind`, optional `fromBlock` and `toBlock`; room secrets, viewing keys, channel keys and plaintext are refused. It supplies *candidate ciphertext*, not a server-authorized decrypted inbox.

Receiver checks expected recipient HMAC tag before decrypting, then verifies sender tag against sender identity in decrypted payload when present, then the direct hook filters selected sender/recipient, or the group hook filters encrypted `groupId`. Secret app keys do **not** need to travel to backend. AES-GCM rejects tampered content when the bytes/key are correct.

Direct state is approximately:
`Draft → Prepared/optimistic → Submitted or wallet-ambiguous → Indexed by exact locator → Locally decrypted and reconciled`.

A mobile wallet timeout **after** preparation is ambiguous; direct hook retains the pending record and rechecks the exact locator rather than blindly resubmitting. Direct history/pending records are encrypted in localStorage. Group pending storage uses **locator/timing metadata** rather than a plaintext draft and has different recovery semantics—do not claim direct/group recovery equivalence.

## 7. Storage boundaries and data minimization

| Data | Storage / visibility | Important caveat |
|---|---|---|
| Message body, direct peer metadata, group ID, attachment reference | AES-GCM encrypted JSON; ciphertext on-chain | Contract integrity != peer identity proof |
| Direct ECDH private key | IndexedDB non-exportable WebCrypto key | Compromised browser or lost device remains a risk |
| Direct local history/pending | Encrypted localStorage | Correct key required to recover |
| Room/group secret | **Plaintext localStorage** | Local capability exposure |
| Cached peer public key/address | Plaintext localStorage | Relationship metadata visible on device |
| Message event/locator/tag/commitment, tx/block timing | Public Starknet metadata | Correlation possible |
| Attachment file | Encrypted client-side then held as **off-chain ciphertext** by backend | File bytes are not on-chain; 20 MiB input limit |
| Agent/Feedback/Dispute evidence | Separate explicit API flows | Blanket "backend never gets plaintext" claim is false outside normal discovery |

Routing hides reusable *application* identifiers from ordinary helper storage, but not every traffic relationship, transaction amount, fee, time, or counterparty signal.

## 8. Audit findings and remediation status (updated 23 October 2026)

### P1: historic lossy felt packing — fixed in source, chain regression pending

Before `fab9b65`, `envelope.ts` encoded 30-byte slices as bare bigints, discarding leading zero bytes. For example `[0x00,0x01,0x02] → 0x0102 → [0x01,0x02]`.

**Current source:** `frontend/lib/privacy/feltCodec.ts` uses a versioned **inner codec marker**, explicit byte length and a sentinel per packed 30-byte chunk, preserving zero-leading and all-zero chunks. Legacy encrypted records have no version/length; the decoder restores every full 30-byte chunk and considers at most 30 final-block lengths. `decryptPayload()` selects a legacy candidate **only if AES-GCM authentication succeeds**. The Cairo **outer Message V2 header, commitment, fee quote and contract ABI remain unchanged**.

[Unit tests](https://github.com/DXJLabs/vinss/blob/feat/strk20-unshield-fees/tests/messaging-codec-transport.test.mjs) exercise leading-zero, all-zero, chunk-boundary and legacy-authentication vectors. **Still needed:** real previously indexed on-chain ciphertext samples, two-wallet Alice/Bob browser E2E, and old/new Offer/Private Escrow cross-compatibility validation.

### P1: wallet error diagnostics — sanitized for Message submission

Previously `messaging.ts` logged raw wallet error metadata, `debugActions` and JSON-serialized exceptions. The Message exception path now emits only a static failure class (`WALLET_DECLINED` or `WALLET_OUTCOME_UNKNOWN`) with generic user-facing text. It **does not print or rethrow raw wallet exceptions/ciphertext**. The existing direct-chat pending recovery still reconciles a prepared action by locator rather than treating an ambiguous callback as a failed transaction.

**Still needed:** audit other domain modules, wallet extensions and telemetry. `discoverMessages()` does not contain the older alleged decrypted-body console log.

### Multichain gateway — Starknet first, fail-closed

[Multichain Messaging Transport](./multichain-messaging.md) introduces chain-qualified message delivery, but **only native Starknet STRK20 is registered today**. Canton/EVM connectors, identity bindings and cross-chain receipt correlation remain future integrations.

### P2: remaining privacy and operational work

- Authenticate peer public-key enrollment and restore/migration provenance.
- Guard local plaintext room/group capabilities against XSS, extensions, device sharing and unsafe backup.
- Load-test event scan, per-chunk RPC reads, initial indexer catch-up and candidate discovery scaling.
- Validate cross-device recovery and rekey/membership changes; not an MLS implementation.
- Avoid claims of zero metadata, anonymity, all-plaintext-free backend, or universal wallet compatibility.

## 9. Verification matrix and promotion criteria

| Test | Required evidence |
|---|---|
| Crypto | Round-trip full arbitrary byte sequences, including leading zero and all-zero chunks; AES-GCM decrypt succeeds |
| Cairo compatibility | V2 domain, Poseidon vector, six-field header, 64-chunk limit, duplicate rejection |
| Direct Alice/Bob | Verified wallet identity/key exchange, send, accepted tx, indexed ciphertext, other peer decrypt |
| Recovery | Hard refresh, wallet timeout/rejection ambiguity, exact locator lookup, dedupe |
| Group | Group-key isolation, no plaintext groupId in helper event, member change handling |
| Security | Wrong key, forged tag, malformed calldata, bad fee, browser diagnostics leaks |
| Fees | Helper-linked *active* FeePolicy quote, wallet STRK20 quote and gas all recorded distinctly |
| Deployment | Explicit chain, wallet version, contract addresses, tx hashes, receipts and observed outcomes |

**Evidence at audit:** CI [39812347541](https://github.com/DXJLabs/vinss/actions/runs/39812347541) passed frontend build and Cairo regressions on this branch; this **does not constitute messaging browser E2E, proof that the codec is sound, or Sepolia Shield/Unshield transaction verification**.

## 10. Related documents

[Direct two-party chat](./direct-chat.md) · [Privacy model](./privacy-model.md) · [Wallet and STRK20](./wallet-strk20.md) · [Shield/Unshield](./shield-unshield.md) · [MessageHelper Cairo](../smart-contracts/message-helper.md) · [Discovery/indexer](../backend/discovery-indexer.md).

**Future OpenMLS work belongs in `feat/openmls-starknet`:** design authenticated group membership/epochs, key-package provisioning, device restore and backward-compatible V2 migration explicitly. STRK20 remains the native transaction mechanism; MLS should not be described as already active.
