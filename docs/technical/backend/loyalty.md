# Loyalty Service

## Classification

**Auxiliary / experimental application service.**

Loyalty exists in the current backend codebase, but it is not part of:

```text
STRK20 privacy protocol
ciphertext discovery
Offer settlement authority
Escrow Rekber custody
canonical settlement evidence
```

## Current endpoints

```text
GET  /loyalty/config
GET  /loyalty/:subject
POST /loyalty/events
```

## Current actions

```text
message_sent
offer_created
offer_accepted
escrow_created
escrow_funded
deal_completed
invite_user
successful_referral
```

## Current storage

Implementation uses process memory:

```ts
const accounts =
  new Map<string, LoyaltyAccount>();

const events =
  new Map<string, LoyaltyEvent>();
```

A restart/redeploy resets state.

## In-process idempotency

`eventId` prevents duplicate awards only while the process map survives.

This is not persistent replay protection.

## Authorization limitation

The current write route accepts:

```text
subject
action
eventId
```

and does not implement a production authentication/authorization model for valuable reward state.

Therefore the current service must **not** be presented as a production reward ledger.

## Production rule

If loyalty is not part of the initial production/mainnet scope, isolate or disable valuable write behavior.

If it later carries value, it requires at minimum:

- durable storage;
- persistent idempotency/replay protection;
- authenticated subjects;
- authorized event issuers;
- anti-abuse rules;
- canonical event reconciliation;
- backup/recovery procedures.

The core private Deal Room path should not depend on loyalty availability.
