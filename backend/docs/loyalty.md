# Loyalty Service

## Purpose

The loyalty service is application-side state. It is not part of the privacy-pool protocol.

Current endpoints:

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

## Idempotency

Each award includes an `eventId`.

The current service prevents the same recorded event ID from awarding points twice during the lifetime of the process.

## Current storage

The implementation currently uses:

```ts
const accounts = new Map<string, LoyaltyAccount>();
const events = new Map<string, LoyaltyEvent>();
```

This means loyalty state is not durable.

## Mainnet status

**Do not treat the current in-memory loyalty service as a production ledger.**

Before enabling loyalty as valuable mainnet product state:

- use durable storage;
- make idempotency persistent;
- define subject authentication/ownership;
- authorize who may award events;
- add anti-abuse rules;
- define replay protection;
- define reconciliation against canonical application/on-chain events;
- define backup/restore strategy.

If loyalty is not part of the initial mainnet launch, disable or isolate the write endpoint rather than presenting it as final production accounting.
