# Observability

## Logging principle

VINSS backend logging must optimize for operational usefulness **without capturing private user content**.

Current request logging records:

```text
HTTP method
path
```

Request bodies are intentionally excluded.

## Safe operational fields

Generally safe:

```text
timestamp
route
HTTP status
latency
network
provider ID
generic error category
RPC latency
RPC status
deployment/commit version
```

Review any new field before logging it.

## Do not log

```text
request bodies
room secrets
channel keys
viewing keys
private message text
Offer terms
wallet private keys
provider API keys
decrypted payloads
raw Agent context
```

## Metrics recommended for mainnet

### HTTP

- requests by route/status;
- p50/p95/p99 latency;
- request rejection count;
- rate-limit rejection count.

### Discovery

- event scan latency;
- number of events scanned;
- ciphertext chunk getter count;
- RPC failures/timeouts;
- requested block span.

### Agent

- calls per provider;
- provider success/failure;
- provider latency;
- fallback count;
- token/cost metrics where available without logging prompts.

### Runtime

- memory;
- CPU;
- restarts;
- uptime;
- event-loop health.

## Readiness vs liveness

`GET /health` currently indicates the process is alive and reports configured network.

For production, consider a separate readiness check that verifies critical dependencies such as:

- RPC reachable;
- required contract addresses configured;
- expected chain/network;
- optional Agent provider availability.

Do not make a readiness probe leak secrets or private data.
