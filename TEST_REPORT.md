# VINSS Verification Report

Date: 2026-08-14

## Verified in this build

- Backend agent tool unit tests: **4/4 PASS**.
- Privacy boundary static checks: **PASS**.
- Demo video generated: `test-artifacts/vinss-demo.webm` — 1440×900, VP9, 13 seconds.
- Agent tool allowlist contains analysis, fee calculation, and counter-offer drafting only.
- Frontend does not reference `GROQ_API_KEY`.
- Room secrets are no longer rendered in the room list; they are exposed only through an explicit Access details view.
- Escrow deposit now requires a custody commitment created during encrypted coordination and reuses that commitment for settlement preparation.

## Not claimed as verified

- `npm install` for the frontend/backend did not complete in the build environment before timeout, so a full Next.js/Express dependency-backed build was not claimed green.
- Playwright browser E2E tests are included in `e2e/vinss.spec.ts` and configured to record video, but were not executed because Playwright dependencies were not installed.
- Real Ready wallet signing, STRK20 proving, Sepolia two-party E2E, and contract deployment remain manual/testnet verification items from `STRK20_INTEGRATION_PLAN.md`.

## Demo artifact

The included video is a UX walkthrough of the intended invisible-agent experience. It is a product/demo recording, not evidence of a successful blockchain transaction.
