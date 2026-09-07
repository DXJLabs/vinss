# VINSS Smart Contracts

Cairo smart contracts for the VINSS private Deal Room on Starknet.

The contract layer enforces on-chain authorization, public state, fee policy, custody, settlement transitions, events, and Settlement Certificate eligibility.

Privacy-enabled application actions are submitted through the configured STRK20 Privacy Pool where the corresponding contract exposes `privacy_invoke`. Other contract interactions, such as fee-policy reads, dispute-resolver authorization, objective verification, and Settlement Certificate claims, have their own explicit execution boundaries.

---

## Contracts

| Contract | Purpose |
| --- | --- |
| `VinssFeePolicy` | Shared oracle-backed fee-floor and sponsor-cost policy |
| `VinssInvite` | One-time expiring Invite commitment with fee-bearing creation |
| `VinssMessageHelper` | Stores encrypted Message envelopes and returns the configured revenue note |
| `VinssOfferHelper` | Stores encrypted Offer action envelopes and returns the configured revenue note |
| `VinssPrivateEscrowHelper` | Stores encrypted Rekber coordination actions and never custodies principal |
| `VinssEscrowRekber` | Canonical STRK/USDC custody, fulfillment, review, refund, dispute, resolution, claim, and settlement contract |
| `VinssSettlementCertificate` | Claimable non-transferable ERC-721 settlement credential for eligible successful Rekber settlements |

`VinssMessageHelper`, `VinssOfferHelper`, and `VinssPrivateEscrowHelper` persist ciphertext together with opaque routing and commitment metadata. They do not decrypt private business semantics.

`VinssEscrowRekber` is different: custody amount, token, deadlines, policy class, commitments, dispute state, resolution amounts, and settlement state are public on-chain state.

`VinssSettlementCertificate` verifies canonical Rekber settlement state before mint and is non-transferable after issuance.

---

## Source structure

```text
contracts/
├── src/
│   ├── escrow_rekber/
│   │   ├── commitments.cairo
│   │   ├── errors.cairo
│   │   ├── events.cairo
│   │   ├── interfaces.cairo
│   │   ├── types.cairo
│   │   └── vinss_escrow_rekber.cairo
│   │
│   ├── fee_policy/
│   │   ├── interfaces.cairo
│   │   ├── types.cairo
│   │   └── vinss_fee_policy.cairo
│   │
│   ├── interfaces/
│   │   └── privacy_pool_types.cairo
│   │
│   ├── invite/
│   │   ├── invite_events.cairo
│   │   ├── invite_interfaces.cairo
│   │   ├── invite_types.cairo
│   │   └── vinss_invite.cairo
│   │
│   ├── messaging/
│   │   ├── messaging_events.cairo
│   │   ├── messaging_interfaces.cairo
│   │   ├── messaging_types.cairo
│   │   ├── messaging_validation.cairo
│   │   ├── timeline_payload_hash.cairo
│   │   └── vinss_message_helper.cairo
│   │
│   ├── offers/
│   │   ├── offer_commitments.cairo
│   │   ├── offer_events.cairo
│   │   ├── offer_interfaces.cairo
│   │   ├── offer_types.cairo
│   │   ├── offer_validation.cairo
│   │   └── vinss_offer.cairo
│   │
│   ├── private_escrow/
│   │   ├── private_escrow_commitments.cairo
│   │   ├── private_escrow_events.cairo
│   │   ├── private_escrow_interfaces.cairo
│   │   ├── private_escrow_types.cairo
│   │   ├── private_escrow_validation.cairo
│   │   └── vinss_private_escrow_helper.cairo
│   │
│   ├── settlement_certificate/
│   │   ├── commitments.cairo
│   │   ├── events.cairo
│   │   ├── interfaces.cairo
│   │   ├── types.cairo
│   │   └── vinss_settlement_certificate.cairo
│   │
│   ├── test_mocks/
│   │   ├── mock_erc20.cairo
│   │   ├── mock_fee_policy.cairo
│   │   └── mock_pragma.cairo
│   │
│   ├── tests/
│   │   ├── test_vinss_escrow_rekber.cairo
│   │   ├── test_vinss_fee_policy.cairo
│   │   ├── test_vinss_invite.cairo
│   │   ├── test_vinss_message_helper.cairo
│   │   ├── test_vinss_offer_helper.cairo
│   │   ├── test_vinss_private_escrow_helper.cairo
│   │   └── test_vinss_settlement_certificate.cairo
│   │
│   ├── utils/
│   │   ├── constants.cairo
│   │   ├── errors.cairo
│   │   ├── hashing.cairo
│   │   ├── time.cairo
│   │   └── validation.cairo
│   │
│   ├── lib.cairo
│   └── tests.cairo
│
├── Scarb.lock
├── Scarb.toml
└── README.md
```

