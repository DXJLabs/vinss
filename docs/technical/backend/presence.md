# Encrypted Presence

## Objective

Presence provides ephemeral coordination without requiring the backend to know plaintext event semantics.

Current client-defined uses include:

```text
typing
read
participant
group_member
```

The backend itself treats them as opaque ciphertext.

## Endpoints

```text
POST /presence/publish
POST /presence/poll
```

## Stored record

The backend receives/stores only:

```text
channelId
eventId
iv
ciphertext
createdAt
expiresAt
```

It does not receive:

```text
room key
pairwise key
wallet address as a presence field
typing plaintext
read plaintext
participant plaintext
```

## Validation and limits

Current server limits:

```text
channelId            64 lowercase hex chars
eventId              8–96 allowed chars
minimum TTL          1 second
maximum TTL          24 hours
max events/channel   120
ciphertext max       16,384 chars
```

## Current storage mechanism

Important implementation:

```ts
const channels =
  new Map<string, PresenceRecord[]>();
```

This makes presence intentionally non-durable.

Expired entries are cleaned during channel access.

## Failure semantics

Process restart/redeploy clears presence state.

This should degrade ephemeral UX only; it must not erase canonical Message/Offer on-chain records.

## Scaling boundary

Multiple backend replicas do not share the in-memory map.

If presence must work consistently across replicas, use a shared TTL-oriented store.

Do not solve this by decrypting presence server-side.
