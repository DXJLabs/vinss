# Known Backend Limitations

These limitations are explicit so implementation foundations are not mistaken for production guarantees.

## Discovery

Current implementation:

- scans Starknet RPC live;
- defaults broad live discovery to roughly the latest 10,000 blocks;
- fetches ciphertext through helper getters;
- makes one getter call per payload chunk;
- has no persistent ciphertext cache;
- has no response pagination;
- has no built-in RPC failover;
- currently has no public endpoint rate limiting.

## Privacy / metadata

Ciphertext-only does not mean metadata-free.

The backend can observe/process public or protocol-visible fields such as:

```text
helper kind
action locator
commitment
opaque routing tags
ciphertext length/chunk count
block number
transaction hash
request timing
```

The design prevents normal plaintext decryption server-side; it does not claim that all metadata disappears.

## Agent

- remote provider receives the user's explicit instruction;
- sanitized workflow metadata may be shared;
- automatic sanitization deliberately removes rich Offer/deal semantics;
- therefore automatic deal-stage reasoning is intentionally limited;
- provider availability is external;
- public Agent endpoint still needs production abuse/cost controls.

## Presence

- in-memory only;
- reset on restart/redeploy;
- not shared across replicas;
- intended as optional ephemeral state.

## Loyalty

- auxiliary service;
- in-memory only;
- reset on restart/redeploy;
- write route is not production-authorized valuable-state accounting;
- idempotency is only process-lifetime;
- should not be treated as a canonical reward ledger.

## Health

`GET /health` is liveness/configuration status only.

It does not prove:

```text
RPC availability
correct chain ID
helper reachability
Agent provider health
```

## Configuration

Development fallbacks favor Sepolia.

Current configuration does not strongly fail closed when mainnet is selected with missing/mismatched infrastructure.

## Escrow scope

Backend `kind: "escrow"` discovers encrypted **Private Escrow coordination** actions.

It does not mean the backend executes or proves the complete Escrow Rekber deposit/release/refund lifecycle.

Financial settlement authority remains outside this backend.

## Mainnet

The backend must not be called mainnet-ready until deployment-specific hardening and smoke evidence are complete.
