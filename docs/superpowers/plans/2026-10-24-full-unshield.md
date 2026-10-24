# Full Unshield Implementation Plan

> **For agentic workers:** Execute task-by-task with a fresh review before claiming completion.

**Goal:** Add public wallet execution for the existing encrypted Deal Room and real Rekber.
**Architecture:** Dedicated public adapter + existing helper/Rekber instances pinned to adapter; mode-scoped gateway, configuration, invite serialization and discovery. Shield stays default.
**Tech Stack:** Cairo/Scarb, Starknet.js 10.4, Next.js/React, TypeScript, Node tests.
**Spec:** docs/superpowers/specs/2026-10-24-full-unshield-design.md

## Global Constraints
- Preserve original pool-only helpers and Rekber 2%/floor/reserve; no funds redirected to arbitrary recipients.
- Keep ciphertext onchain and plaintext client-side.
- No silent fallback, fake deployments, real wallet success claims, main merge or production deploy.
- New Unshield config and deployment required; old room/invite defaults Shield.

## Review Focus
- Copied public secrets must not grant unauthorized escrow action or invite consumption.
- Switching rooms or modes must not route an existing custody to another deployment.
- Public funding, fees and payout allowances must be atomic, bounded and exact.
- Missing configuration must fail before signature, not masquerade as Shield.
- Discovery/read/fee paths must match write deployment and cache identity.

### Task 1: Public adapter contracts and tests
- [x] Implement narrow public endpoints over configured cloned helpers, role-bound Rekber, signed-capability invite and cheaper flat FeePolicy wrapper.
- [x] Test caller binding, malformed calldata, fee/principal accounting, exact output drain, replay and mode isolation.
- [x] Compile/test Cairo, document deploy initialization/configuration and blockers.

### Task 2: Mode-scoped execution gateway and client reads
- [x] Runtime tests for public invoke translation/typed calls, no STRK20 execution, matching configured deployment and missing config/network guards.
- [x] Central invokeVinssActions gateway preserves Shield action bundles and maps public routes to adapter calls, only allowlisted operations.
- [x] Quote/read functions receive mode context; Rekber funding receives payee binding.

### Task 3: Full-room mode UI, invites and discovery
- [x] Persist room mode, use scoped session across every room hook, encrypted invite propagation/recovery and disable unsupported configurations.
- [x] Replace payment-only mode switch with full room mode controls and restore real EscrowPanel in both modes.
- [x] Index public helper deployments and keep distinct source checkpoint identities.
- [x] Add tests for mode serialization, old Shield defaults, no plaintext calldata and all route wiring.

### Task 4: Review and durable verification
- [x] Run focused regressions, privacy checks, frontend/backend typecheck/build and Cairo checks.
- [x] Review actual changes against requirements and fix Important/Critical findings.
- [x] Save code to feature branch, report exact remaining live-deployment/wallet limitations.

## Verification ledger

- Contract review I1/I2 fixed: public invite capability key is never revealed;
  caller/chain/adapter-bound locators prevent copied locator squatting.
- Final Cairo verification: 151 tests pass (61 public, 90 existing), production
  build passes; one test-only invalid selector import corrected.
- Full integration review requested dispute routing/signature parity, certificate
  rail links, and invalid stored-mode fail-closed behavior. Fixes add public
  backend deployment validation, cross-layer typed-data/hash tests, scoped
  certificate metadata/reads, and strict stored-room mode resolution.
- Groups, feedback and loyalty now follow the room's backend; polling depends
  on the scoped account/backend to avoid reconnect closures using old rails.
- No live deployment, wallet transfer, main merge or production release claimed.

Final verification (25 October 2026): 151 Cairo tests, 30 frontend tests,
58 Node regressions and 46 backend tests pass (285 total). Frontend production
build/typecheck and backend typecheck/build pass; privacy boundary checks pass.
Nine mobile browser checks pass at390x844, including mode persistence, locks,
invalid-data rejection, rail-aware metadata and no page JavaScript errors.
Final review I1–I4 closed; no new Critical/Important findings in scoped fixes.
Live deployment and real wallet acceptance remain separate and unclaimed.
