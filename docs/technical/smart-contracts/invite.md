# VinssInvite

## Source

```text
contracts/src/invite/vinss_invite.cairo
```

## Purpose

`VinssInvite` stores an expiring, one-time Invite commitment without storing the full Invite payload or room secret.

Only the configured Privacy Pool may call `privacy_invoke`.

## Constructor

```text
privacy_pool: ContractAddress
open_note_token: ContractAddress
fee_policy: ContractAddress
```

All three addresses must be non-zero.

## Commitment

```text
Poseidon(
  'VINSS_INVITE_V1',
  secret
)
```

## Operation `0` — create

Calldata:

```text
[0,
 commitment,
 expires_at,
 quoted_fee,
 open_note_id]
```

Validation:

```text
quoted_fee >= FeePolicy.quote_fee(FEE_ACTION_ROOM_ACTIVATION)
commitment != 0
expires_at != 0
expires_at > block timestamp
commitment does not already exist
```

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

The contract approves the configured Privacy Pool for `quoted_fee` of `open_note_token` and returns:

```text
OpenNoteDeposit {
  note_id: open_note_id,
  token: open_note_token,
  amount: quoted_fee
}
```

Therefore Invite creation is fee-bearing in the current executable contract.

## Operation `1` — consume

Calldata:

```text
[1, secret]
```

The contract recomputes the commitment and requires:

```text
secret != 0
Invite exists
Invite is not consumed
block timestamp <= expires_at
```

It then writes:

```text
consumed = true
```

and emits:

```text
InviteConsumed(commitment)
```

Consume returns an empty `OpenNoteDeposit` span.

## Privacy boundary

Public before consumption:

```text
commitment
expiry
exists/consumed state
InviteCreated event
```

Public after consumption additionally includes the one-time `secret` because transaction calldata is public.

Not stored by this contract:

```text
room secret
room label
participant identities
full encrypted Invite payload
client encryption keys
```

The consume secret is therefore a one-time authorization preimage, not a permanently hidden on-chain secret.

## Fee boundary

The contract accepts any `quoted_fee` greater than or equal to the current FeePolicy minimum. The returned revenue amount is exactly the wallet-supplied `quoted_fee`.
