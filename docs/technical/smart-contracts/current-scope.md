# Current Smart Contract Scope

This page separates source availability, Cairo coverage, and deployed product evidence.

| Contract/capability | Source | Cairo tests | Current deployment status |
|---|---:|---:|---|
| `VinssInvite` | ✅ | ✅ | Existing deployment |
| `VinssMessageHelper` · 7 STRK | ✅ | ✅ | Redeploy + E2E pending |
| `VinssOfferHelper` · 10 STRK | ✅ | ✅ | Redeploy + E2E pending |
| `VinssPrivateEscrowHelper` | ✅ | ✅ | Existing deployment |
| `VinssEscrowRekber` · 2% | ✅ | ✅ deposit/release/refund | Canonical redeploy + E2E pending |
| `VinssSettlementCertificate` | ✅ | ✅ | Redeploy after Rekber + E2E pending |
| Mainnet evidence | — | — | Pending |

## Canonical Rekber

Only the two-party authorization implementation remains in source. It provides:

```text
full-principal custody
2% fee at funding
payer authorization + payee claim release
payer timeout refund
one-time custody consumption
private output-note settlement
optional public certificate claims
```

The legacy unilateral-release contract, fallback frontend calls, and legacy indexer selectors have been removed.

## Verification boundary

Passing Cairo tests proves contract behavior in Starknet Foundry. It does not prove Ready X request construction, Privacy Pool execution, production environment addresses, or two-user testnet outcomes.

Do not describe Rekber as mainnet-ready or E2E-verified until the canonical Rekber and Settlement Certificate are redeployed and both release/refund branches are recorded on Sepolia.
