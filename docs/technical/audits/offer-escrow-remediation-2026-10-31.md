# Offer, Escrow Rekber and settlement remediation — 31 October 2026

Base: `250e847` on `feat/strk20-unshield-fees`. Applies to Starknet Shield and Unshield. Canton retains its separate DAML execution/privacy model; these are not global multichain toggles.

## Implemented boundaries

| Audit item | Implementation | Compatibility |
|---|---|---|
| OES-01: shared-key Offer impersonation | `offerAuthorization.ts` signs a deterministic payload digest with SNIP-12, binding sender, recipient, locator, chain, rail and Offer helper. Signatures remain encrypted. `offerLifecycle.ts` requires an authenticated parent and correct responding party; accepted terms must match. Only authenticated children supersede controls. | Unsigned historical cards remain visible as unverified. They cannot authorize replies or a new Escrow agreement. Existing separately signed Rekber agreements remain recoverable. |
| OES-02: unanchored discovery | `envelopeProof.ts` recomputes V2 commitment; checks six immutable helper fields; checks RPC chain, accepted successful receipt, helper event, hash and block. Invalid records are isolated per record. `escrow.ts` additionally verifies setup/acceptance signatures before promoting them to agreement state and checks release capability commitments. | Correct historical ciphertext remains readable. There is no fallback from failed RPC verification to indexer claims. Successfully verified anchors are cached for 30 seconds, with bounded capacity. |
| OES-03: shared-key local recovery | `deviceKey.ts` provides the existing non-exportable IndexedDB key. `deviceCache.ts`, `rekberSecrets.ts` and `offerHistory.ts` use independent device encryption with wallet/room/custody context, serialization and verified migration. | Existing funded capabilities are retained exactly; they are never rotated. Readable legacy copies are removed only after verified replacement. Unreadable old copies remain. Valid device recovery can still be read if a stale old copy is unreadable. Corrupt device data blocks overwrite; missing IndexedDB never triggers shared-key fallback. |
| OES-04: public coordination fee downgrade | After decryption identifies create/accept/dispute, discovery requires an exact `post_escrow_action` trace for the same locator/envelope on the configured adapter, with the existing 1 STRK workflow fee. A paid sibling call cannot cover a zero-fee action. | Free background coordination remains free. Historical unpaid coordination is recovery-only when `custody_exists` proves custody already exists on the selected deployment; it cannot authorize new acceptance or funding. |
| OES-05: preparation hang | `walletPreparation.ts` observes rejection immediately; `useRoomEscrow.ts` races preparation against early completion/error before starting discovery recovery. | Preflight failures return promptly. Prepared ambiguous wallet callbacks retain the existing exact-locator reconciliation and timeout behavior. |

## Limits of the fee remediation

OES-04 is mitigated at the VINSS workflow-recognition boundary, **not newly enforced as private semantic classification by the deployed Cairo adapter**. The adapter still intentionally accepts zero for free opaque background actions. Two custom clients can ignore VINSS's recognition rules and use the underlying opaque storage protocol differently. Fully mandatory contract classification of an encrypted action would require another protocol design/proof or a changed fee policy. This patch does not claim that property and does not raise fees for background actions.

Custody principal, canonical funding/service-fee quotes, reserve accounting, original Payer/Payee bindings, token policies and contract addresses are unchanged. This patch requires no replacement custody contract or contract deployment. Existing custody funds are not migrated when switching room mode.

## Product behavior

New Offer lifecycle actions, including low-level sends, require sender/recipient wallet identities and request a wallet signature before encrypted publication. Ready X may therefore open twice: sign, then publish. Terms and signatures are not added to public helper metadata. Wallet signature validation does send the signer address, typed-data hash and signature to the configured RPC; it does not send plaintext Offer terms. Shield does not hide RPC-query metadata. Historical unsigned Offers are labelled unverified. A new agreement requires a newly authenticated Offer; settlement of an existing signed Rekber agreement continues through its original deployment and capabilities.

