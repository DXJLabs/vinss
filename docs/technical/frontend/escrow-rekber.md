# Escrow Rekber

## Status

The canonical frontend flow is implemented. Cairo tests pass, while a fresh Sepolia deployment and two-wallet release/refund E2E run remain required.

## Source boundary

```text
frontend/lib/deal-room/escrow.ts
  encrypted coordination and accepted-Offer mapping

frontend/lib/deal-room/settlement.ts
  custody, release, refund, proofs, and certificates
```

There is no legacy custody fallback and no separate `V2` address. The only frontend contract variable is:

```text
NEXT_PUBLIC_ESCROW_REKBER_ADDRESS
```

## Coordination

The payer and payee exchange encrypted Rekber setup/acceptance payloads. Each wallet signs the exact private Offer terms with SNIP-12 before funding is enabled.

The payer owns:

```text
release authorization secret
refund secret
payer certificate secret
```

The payee owns:

```text
payee claim secret
payee certificate secret
```

Secrets are stored only in the encrypted local Rekber cache and encrypted direct coordination payloads.

## Funding

The payer funds only after both signatures and all commitments match the accepted Offer.

```text
principal = accepted Offer amount in token base units
fee       = principal / 50
withdraw  = principal + fee
```

Deposit submits the two release commitments, refund commitment, both certificate commitments, refund boundary, token, principal, and revenue open-note placeholder.

## Release

The payer sends the release-authorization preimage through encrypted coordination. The payee combines it with the locally held claim preimage. The contract requires both before returning principal to the payee's wallet-created private output note.

## Refund

At or after the refund boundary, the payer can return principal to a wallet-created private output note using the locally held refund preimage. Early refund and replay are rejected by the contract.

## Settlement Certificate

After a successful release, each party may separately claim an optional public ERC-721 certificate. Certificate ownership is public; certificate secrets and private Offer terms are not included in metadata.

## Privacy boundary

Private:

- Offer/deal semantics;
- participant coordination;
- unused settlement and certificate secrets.

Public:

- token and principal amount;
- refund boundary;
- commitments and custody state;
- used settlement preimages in transaction calldata;
- optional certificate ownership.

## Verification gate

Do not mark Rekber E2E-verified until one two-wallet Sepolia run records both branches:

```text
accepted Offer → signed setup → funding → release → certificate
accepted Offer → signed setup → funding → timeout refund
```
