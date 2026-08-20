# VinssInvite

## Source

```text
contracts/src/invite/vinss_invite.cairo
```

Supporting modules:

```text
invite_interfaces.cairo
invite_types.cairo
invite_events.cairo
```

## Objective

`VinssInvite` gives VINSS a one-time, expiring on-chain commitment state for Deal Room invitation bootstrap without storing the full encrypted Invite payload.

## Authorization

Only the configured Privacy Pool may call `privacy_invoke`.

## Commitment

```cairo
Poseidon(
    'VINSS_INVITE_V1',
    secret,
)
```

## Operations

### Create

```text
[0, commitment, expires_at]
```

Validation:

- exact calldata length;
- non-zero commitment;
- non-zero expiry;
- expiry must be in the future;
- commitment must not already exist.

Stored state:

```text
expires_at
consumed = false
exists = true
```

Event:

```text
InviteCreated(commitment, expires_at)
```

### Consume

```text
[1, secret]
```

The contract recomputes the commitment from the secret.

Validation:

- exact calldata length;
- non-zero secret;
- matching Invite exists;
- Invite has not already been consumed;
- current timestamp is not after expiry.

State becomes:

```text
consumed = true
```

Event:

```text
InviteConsumed(commitment)
```

## No OpenNoteDeposit output

Both operations return an empty `OpenNoteDeposit` span.

The current frontend pairs Invite invocation with its own STRK20 withdrawal action for transaction-level private-note consumption/replay behavior.

That accompanying withdrawal is not an Invite-contract output.

## Public data

Public:

```text
commitment
expiry
consumed state
create/consume events
consume secret after it is submitted
```

Not stored here:

```text
room secret
room label
group secret
group metadata
full encrypted Invite payload
Invite AES key
```

## Current test coverage

Cairo tests currently cover:

- constructor Privacy Pool storage;
- create state;
- no output deposit;
- successful consume;
- duplicate create rejection;
- double-consume rejection;
- unknown secret rejection;
- expired create rejection;
- expired consume rejection;
- non-Privacy-Pool caller rejection.

This proves contract-level behavior, not complete wallet/browser E2E behavior.
