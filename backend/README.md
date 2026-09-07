# VINSS Backend

Privacy-aware backend infrastructure for VINSS private Deal Rooms on Starknet.

The backend discovers encrypted on-chain activity, maintains VINSS indexers, serves public and ciphertext-only application data, relays opaque presence state, stores encrypted attachments, supports explicit scoped Agent and dispute workflows, derives loyalty state from Settlement Certificates, and exposes operational/API services.

Normal Message, Offer, and private Rekber discovery does **not** require the backend to receive room secrets, channel keys, viewing keys, wallet private keys, or plaintext decryption material.

Explicit Agent and dispute flows are separate consented paths: only the scoped context or evidence intentionally submitted for those workflows is processed by the backend.

---

## Current backend responsibilities

| Area | Purpose |
| --- | --- |
| Discovery | Returns committed Message, Offer, and private Escrow ciphertext plus public routing metadata |
| Indexers | Tracks Privacy Pool helper activity, canonical Rekber events, and Settlement Certificate events |
| Rekber | Serves indexed Rekber state and related public activity |
| Certificates | Indexes Settlement Certificate events used by activity and loyalty services |
| Presence | Relays short-lived opaque typing and read-receipt envelopes |
| Attachments | Stores and retrieves encrypted attachment ciphertext using scoped attachment tokens |
| Agent | Runs explicit privacy-scoped `chat`, `offer`, and `escrow` skills through configured LLM providers |
| Dispute | Validates dispute cases, Rekber bindings, attestations, policy decisions, and authorized resolution paths |
| Loyalty | Derives read-only loyalty state from indexed Settlement Certificate activity |
| Feedback | Accepts application feedback through a rate-limited backend route |
| API docs | Serves Swagger UI and OpenAPI JSON |
| Protection | Applies CORS, request-size limits, endpoint rate limits, and privacy-safe request logging |

The backend is not the normal plaintext Deal Room state authority. Client-side cryptographic material and decrypted conversation state remain client concerns during normal discovery.

---

## Source structure

```text
backend/
├── src/
│   ├── agent/
│   │   ├── providers/
│   │   │   ├── anthropic.ts
│   │   │   ├── groq.ts
│   │   │   ├── openai-compatible.ts
│   │   │   ├── registry.ts
│   │   │   └── types.ts
│   │   ├── skills/
│   │   │   ├── chat.ts
│   │   │   ├── dispute.ts
│   │   │   ├── escrow.ts
│   │   │   ├── offer.ts
│   │   │   ├── registry.ts
│   │   │   └── types.ts
│   │   ├── context.ts
│   │   ├── index.ts
│   │   ├── prompts.ts
│   │   ├── runtime.ts
│   │   └── tools.ts
│   │
│   ├── dispute/
│   │   ├── attestation.ts
│   │   ├── attestationStore.ts
│   │   ├── binding.ts
│   │   ├── chain.ts
│   │   ├── decision.ts
│   │   ├── evidence.ts
│   │   ├── executor.ts
│   │   ├── policy.ts
│   │   ├── service.ts
│   │   ├── store.ts
│   │   └── types.ts
│   │
│   ├── indexer/
│   │   ├── certificate.ts
│   │   ├── certificateStore.ts
│   │   ├── definitions.ts
│   │   ├── poolEvents.ts
│   │   ├── rekber.ts
│   │   ├── rekberStore.ts
│   │   ├── service.ts
│   │   └── store.ts
│   │
│   ├── loyalty/
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── middleware/
│   │   └── rateLimit.ts
│   │
│   ├── routes/
│   │   ├── activity.ts
│   │   ├── agent.ts
│   │   ├── attachments.ts
│   │   ├── discover.ts
│   │   ├── dispute.ts
│   │   ├── feedback.ts
│   │   ├── health.ts
│   │   ├── presence.ts
│   │   └── rekber.ts
│   │
│   ├── scripts/
│   │   └── manualDisputeResolution.ts
│   │
│   ├── app.ts
│   ├── config.ts
│   ├── database.ts
│   ├── index.ts
│   ├── openapi.ts
│   └── types.ts
│
├── tests/
│   ├── agent-tools.test.ts
│   ├── certificate-indexer.test.ts
│   ├── dispute-attestation.test.ts
│   ├── dispute-executor.test.ts
│   ├── dispute-policy.test.ts
│   ├── dispute-store.test.ts
│   ├── indexer.test.ts
│   ├── loyalty.test.ts
│   └── rekber-indexer.test.ts
│
├── BACKEND_REPAIR_REPORT.md
├── env.mainnet.example
├── package-lock.json
├── package.json
└── tsconfig.json
```