Generated build output such as `target/` is intentionally omitted.

---

## Source boundaries

```text
src/fee_policy/
    oracle-backed VINSS fee floors and sponsor-cost protection

src/messaging/
    encrypted Message commitment and event layer

src/offers/
    encrypted structured Offer action commitment layer

src/private_escrow/
    encrypted Rekber coordination layer; never principal custody

src/escrow_rekber/
    canonical custody and settlement state machine

src/settlement_certificate/
    successful-settlement credential and Rekber-state verification

src/invite/
    one-time expiring Invite commitments

src/interfaces/
    shared external contract types

src/utils/
    shared constants, errors, hashing, time, and validation

src/tests/
    contract behavior and invariant tests

src/test_mocks/
    ERC-20, FeePolicy, and Pragma test doubles
```

---

## Fee model

VINSS contract fees are not fixed frontend constants.

`VinssFeePolicy` exposes action-based quotes for:

```text
Room activation
Message
Offer
Rekber lifecycle reserve
```

The FeePolicy quote compares an oracle-backed public USD floor with a configured sponsor-cost floor and uses the larger value.

Current public USD floors in contract source are:

```text
Room activation   $0.25
Message           $0.15
Offer             $0.25
Rekber minimum    $0.75
```

These are floors, not guaranteed final STRK charges. The resulting STRK quote can be higher when the configured sponsor-cost floor is higher.

Rekber funding uses a separate principal-aware calculation:

```text
Rekber fee =
max(
  2% of principal,
  token-denominated value of
    max(
      configured Rekber minimum USD,
      FeePolicy Rekber lifecycle reserve USD
    )
)
```

The funding quote supplied at execution must match the contract-computed quote.

Application-level bundled transaction charges must not be described as contract-enforced fees unless the corresponding rule is checked by Cairo code.

---

## Rekber

`VinssEscrowRekber` is the single canonical principal-custody contract.

It covers:

- funding;
- fulfillment submission;
- fulfillment review and revision;
- normal release;
- eligible timeout refund;
- dispute activation;
- dispute resolution authorization;
- payer/payee authorized-share claims;
- final settlement state.

Private business terms and private evidence are not stored as plaintext by Rekber. Public contract state contains the information required to enforce custody and settlement correctness.

Core settlement invariants include:

```text
settlement distribution <= funded principal
payer resolution share + payee resolution share = custody principal
final settlement paths are mutually exclusive
resolver cannot redirect custody principal to itself
```

The removed legacy unilateral-release implementation is not part of the compiled contract tree.

---

## Settlement Certificate

`VinssSettlementCertificate` is an ERC-721-compatible, non-transferable settlement credential.

A certificate is claimable only after the required successful canonical Rekber release state is satisfied.

After mint, transfer and burn paths are rejected by the certificate contract.

Certificate claiming is performed by the eligible wallet; the backend indexer does not mint certificates on behalf of users.

---

## Build and test

```bash
cd ~/vinss/contracts
scarb build
snforge test
```

The same test command is also exposed through Scarb:

```bash
scarb run test
```

Current Cairo test modules cover:

- FeePolicy;
- Invite;
- Message Helper;
- Offer Helper;
- Private Escrow Helper;
- Escrow Rekber;
- Settlement Certificate.

---

## Toolchain

The current contract package uses:

```text
Cairo / Starknet   2.17.0
OpenZeppelin       3.0.0
snforge_std        0.56.0
```

The Pragma dependency is pinned to the exact revision declared in `Scarb.toml`.

---

## Technical documentation

Detailed contract architecture, FeePolicy behavior, privacy boundaries, contract-specific flows, Rekber invariants, Settlement Certificate behavior, deployment, and verification status are documented under:

**[`../docs/technical/smart-contracts/README.md`](../docs/technical/smart-contracts/README.md)**

The executable Cairo source and tests remain the source of truth.
