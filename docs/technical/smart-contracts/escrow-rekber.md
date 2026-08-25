# VinssEscrowRekber

## Source

```text
contracts/src/escrow_rekber/
├── commitments.cairo
├── errors.cairo
├── events.cairo
├── interfaces.cairo
├── types.cairo
└── vinss_escrow_rekber.cairo
```

`VinssEscrowRekber` is the supported ERC-20 custody contract and requires independent payer authorization and payee claim secrets.

## Status

Implemented and Cairo-tested. A fresh Sepolia deployment and two-wallet release/refund E2E evidence are still required.

## Write authority

Only the configured STRK20 Privacy Pool may call `privacy_invoke`. The contract uses a reentrancy guard and tracks reserved principal per token.

## Actions

```text
1 = DEPOSIT
2 = RELEASE
3 = REFUND
```

## Deposit

```text
[
  1,
  custody_commitment,
  release_authorization_commitment,
  payee_claim_commitment,
  refund_commitment,
  payer_certificate_commitment,
  payee_certificate_commitment,
  refund_after,
  token,
  principal,
  revenue_open_note_id
]
```

The contract requires unique non-zero commitments, a future refund boundary, sufficient token balance, and zero stale Pool allowance.

VINSS charges 2% at funding:

```text
fee = principal / 50
wallet input = principal + fee
reserved custody = full principal
```

The returned `OpenNoteDeposit` routes only the fee. Principal remains reserved for release or refund.

## Release

Release is valid only before `refund_after` and requires both parties' independent preimages:

```text
[
  2,
  custody_commitment,
  release_authorization_secret,
  payee_claim_secret,
  output_note_id
]
```

Commitments use the domains:

```text
VINSS_RELEASE_AUTH
VINSS_PAYEE_CLAIM
```

The full principal is returned to the wallet-created private output note.

## Refund

Refund is valid at or after `refund_after` and requires the payer's refund preimage:

```text
[
  3,
  custody_commitment,
  refund_secret,
  output_note_id
]
```

The commitment domain is `VINSS_ESCROW_REFUND`. A released or refunded custody cannot be consumed again.

## Public state

`EscrowRekberCustody` exposes commitments, token, amount, refund boundary, creation/settlement timestamps, and consumed/refunded flags. Participant addresses and plaintext deal terms are not stored by this contract.

## Events

```text
EscrowRekberCustodyFunded
EscrowRekberCustodyReleased
EscrowRekberCustodyRefunded
```

## Settlement Certificate

Each custody includes payer and payee certificate commitments. After a successful release, each wallet may independently claim one public `VinssSettlementCertificate`. Refunded custody cannot mint a success certificate.

## Cairo coverage

Dedicated tests cover:

- full-principal reservation and 2% fee output;
- two-secret release and full-principal output;
- payer/payee secret separation;
- successful timeout refund;
- early-refund rejection;
- replay rejection after release;
- certificate claim timing, ownership binding, refund rejection, and replay rejection.

Cairo tests do not replace wallet, Privacy Pool, browser, or two-user testnet E2E verification.
