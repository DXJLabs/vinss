# Current Smart Contract Scope

This page describes the current `main` source contract capabilities. Network addresses are intentionally not duplicated here because they become stale; deployment workflow outputs and environment configuration are the authoritative source for deployed addresses.

## Source and CI scope

| Contract | Current source capability | Cairo CI |
|---|---|---:|
| `VinssFeePolicy` | Oracle-backed USD/sponsor fee floors | Covered |
| `VinssInvite` | Fee-bearing create + one-time consume | Covered |
| `VinssMessageHelper` | Encrypted V2 Message + dynamic FeePolicy revenue | Covered |
| `VinssOfferHelper` | Encrypted V2 Offer action + dynamic FeePolicy revenue | Covered |
| `VinssPrivateEscrowHelper` | Encrypted V2 Rekber coordination | Covered |
| `VinssEscrowRekber` | Funding, fulfillment, review, revision, refund, dispute, resolver split, claims | Covered |
| `VinssSettlementCertificate` | Clean-settlement claim + non-transferable ERC-721 ownership | Covered |

The current Settlement Certificate SBT regression build has passed the `VINSS Contracts Test` workflow.

## Canonical Rekber scope

Current source includes:

```text
STRK/USDC principal custody
2% principal fee component
oracle-backed minimum fee floor
FeePolicy lifecycle reserve
exact funding quote validation

fulfillment deadline
three verification policies
bounded fulfillment rounds
bounded revision rounds
review deadlines

payer/payee dispute capabilities
immutable dispute resolver
exact payer/payee resolution split
independent participant claims

clean mutual release
review-timeout auto-release
no-fulfillment timeout refund
mutual refund

reserved-principal accounting
reentrancy guard
exact Privacy Pool allowance discipline
```

## Certificate scope

Current source enforces:

```text
clean successful settlement only
payer/payee role-specific claim
recipient-bound claim commitment
one claim per custody/role
deterministic token ID
ERC-721 metadata/ownership compatibility
post-mint transfer rejection
post-mint safe-transfer rejection
post-mint burn/ownership-update rejection
```

Older certificate deployments that predate the non-transferability hook do not inherit this behavior automatically. They require redeployment.

## Mainnet status boundary

Mainnet deployment is a separate evidence layer.

A contract should not be described as successfully deployed to mainnet until:

```text
mainnet safety validation passed
transaction succeeded
expected constructor values were confirmed
deployed class/address was recorded
Voyager source verification succeeded
runtime environment was cut over intentionally
required E2E checks passed
```

The mainnet deployment workflow treats Voyager verification as mandatory.

## Product/runtime boundary

The contracts do not prove:

```text
frontend UI state correctness
Ready X account/channel availability
private treasury recipient channel context
backend resolver automation
backend indexer synchronization
browser local-secret recovery
```

Those must be validated in their own integration/E2E layers.
