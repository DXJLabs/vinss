# VinssEscrowRekber

## Source

```text
contracts/src/escrow_rekber/vinss_escrow_rekber.cairo
```

Supporting modules:

```text
escrow_rekber_interfaces.cairo
escrow_rekber_types.cairo
escrow_rekber_commitments.cairo
escrow_rekber_events.cairo
escrow_rekber_errors.cairo
```

## Status

**Implemented / integration stage. End-to-end on-chain settlement verification is still pending.**

## Objective

`VinssEscrowRekber` is the actual ERC-20 custody and settlement layer for Escrow Rekber.

Unlike the encrypted coordination helpers, it intentionally stores public token/amount/timeout state needed by the current custody design.

## Privacy Pool authorization

Only the configured Privacy Pool may call `privacy_invoke`.

The contract also uses an OpenZeppelin reentrancy guard around action execution.

## Actions

```text
1 = DEPOSIT
2 = RELEASE
3 = REFUND
```

## Deposit

Calldata:

```text
[
  1,
  custody_commitment,
  release_commitment,
  refund_commitment,
  refund_after,
  token,
  principal,
  revenue_open_note_id
]
```

The contract validates:

- unique non-zero custody commitment;
- non-zero release/refund commitments;
- release commitment != refund commitment;
- non-zero token/principal/revenue note;
- future refund boundary;
- sufficient contract token balance;
- zero stale Pool allowance.

### Fee / principal invariant

Current fee:

```text
fee = principal / 100
    = 1%
```

Fee must be non-zero.

The wallet/pool path must place:

```text
principal + fee
```

into the contract balance.

The contract reserves **full principal** and returns the fee as one `OpenNoteDeposit`.

It does not deduct the fee from the principal custody amount.

## Release

Valid only while:

```text
now < refund_after
```

Calldata:

```text
[
  2,
  custody_commitment,
  release_secret,
  output_note_id
]
```

The contract checks:

```text
Poseidon(
  VINSS_ESCROW_RELEASE_V1,
  custody_commitment,
  release_secret
)
==
stored release_commitment
```

Then it consumes the custody and returns the full principal as an `OpenNoteDeposit` for `output_note_id`.

## Refund

Valid only while:

```text
now >= refund_after
```

Calldata:

```text
[
  3,
  custody_commitment,
  refund_secret,
  output_note_id
]
```

Validation:

```text
Poseidon(
  VINSS_ESCROW_REFUND_V1,
  custody_commitment,
  refund_secret
)
==
stored refund_commitment
```

It consumes the custody, marks `refunded = true`, and returns the full principal as an output note.

## One-time settlement

Both paths require:

```text
custody.consumed == false
```

Before approving output, the contract updates custody/reserve state and requires exact Pool allowance for the principal.

## Public custody state

`EscrowRekberCustody` exposes:

```text
custody_commitment
release_commitment
refund_commitment
token
amount
refund_after
consumed
refunded
created_at
settled_at
```

No buyer/seller address or plaintext Deal Room terms are stored.

## Events

```text
EscrowRekberCustodyFunded
EscrowRekberCustodyReleased
EscrowRekberCustodyRefunded
```

Funding event exposes token, amount, refund boundary, and timestamp.

Settlement events expose custody commitment, output note ID, and timestamp.

## Secret disclosure boundary

Release/refund secrets are client-held before use.

The selected secret becomes public when included in `privacy_invoke` calldata.

It must therefore be treated as a **one-time authorization preimage**, not permanent secret on-chain state.

## Current test coverage

Current dedicated Cairo test verifies the deposit-side invariant:

```text
principal remains intact
1% fee returned
principal reserve correct
Pool allowance equals fee
```

The current dedicated test file does **not** yet provide equivalent release/refund unit coverage.

Release/refund E2E behavior must not be claimed verified from this test alone.

## Current integration blocker

The contract commitment formula includes domain separators.

Current frontend release/refund commitment calculation now mirrors the Cairo domain-separated formulas.

The commitment formulas are now aligned; deployed release/refund evidence is still pending.
