# Current Smart Contract Scope

This page describes the current contract capabilities implemented on `main`.

Network addresses are intentionally not duplicated here because deployment addresses can change. Deployment workflow outputs, verified deployment records, and runtime environment configuration are the authoritative sources for deployed addresses.

## Source and Test Scope

| Contract | Current source capability | Contract test suite |
|---|---|---:|
| `VinssFeePolicy` | Oracle-backed USD fee floors combined with sponsor-cost floors | Included |
| `VinssInvite` | Fee-bearing Invite creation and one-time consumption | Included |
| `VinssMessageHelper` | Encrypted Message envelopes with FeePolicy-driven revenue | Included |
| `VinssOfferHelper` | Encrypted Offer action envelopes with FeePolicy-driven revenue | Included |
| `VinssPrivateEscrowHelper` | Encrypted Rekber coordination envelopes without principal custody | Included |
| `VinssEscrowRekber` | Funding, fulfillment, review, revision, refund, dispute, resolver authorization, participant claims, and settlement | Included |
| `VinssSettlementCertificate` | Clean-settlement claim and non-transferable ERC-721 ownership | Included |

The current encrypted Message, Offer, and Private Escrow envelope format uses version `2`. This is an envelope-format version and is not a contract-version suffix.

The dedicated `VINSS Contracts Test` workflow runs `scarb build` followed by the full `snforge test` suite. The table above therefore means the contract is included in the repository test suite; it does not claim line or branch coverage.

Settlement Certificate tests include clean-release claims, rejection of refunded/disputed settlements, and rejection of post-mint ERC-721 transfer and safe-transfer operations.

## Canonical Rekber Scope

Current `VinssEscrowRekber` source includes:

```text
STRK/USDC principal custody
2% principal fee component
oracle-backed minimum fee floor
FeePolicy-backed Rekber lifecycle reserve floor
exact funding quote validation

fulfillment deadline
three verification policies
bounded fulfillment rounds
bounded revision rounds
review deadlines
revision deadlines

payer/payee dispute capabilities
immutable dispute resolver
optional immutable external verifier
exact payer/payee resolution split
independent participant resolution claims

clean mutual release
review-timeout auto-release
no-fulfillment timeout refund
mutual refund

reserved-principal accounting
reentrancy guard
exact output allowance discipline
```

The three public verification policies are:

| Policy | Constant | Current behavior |
|---|---|---|
| `1` | `POLICY_SUBMISSION_REVIEW` | Fulfillment submission starts review immediately |
| `2` | `POLICY_COUNTERPARTY_CONFIRM` | Payer confirmation is required before review starts |
| `3` | `POLICY_EXTERNAL_VERIFY` | Configured external verifier confirms submitted evidence before review starts |

Only `POLICY_SUBMISSION_REVIEW` supports the bounded revision workflow.

The dispute resolver does not receive principal. It may authorize only a payer/payee allocation whose total equals the custody principal. Each authorized participant later claims its own share through the Privacy Pool using its precommitted capability.

## Certificate Scope

Current `VinssSettlementCertificate` source enforces:

```text
clean successful settlement only
payer/payee role-specific claim
recipient-bound claim commitment
one claim per custody/role
deterministic token ID
ERC-721 ownership and metadata compatibility
post-mint transfer rejection
post-mint safe-transfer rejection
post-mint burn/ownership-update rejection
```

Certificate eligibility requires canonical Rekber custody state satisfying:

```text
custody.consumed == true
custody.refunded == false
custody.disputed == false
```

The claim commitment also binds:

```text
custody commitment
role
recipient
secret
```

The ERC-721 ownership hook permits only the initial mint transition from the zero address to the recipient. Any later ownership update, including transfer or burn, reverts with `CERT_NON_TRANSFERABLE`.

Older certificate deployments created from a class that predates this non-transferability hook do not inherit the new behavior automatically. A new class declaration/deployment is required for the updated implementation.

## Mainnet Evidence Boundary

Mainnet deployment is a separate evidence layer from source implementation and local/CI tests.

A contract should not be described as successfully production-deployed until the relevant evidence exists for that deployment:

```text
mainnet safety validation passed
dedicated contract CI gate accepted
Starknet Mainnet RPC verified
declaration/deployment transaction succeeded
expected constructor configuration confirmed
class hash and contract address recorded
Voyager source verification succeeded
runtime environment cut over intentionally
required product E2E checks passed
```

The current Mainnet workflow:

- accepts only explicit `workflow_dispatch` execution;
- restricts deployment operations to `main`;
- verifies the RPC chain ID is Starknet Mainnet;
- requires a successful dedicated `VINSS Contracts Test` whose `contracts/` content matches the deployment source;
- validates required constructor/configuration inputs;
- performs deployment fee estimation before transaction submission;
- submits source verification to Voyager after a successful deployment, or through `verify-only` mode.

A successful declaration or deployment transaction alone is therefore not equivalent to verified production readiness.

## Product and Runtime Boundary

The Cairo contracts do not by themselves prove:

```text
frontend UI state correctness
frontend ABI/calldata compatibility
Ready X account/channel availability
STRK20 proof success
paymaster behavior
private treasury recipient/channel context
backend dispute-resolver automation
backend indexer synchronization
ciphertext discovery/decryption correctness
browser local-secret persistence or recovery
full product E2E
```

Those properties must be validated in their own frontend, wallet, Privacy Pool, paymaster, backend, indexer, and product E2E layers.

## Evidence Interpretation

These claims are intentionally separate:

```text
implemented in source
build succeeds
contract tests pass
testnet deployed
testnet wallet E2E passes
mainnet deployed
Voyager source verified
mainnet product E2E passes
```

Evidence from one layer must not be used as proof of a later layer.
