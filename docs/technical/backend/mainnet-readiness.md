# Backend Mainnet Readiness

**Documentation completeness is not mainnet readiness.**

## Status vocabulary

```text
READY
  implemented/validated in current backend code or tests

REQUIRED
  deployment-specific verification still needed

BLOCKER
  should be fixed, protected, or explicitly disabled
  before serious public mainnet use
```

## Privacy architecture

| Item | Status | Evidence |
|---|---|---|
| Ciphertext-only discovery | READY | `/discover` rejects `channelKeyHex` |
| No backend decrypt path | READY | regression checks |
| Server Agent sanitizer | READY | allowlist reconstruction |
| Skill tool scope | READY | code-enforced allowlist + tests |
| Minimal request logging | READY | method + path only |
| Generic Agent failure response | READY | no raw upstream error response |

## Network / contracts

| Item | Status |
|---|---|
| Explicit `STARKNET_NETWORK=mainnet` | REQUIRED |
| Explicit mainnet `RPC_URL` | REQUIRED |
| Privacy Pool address verified | REQUIRED |
| Message Helper verified | REQUIRED |
| Offer Helper verified | REQUIRED |
| Private Escrow Helper verified | REQUIRED |
| Escrow Rekber address/reference verified if enabled | REQUIRED |
| Fail-closed network/address validation | BLOCKER / hardening |

Current config defaults to Sepolia and allows empty contract addresses.

That is acceptable for development, not a mainnet safety guarantee.

## Public API protection

| Item | Status |
|---|---|
| JSON body limit (`1mb`) | READY |
| Exact production CORS origin | REQUIRED |
| `/discover` rate limiting | BLOCKER |
| `/agent` cost/abuse limiting | BLOCKER |
| General throttling | REQUIRED |
| Input-validation audit | REQUIRED |
| Loyalty write authorization | BLOCKER if enabled |

CORS is not authentication.

## Discovery scalability

| Item | Status |
|---|---|
| Default live scan bounded to latest 10k blocks | READY |
| RPC-backed event scanning | CURRENT |
| Persistent ciphertext index | NOT YET |
| Pagination | NOT YET |
| RPC failover | REQUIRED for serious availability |
| Abuse/rate protection | BLOCKER |

## Presence

| Item | Status |
|---|---|
| Encrypted opaque relay | READY |
| TTL bounds | READY |
| Durable storage | NOT REQUIRED for strictly ephemeral single-instance use |
| Multi-replica consistency | BLOCKER if horizontally scaled |

## Agent

| Item | Status |
|---|---|
| No transaction execution tools | READY |
| Explicit skill | READY |
| Server-side sanitizer | READY |
| Provider registry/fallback support | READY |
| Provider credentials server-side | REQUIRED deployment check |
| Timeout/cost policy | REQUIRED hardening |
| Public endpoint abuse protection | BLOCKER |

## Loyalty

Current loyalty must be treated separately from core launch readiness.

If disabled/non-valuable:

```text
does not block core private Deal Room backend
```

If enabled as valuable state:

```text
durable storage
authentication
authorized event issuer
persistent idempotency
anti-abuse
reconciliation
```

become blockers.

## Operations

| Item | Status |
|---|---|
| TypeScript build | READY process |
| Unit/privacy regression tests | READY |
| Liveness endpoint | READY |
| Dependency readiness probe | NOT YET |
| Monitoring/alerts | REQUIRED |
| Rollback procedure | REQUIRED operational verification |
| Incident runbook | READY docs |

## Minimum launch gate

```text
[ ] explicit mainnet network/RPC
[ ] verified mainnet addresses
[ ] production CORS
[ ] /discover abuse protection
[ ] /agent abuse/cost protection
[ ] loyalty disabled OR production-hardened
[ ] presence scaling assumption accepted
[ ] typecheck/build/tests pass
[ ] privacy boundary tests pass
[ ] deployed mainnet smoke checks pass
[ ] monitoring available
[ ] rollback path available
```

Core backend mainnet scope should stay narrow:

```text
ciphertext discovery
+ optional encrypted presence
+ optional rate-limited Agent
```

Optional services must not become dependencies of the canonical private settlement path.