The selected Starknet RPC must support successful receipt reads, helper contract reads, wallet signature validation, and `starknet_traceTransaction` for paid Unshield coordination. Missing/pruned trace data does not authorize a new paid workflow. Already-funded custody has an explicit recovery path rather than being silently treated as a newly paid action.

A non-exportable device key protects against a localStorage-only dump; it does not make active same-origin script compromise, a compromised wallet or a full device compromise safe. Retained unreadable legacy records may still contain sensitive data until recovered and migrated. Clearing IndexedDB can remove recovery-key access; do not clear browser storage for an existing funded custody without a secure recovery plan.

## Code locations

| Concern | Files |
|---|---|
| Offer signature/lineage | `frontend/lib/deal-room/offerAuthorization.ts`, `offerLifecycle.ts`, `offers.ts`, `frontend/hooks/room/useRoomOffers.ts` |
| Chain and fee evidence | `frontend/lib/deal-room/envelopeProof.ts`, `escrow.ts`, `frontend/hooks/room/useRoomEscrow.ts` |
| Device recovery/history | `frontend/lib/privacy/deviceKey.ts`, `deviceCache.ts`, `deviceHistory.ts`, `frontend/lib/deal-room/rekberSecrets.ts`, `offerHistory.ts` |
| Early failure handling | `frontend/lib/deal-room/walletPreparation.ts`, `frontend/hooks/room/useRoomEscrow.ts` |
| Consent/recovery UI | `frontend/components/room/conversation/OfferCard.tsx`, `DirectConversationPanel.tsx`, `frontend/components/room/escrow/EscrowPanel.tsx`, `frontend/app/room/[roomId]/page.tsx` |
| Negative and legitimate controls | `frontend/tests/offer-escrow-security.test.ts`, `deal-device-storage.test.ts`, `public-rail-runtime.test.ts` |

## Verification scope

Tests use real encryption, IndexedDB emulation and ECDSA signing/verification with synthetic wallet keys, plus wallet/RPC boundary fixtures. They exercise forged authorship, altered terms/parents/locators/rails, malformed records, wrong chain/helper/commitment/receipt/event/block, incorrect per-action fee evidence, retained funded legacy recovery, unsigned-child suppression, poisoned setup/release records, device migration failures, capability replacement and pre-preparation failures.

Run from repository root:

```bash
npm --prefix frontend run typecheck
TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import ./backend/node_modules/tsx/dist/loader.mjs --test frontend/tests/*.test.ts
node --test tests/*.test.mjs
node scripts/verify-frontend-only-build.mjs
```

No Cairo source or ABI changed; Cairo execution is not a validation gate for this frontend patch. No live two-wallet Sepolia/Mainnet lifecycle, wallet-extension UI, deployed-bytecode comparison or full repository security certification is claimed. Original at-rest decryption, fake publication and peer-forged consent paths are rejected at the changed boundaries; legitimate signed/anchored actions and existing custody capabilities have positive controls in the same suites.

### Verification results

- Frontend: 65 passing test results, including 19 new security/storage/preparation controls.
- Root regression suite: 61 passing test results.
- Backend regression suite: 49 passing test results.
- Total: 175 passing test results; zero failing/skipped results.
- Frontend TypeScript check: pass.
- Isolated production build without sibling backend: pass.
- Privacy/ciphertext discovery/cross-layer boundary checks: pass.
- Diff whitespace check: pass.
- Independent read-only candidate review found unsigned-child supersession and historical zero-fee-funded recovery regressions; both were corrected and received focused controls.
- Existing 24 Mermaid diagrams across Offer, Escrow Rekber and privacy-model documentation were retained unchanged.

These results apply to local source/runtime verification. CI and live deployment status are separate evidence. OES-01/02/03/05 are fixed at their changed application boundaries. OES-04 has the explicit workflow-recognition mitigation above; mandatory on-chain classification remains outside this patch.
