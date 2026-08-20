# Known Limitations

Current backend limitations are documented explicitly so they are not mistaken for hidden production guarantees.

## Discovery

- live RPC-backed scanning rather than a durable background index;
- default broad discovery is bounded to the latest 10,000 blocks;
- ciphertext chunks are fetched through helper getter calls;
- no response pagination;
- no persistent cache;
- no built-in RPC failover.

## Presence

- in-memory only;
- reset on restart/redeploy;
- not shared between replicas;
- intended as ephemeral UX state.

## Loyalty

- in-memory only;
- reset on restart/redeploy;
- current write endpoint is not a production-authorized reward ledger;
- persistent replay/idempotency protection does not exist yet.

## Agent

- remote providers receive the user's explicit Agent instruction;
- sanitized metadata may be shared with the provider;
- Agent availability depends on external provider availability;
- current public endpoint needs production abuse/cost protection.

## Health checks

`/health` is currently a simple liveness/network response.

It does not prove:

- RPC availability;
- correct chain ID;
- contract deployment availability;
- Agent provider availability.

## Configuration

Development defaults favor Sepolia.

Mainnet must use explicit configuration and verified addresses.

## Product scope

The backend may expose technical primitives for:

```text
message
offer
escrow
loyalty
```

without implying each corresponding user-facing workflow is complete.

Current product emphasis remains two-party private chat and Offer flow.