Generated runtime output such as `dist/` and dependency directories such as `node_modules/` are intentionally omitted.

---

## Source boundaries

```text
src/routes/
    HTTP API boundaries

src/indexer/
    Starknet event discovery, Rekber indexing, certificate indexing, and persistence

src/agent/
    scoped Agent skills, providers, context sanitization, runtime, and tools

src/dispute/
    dispute evidence validation, attestations, Rekber binding, policy, execution, and persistence

src/loyalty/
    read-only loyalty derivation from indexed Settlement Certificates

src/middleware/
    shared request protection such as rate limiting

src/scripts/
    explicit operational scripts

src/config.ts
    network, contract, database, feature, provider, indexer, and rate-limit configuration

src/app.ts
    Express application composition

src/index.ts
    backend startup and indexer lifecycle
```

---

## Run locally

```bash
cd ~/vinss/backend
npm install
npm run dev
```

The backend requires its configured environment values, including Starknet network/RPC, PostgreSQL, VINSS contract addresses, and indexer start blocks.

Use [`env.mainnet.example`](./env.mainnet.example) as the production configuration reference.

---

## Build and validation

```bash
npm run typecheck
npm run build
npm test
```

`npm test` runs the backend TypeScript test suite under `tests/*.test.ts` and the repository privacy-boundary checks.

Current backend tests cover:

- Agent tool and skill behavior;
- discovery indexer persistence;
- Rekber indexer behavior;
- Settlement Certificate indexing;
- loyalty derivation;
- dispute attestation verification;
- dispute policy behavior;
- dispute execution behavior;
- dispute persistence;
- privacy-boundary enforcement.

---

## Production

```bash
npm run build
npm start
```

The default local port is `4000` unless `PORT` is configured differently.

---

## API documentation

When running locally on the default port:

```text
Swagger UI:   http://localhost:4000/docs
OpenAPI JSON: http://localhost:4000/openapi.json
Health:       http://localhost:4000/health
```

Swagger/OpenAPI documents the currently described HTTP API surface. Some implemented backend routes may be documented in the technical API reference before they are fully represented in `openapi.ts`.

---

## Technical documentation

Detailed backend architecture, interaction flows, privacy boundaries, discovery/indexing, Agent behavior, API contracts, configuration, deployment, observability, loyalty, presence, operations, and limitations are documented under:

**[`../docs/technical/backend/README.md`](../docs/technical/backend/README.md)**

Key references:

- [`../docs/technical/backend/architecture.md`](../docs/technical/backend/architecture.md)
- [`../docs/technical/backend/privacy-security.md`](../docs/technical/backend/privacy-security.md)
- [`../docs/technical/backend/discovery-indexer.md`](../docs/technical/backend/discovery-indexer.md)
- [`../docs/technical/backend/agent-system.md`](../docs/technical/backend/agent-system.md)
- [`../docs/technical/backend/api-reference.md`](../docs/technical/backend/api-reference.md)
- [`../docs/technical/backend/loyalty.md`](../docs/technical/backend/loyalty.md)
- [`../docs/technical/backend/presence.md`](../docs/technical/backend/presence.md)
- [`../docs/technical/backend/mainnet-readiness.md`](../docs/technical/backend/mainnet-readiness.md)

---

## Privacy rule

For normal Message, Offer, and private Rekber discovery, the backend handles ciphertext and public metadata rather than application plaintext or client decryption keys.

Do not send room secrets, channel keys, viewing keys, wallet private keys, or decrypted conversation state to discovery endpoints.

Agent and dispute workflows are explicit scoped exceptions: they may process only the context, evidence, attestations, or authorization material intentionally provided for those workflows, subject to their own sanitization and verification boundaries.
