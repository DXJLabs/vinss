# Current Smart Contract Scope

This page separates existing Cairo modules, contract-level tests, product-level verification, and pending settlement work.

## Status

| Contract/capability | Contract code | Cairo tests | Product/E2E status |
|---|---:|---:|---|
| `VinssInvite` | ✅ | ✅ | Implemented/frontend-integrated |
| `VinssMessageHelper` | ✅ | ✅ | ✅ Testnet on-chain verified |
| `VinssOfferHelper` | ✅ | ✅ | ✅ Testnet on-chain verified |
| `VinssPrivateEscrowHelper` | ✅ | ✅ | 🟡 Escrow integration stage |
| `VinssEscrowRekber` deposit | ✅ | ✅ deposit invariant | 🟡 E2E pending |
| `VinssEscrowRekber` release/refund | ✅ | ⚠️ dedicated coverage incomplete | 🔴 current frontend commitment mismatch |
| Settlement Evidence contract | — | — | Pending |
| NFT Settlement Certificate contract | — | — | Pending |
| Mainnet contract evidence | — | — | Pending |

## Message Helper

```text
encrypted V2 envelope
opaque routing tags
ciphertext storage
commitment validation
one-time locator/commitment guards
Privacy-Pool-only invocation
7 STRK application revenue output
```

## Offer Helper

```text
encrypted V2 action envelope
opaque routing tags
ciphertext storage
commitment validation
one-time locator/commitment guards
Privacy-Pool-only invocation
10 STRK application revenue output
```

## Private Escrow Helper

```text
encrypted V2 coordination envelope
opaque routing tags
ciphertext discovery
no ERC-20 custody
no output OpenNoteDeposit
```

## Invite

```text
commitment create
expiry
one-time consume
Privacy-Pool-only invocation
no Invite payload storage
```

## Escrow Rekber

Implemented contract mechanics:

```text
deposit principal + 2% fee
reserve full principal
release before refund boundary
refund at/after boundary
one-time custody consumption
private output note return
```

Current verification limitation:

```text
deposit-side Cairo test exists
release/refund dedicated tests incomplete
frontend/Cairo release-refund commitment formula aligned; E2E pending
E2E settlement evidence pending
```

## Not claimed

Do not describe the current contracts as:

```text
fully private settlement
metadata-free
mainnet verified
production audited
Escrow Rekber E2E verified
Settlement Certificate implemented
```

## Source consistency issue

Some Private Escrow source comments in the Cairo/frontend integration still describe an older shorter envelope header.

Executable code/tests use the V2 six-field routing-tag layout.

This is documentation debt in source comments, not a different runtime layout.
