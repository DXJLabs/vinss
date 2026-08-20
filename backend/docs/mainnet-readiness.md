# Mainnet Readiness

This checklist is intentionally strict.

**Documentation completeness is not proof of mainnet readiness.**

Status terms:

```text
READY     implemented and validated in current backend
REQUIRED  must be verified for the deployment
BLOCKER   should be fixed or explicitly disabled before public mainnet use
```

## Privacy architecture

| Item                                        | Status             | Note                             |
| ------------------------------------------- | ------------------ | -------------------------------- |
| Ciphertext-only discovery                   | READY              | `/discover` rejects channel keys |
| Client-side decryption                      | READY architecture | Backend has no decryption path   |
| Agent server-side context sanitizer         | READY              | Backend rebuilds safe context    |
| Skill tool allowlist enforced in code       | READY              | Cross-skill execution blocked    |
| Request bodies excluded from normal logging | READY              | Minimal method/path logging      |
| Raw provider errors hidden from client      | READY              | Generic Agent failure            |

## Network and contracts

| Item                                | Status            | Note                                         |
| ----------------------------------- | ----------------- | -------------------------------------------- |
| `STARKNET_NETWORK=mainnet`          | REQUIRED          | Must be explicit                             |
| Mainnet `RPC_URL`                   | REQUIRED          | Do not use Sepolia fallback                  |
| Privacy Pool address verified       | REQUIRED          | Verify exact mainnet deployment              |
| Messaging helper verified           | REQUIRED          | Address/class/ABI                            |
| Offer helper verified               | REQUIRED          | Address/class/ABI                            |
| Escrow helper verified              | REQUIRED          | Address/class/ABI                            |
| Settlement/rekber address verified  | REQUIRED          | If enabled                                   |
| Network/address mismatch protection | BLOCKER/Hardening | Current config does not strongly fail closed |

## Public API abuse protection

| Item                        | Status             | Note                                |
| --------------------------- | ------------------ | ----------------------------------- |
| Request body size limit     | READY              | Express `1mb`                       |
| Production CORS origin      | REQUIRED           | Set exact frontend origin           |
| `/discover` rate limiting   | BLOCKER            | RPC-heavy public endpoint           |
| `/agent` rate limiting      | BLOCKER            | Prevent provider cost abuse         |
| Loyalty write authorization | BLOCKER if enabled | Current event award route is public |
| General request throttling  | BLOCKER/Required   | Protect public deployment           |
| Input validation audit      | REQUIRED           | Recheck every write/costly endpoint |

CORS is not authentication.

## Persistence

| Item                               | Status                          | Note                              |
| ---------------------------------- | ------------------------------- | --------------------------------- |
| Presence persistence               | OPTIONAL/Architecture decision  | Currently in-memory and ephemeral |
| Presence multi-replica consistency | BLOCKER if scaling horizontally | Use shared TTL store              |
| Loyalty durability                 | BLOCKER if loyalty enabled      | Currently in-memory               |
| Loyalty idempotency durability     | BLOCKER if loyalty enabled      | Event map resets on restart       |

If loyalty is not launching on mainnet, disable/isolate its write path until durable design is ready.

## Discovery scaling

| Item                               | Status                            | Note                                     |
| ---------------------------------- | --------------------------------- | ---------------------------------------- |
| Bounded default scan               | READY                             | Last 10,000 blocks for default live scan |
| RPC error handling                 | BASIC                             | Generic route failure                    |
| Persistent public ciphertext index | NOT YET                           | Future scaling                           |
| Pagination/caching                 | NOT YET                           | Consider before high traffic             |
| RPC failover                       | REQUIRED for serious availability | Operational configuration                |

## Agent

| Item                             | Status             | Note                                |
| -------------------------------- | ------------------ | ----------------------------------- |
| No signing tools                 | READY              | Agent cannot execute wallet actions |
| Explicit skill required          | READY              | chat/offer/escrow                   |
| Provider configuration discovery | READY              | `/agent/providers`                  |
| Provider secrets server-side     | REQUIRED           | Verify production env               |
| Provider timeout/cost limits     | REQUIRED hardening | Confirm provider adapter behavior   |
| Agent endpoint abuse protection  | BLOCKER            | Rate limit/auth policy              |

## Operations

| Item                          | Status                             | Note                             |
| ----------------------------- | ---------------------------------- | -------------------------------- |
| Build/test release gate       | READY process                      | Must be enforced                 |
| Privacy regression tests      | READY                              | Existing checks                  |
| `git diff --check`            | READY process                      | Run before release               |
| Liveness endpoint             | READY                              | `/health`                        |
| Dependency readiness endpoint | NOT YET                            | Recommended                      |
| Metrics/alerts                | REQUIRED                           | Railway/external monitoring      |
| Rollback procedure            | REQUIRED                           | Keep previous known-good release |
| Incident runbook              | READY docs                         | See `incident-runbook.md`        |
| Backup/recovery               | REQUIRED for future durable stores | Not applicable to current Maps   |

## Mainnet launch minimum

Do not call the public backend mainnet-ready until at least:

```text
[ ] Mainnet RPC explicitly configured
[ ] Every mainnet contract address verified
[ ] Production CORS configured
[ ] /discover protected from abuse
[ ] /agent protected from abuse/cost attacks
[ ] Loyalty write endpoint disabled OR authenticated + durable
[ ] Presence single-instance limitation accepted OR shared TTL store added
[ ] Build passes
[ ] All tests pass
[ ] Privacy boundary checks pass
[ ] Mainnet smoke test passes
[ ] Monitoring and rollback are available
```

## Recommended launch strategy

For the fastest safe launch, keep the initial mainnet backend scope narrow:

```text
Core:
  ciphertext discovery
  Agent (rate-limited)
  optional ephemeral presence

Do not enable as valuable state until hardened:
  loyalty rewards
```

The protocol-critical privacy path should remain independent from optional Agent and loyalty availability.
