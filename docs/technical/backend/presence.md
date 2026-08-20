# Encrypted Presence

## Purpose

The presence service supports ephemeral coordination such as:

- typing indicators;
- read receipts.

The backend relays opaque encrypted envelopes and does not interpret the event meaning.

## Endpoints

```text
POST /presence/publish
POST /presence/poll
```

## Publish payload

The server expects:

```text
channelId
eventId
iv
ciphertext
ttlMs
```

Validation includes:

- 64-character lowercase hex channel ID;
- bounded event ID;
- bounded IV/ciphertext size;
- finite TTL.

## Storage model

The current implementation uses an in-memory map:

```ts
const channels = new Map<string, PresenceRecord[]>();
```

Stored record:

```text
eventId
iv
ciphertext
createdAt
expiresAt
```

## Limits

Current constraints:

```text
minimum TTL         1 second
maximum TTL         24 hours
max events/channel  120
```

Expired records are removed during channel access.

## Privacy boundary

The backend does not need:

```text
room key
pairwise key
wallet address
typing plaintext
read plaintext
```

## Mainnet operational limitation

The current in-memory design means:

- events disappear after process restart/redeploy;
- events are not shared across multiple backend replicas;
- horizontal scaling can produce inconsistent polling results.

This can be acceptable for strictly ephemeral optional presence on a single instance, but multi-instance production should use an ephemeral shared store such as Redis with TTL semantics.

Presence must never be migrated to a store that requires server-side decryption.
