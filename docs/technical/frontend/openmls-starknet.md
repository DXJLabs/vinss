# OpenMLS direct chat on Starknet

> Implemented on `main`, 31 October 2026. This ports the existing OpenMLS engine from `feat/vinss-openmls-production` and connects it to the current fee, proof, device-history and Shield/Unshield code. Source tests and production builds are not live Ready X or Mainnet verification.

## Scope and migration

New two-party **text** requires an OpenMLS session. Both wallets publish signed KeyPackages; the numerically lower Starknet address publishes the signed Welcome. The other wallet syncs it. Existing Message V2 text remains readable, without rewriting chain records. New text cannot silently fall back to the legacy cipher when setup, storage or verification fails.

Attachments, presence, group chat, Offer authorization, Escrow Rekber coordination and settlement retain their existing separate protocols. They are not converted to MLS by this change. The generic engine supports membership commits, but the shipped direct UI creates a two-installation session; it does not offer device replacement, member rotation, automatic key updates or group MLS. Shield/Unshield choose Starknet transaction execution, not the MLS cipher. Canton/EVM integration is not added.

## Code map and processing order

| Layer | Code location | Responsibility |
|---|---|---|
| Cryptography | `wasm/vinss_mls/src/`; `frontend/lib/openmls/` | OpenMLS 0.9 Rust source and browser WASM module |
| Engine boundary | `frontend/lib/openmls-core/openmls/browser-bridge.ts` | KeyPackages, Welcome, membership commits, application encrypt/decrypt, durable provider state |
| Checkpoint | `openmls/checkpoint.ts`, `openmls/indexeddb-checkpoint-store.ts` under the same core | Encrypted provider state plus inbox and unfinished outbound packet; installation-scoped non-exportable AES-GCM key |
| Wallet identity | `starknet-keypackage-attestation.ts` | SNIP-12 signatures binding chain, room, wallet, device, bytes and validity; separate sender/recipient/device-bound Welcome signature |
| Session state | `starknet-session.ts`, `starknet-mls-chat.ts` | Stable direct conversation ID, deterministic inviter, signed onboarding, inbox, exact packet resumption |
| Wire framing | `starknet-framing.ts` | Interior 384-byte fragments, digest, strict scope and complete reassembly; at most 16 KiB per packet |
| Chain transport | `starknet-onchain-transport.ts` | Existing Message gateway, both configured Starknet rails, exact prepared locator, confirmed receipts and incomplete publication reconciliation |
| Existing proof | `frontend/lib/deal-room/envelopeProof.ts`, `messaging.ts` | Message helper getter, six-field commitment, accepted successful receipt, emitter/event/locator/commitment agreement |
| Active UI | `frontend/hooks/room/useStarknetDirectMls.ts`, `useDirectConversation.ts` | Publish/start/sync/resume, new-text gate, legacy reads, merge MLS inbox into independent device history |
| Presentation | `frontend/components/room/conversation/OpenMlsSessionControls.tsx`, `MessageBubble.tsx` | Collapsible session controls; real final transaction proof and verified fragment count |

For send, text is serialized inside an MLS application message. Its ciphertext is fragmented and each frame goes inside a normal encrypted Message V2 `system_note`. Existing P-256 ECDH/HKDF, opaque routing tags, AES-GCM and felt packing remain the **outer transport envelope**, rather than the new text ratchet. No plaintext chat text or public reusable MLS conversation ID is posted by this path.

For receive, backend discovery supplies candidates only. Each fragment must match the selected helper's immutable record, recomputed commitment and accepted transaction event before complete digest-checked reassembly. Wallet signatures authenticate onboarding. The MLS engine authenticates/decrypts application data, then validates the interior from/to/body/time shape before rendering. The backend has no normal decryption key.

Existing Mermaid diagrams in [Direct Chat](./direct-chat.md) and the [Message V2 audit](./messaging-implementation-audit.md) remain useful for the outer transport and legacy history. Read them with this additional MLS layer for new text.

## Durability and interruption

- Ratchet state and the decrypted inbox are saved in the same encrypted checkpoint. Reload does not attempt to decrypt a consumed MLS message secret again.
- Outgoing ciphertext, original text, selected rail, fragments, prepared locators and receipts are durable. Resume publishes the same packet; a different draft cannot replace an unfinished message.
- A prepared frame with unknown wallet outcome is reconciled against its exact on-chain locator. It is not automatically sent again. Indexer/RPC availability can therefore leave an unresolved operation pending.
- A crash after Welcome commit merge resumes the existing verified publication and clears its plan without a second membership merge or publication.
- Checkpoint writes use an atomic revision comparison; stale tabs fail closed instead of overwriting newer ratchet state. Reload the stale tab.
- A rejected MLS cryptographic operation rolls back provider storage before processing another packet. A failed checkpoint write faults the bridge until reload.
- A marked existing installation whose checkpoint is missing is blocked. Clearing localStorage as well can create a new installation, but does not restore the previous peer's established group. Keep browser storage; device backup/recovery UI is not implemented.

Device history v3 remains independently encrypted by the existing device-key provider. The MLS inbox is also retained for reload recovery. “Hide in this browser” hides a history bubble; it does not promise to erase chain ciphertext or the durable MLS recovery inbox. This is not a remote-delete protocol.

## Fees and limits

A logical packet can require **multiple separate Message transactions**, especially KeyPackage/Welcome setup. The UI asks for confirmation of the fragment transaction count before submitting such a plan. Every fragment uses the existing VINSS Message action fee; wallet pool/network charges can also apply per transaction. This implementation does not batch these transactions or pretend they cost one action. Existing Shield/Unshield fee policies and contract addresses are unchanged.

Changing rails retains the same cryptographic session. An unfinished packet must resume on its original rail. Received packets can be discovered across both configured Starknet rails; one failed backend does not hide the other, but no unverified fragment becomes an MLS message. KeyPackages are valid for one hour; Welcome for up to 24 hours, subject to a currently valid verified peer package at join. New text is capped at 3000 characters and wire packets at 16 KiB.

MLS application secret ratcheting is active. Do not claim deployed periodic epoch rotation, automatic post-compromise recovery, multi-device recovery, complete metadata privacy, or an independent cryptographic audit. Devices retain local plaintext history encrypted at rest.

## Verification

- `frontend/tests/openmls-engine.test.ts`: actual generated WASM, Alice/Bob exchange, persistence, corrupt-ciphertext rollback, membership change/removal and stale-writer rejection.
- `frontend/tests/openmls-starknet-runtime.test.ts`: actual WASM and Starknet ECDSA, existing envelope/fee/rail code with simulated wallet/RPC/indexer boundaries; signed onboarding, altered signature scope rejection, post-merge Welcome interruption, real receipt tracking, cross-rail reply, reload and ambiguous callback recovery.
- `tests/openmls-keypackage-identity.test.mjs`, `openmls-starknet-framing.test.mjs`: attestation and wire-format edge cases.
- `.github/workflows/openmls-production.yml`: main-branch regressions, typecheck, privacy boundary, isolated frontend build; Rust native tests and rebuild of browser WASM followed by actual engine/runtime tests.

Before claiming live compatibility, test two actual Ready X wallets on Sepolia, fragment approvals, receipt/indexer timing, reload, wallet interruption, and the emitted WASM asset in the deployed frontend. Existing on-chain helpers are reused; no smart-contract redeployment is required for this integration.
