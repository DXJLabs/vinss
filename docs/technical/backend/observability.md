# Backend Observability

## Objective

Observability must help operate VINSS without turning logs/metrics into a secondary plaintext data store.

## Current logging

Normal request logging records only:

```text
HTTP method
path
```

Implementation:

```ts
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

Request bodies are intentionally excluded.

## Safe operational telemetry

Examples:

```text
timestamp
route
status code
latency
configured network
provider ID
generic failure category
RPC latency/status
deployment/commit version
```

Review every new field before logging it.

## Never log

```text
request bodies
room/channel/pairwise keys
viewing keys
Message plaintext
Offer terms
decrypted payloads
Escrow Rekber secrets
wallet private keys
provider API keys
raw Agent context
raw provider errors that may echo prompts
```

## Mainnet metrics

### Discovery

- request count/status;
- event-scan latency;
- scanned block span;
- events found;
- chunk getter count;
- RPC failures/timeouts.

### Agent

- calls by provider;
- success/failure;
- latency;
- fallback count;
- cost/token metrics only when prompt content is not logged.

### Runtime

- memory;
- CPU;
- restarts;
- uptime;
- event-loop health.

## Liveness vs readiness

`GET /health` currently proves that the process responds and reports configured network.

It does not prove:

```text
RPC reachable
correct chain ID
required helper contracts reachable
Agent provider healthy
```

A future readiness probe should validate dependencies without exposing secrets.
