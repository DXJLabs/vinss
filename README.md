# VINSS — Private Deal Room on Starknet

Two parties negotiate, agree on terms, and settle payment inside one
encrypted timeline. Built on STRK20's privacy pool via application-specific
Cairo helper contracts. Built for the STRK20 Private Sprint (Aug 14–31,
2026).

## Repository layout

| Path | What |
|---|---|
| `contracts/` | Cairo helper contracts (messaging, offers, private escrow, escrow settlement, claim links) invoked through the STRK20 Privacy Pool's `InvokeExternal`. |
| `frontend/` | Next.js dapp — wallet connect, Deal Room UI, and the client-side SDK that builds encrypted calldata for each helper. |
| `backend/` | Express indexer exposing `POST /discover` — scans helper events and decrypts whatever matches a given channel key. |
| `docs/` | Product documentation (see `VINSS_Dokumentasi_Produk_Publik_v0.1_ID.docx`). |
| `STRK20_INTEGRATION_PLAN.md` | The repo-specific integration plan this codebase was built from — route chosen, phases, hidden/visible table, open items. |

## What's private, what isn't

Message, offer, and escrow-coordination content is encrypted client-side
before it ever becomes calldata. What stays public: the helper contract
address, a one-time action locator, a commitment to the ciphertext, the
ciphertext itself, and transaction timing. Deposit/withdrawal amounts on the
escrow **settlement** contract are public — those are real ERC-20 legs, not
encrypted envelopes. Full table in `STRK20_INTEGRATION_PLAN.md` §3.

## Status

Early — this is sprint-stage code, not production-ready. See
`docs/VINSS_Dokumentasi_Produk_Publik_v0.1_ID.docx` §8 for the project's own
honest status accounting, and each package's README for known gaps
(`frontend/README.md`, `backend/README.md`, `contracts/README.md`).

## Getting started

1. `contracts/` — build and deploy per `contracts/README.md` (Sepolia first).
2. `backend/` — `cd backend && npm install && cp .env.example .env` and fill
   in the deployed addresses.
3. `frontend/` — `cd frontend && npm install && cp .env.local.example .env.local`,
   same addresses, then `npm run dev`.

## License

MIT — see `LICENSE`.

## Agentic UX

VINSS includes an optional, server-side Groq copilot. The user must explicitly share the selected deal context before an agent request is sent; the agent can analyze, calculate, and draft, but has no transaction-signing or fund-moving tool.

- Backend agent: `backend/src/agent/`
- Agent route: `POST /agent`
- Frontend consent UI: `frontend/components/AgentPanel.tsx`
- Fee UI: `frontend/components/FeeBreakdown.tsx`
- E2E tests: `e2e/vinss.spec.ts`
- Demo video: `test-artifacts/vinss-demo.webm`
- Agent skill: `.agents/skills/vinss-agentic-deal-room/SKILL.md`

Set `GROQ_API_KEY` only in `backend/.env`. Never put it in `frontend/.env.local`.
