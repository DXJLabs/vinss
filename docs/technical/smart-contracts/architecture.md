# Smart Contract Architecture

## Module map

```text
contracts/src/
├── fee_policy/
│   └── VinssFeePolicy
├── invite/
│   └── VinssInvite
├── messaging/
│   └── VinssMessageHelper
├── offers/
│   └── VinssOfferHelper
├── private_escrow/
│   └── VinssPrivateEscrowHelper
├── escrow_rekber/
│   └── VinssEscrowRekber
└── settlement_certificate/
    └── VinssSettlementCertificate
```

All modules are exported by `contracts/src/lib.cairo`.

## Trust and authority graph

| Component | Authority |
|---|---|
| Privacy Pool | Sole caller accepted by current `privacy_invoke` entrypoints |
| Pricing admin | May update only `sponsor_cost_strk_wei` in `VinssFeePolicy` |
| Pragma | Supplies price data consumed by FeePolicy and Rekber |
| Dispute resolver | May authorize an exact split only after a Rekber dispute |
| External verifier | Optional; may confirm a matching fulfillment evidence commitment for policy `3` |
| Settlement participant | Claims its own certificate and/or authorized settlement output using precommitted capabilities |

The Rekber constructor fixes Privacy Pool, Pragma, FeePolicy, resolver, optional verifier, supported token addresses, pair IDs, minimum fee, oracle age, and minimum oracle sources. There is no administrative setter for those Rekber trust/configuration fields.

## Encrypted coordination family

`VinssMessageHelper`, `VinssOfferHelper`, and `VinssPrivateEscrowHelper` use the same six-field public envelope header:

```text
[0] envelope_version
[1] one-time action locator
[2] opaque sender tag
[3] opaque recipient tag
[4] claimed payload commitment
[5] ciphertext chunk count
[6...] ciphertext chunks
```

Message and Offer append fee/output fields outside the committed encrypted envelope. Private Escrow coordination does not.

Storage follows the same general structure:

```text
locator -> structural record
(locator, chunk_index) -> ciphertext felt
locator -> existence marker
payload commitment -> reuse marker
```

The locator is one-action-only metadata. It is not a room ID, wallet ID, participant ID, deal ID, or custody ID.

## Invite architecture

Invite uses a one-time preimage commitment rather than a ciphertext envelope:

```text
secret
  |
  v
Poseidon('VINSS_INVITE_V1', secret)
  |
  v
commitment -> { expires_at, consumed, exists }
```

Create is fee-bearing. Consume reveals the one-time secret in public calldata and atomically marks the commitment consumed.

## Rekber architecture

Rekber separates encrypted coordination from public custody.

```text
Private Escrow Helper
    = encrypted coordination/discovery

VinssEscrowRekber
    = principal custody and enforceable settlement state
```

The custody lifecycle contains:

```text
fund
  |
  +--> no fulfillment before deadline --> payer timeout refund
  |
  v
submit fulfillment
  |
  +--> policy 1: review starts immediately
  +--> policy 2: payer confirms receipt, then review starts
  +--> policy 3: external verifier confirms matching evidence, then review starts
  |
  +--> request revision (policy 1 only, bounded rounds)
  |       |
  |       +--> resubmit fulfillment
  |
  +--> mutual release
  +--> auto-release after review deadline
  +--> mutual refund
  +--> dispute
          |
          v
   resolver authorizes exact split
          |
          +--> payer claims payer share
          +--> payee claims payee share
```

The resolver authorization does not transfer funds. Principal leaves only through a Privacy Pool output path.

## Accounting boundary

Rekber tracks `reserved_by_token`. Principal is reserved independently from the service fee.

At funding:

```text
contract token balance
    >= existing reserved principal
     + new principal
     + required fee
```

Only principal increases `reserved_by_token`. The fee is approved for the Privacy Pool revenue output.

Settlement decrements reserve before exposing the exact output allowance. OpenZeppelin `ReentrancyGuardComponent` covers every external state-changing Rekber path that touches custody accounting or ERC-20 allowance.

## Settlement Certificate architecture

The certificate reads canonical Rekber custody state directly.

A claim is allowed only when:

```text
custody.consumed == true
custody.refunded == false
custody.disputed == false
claim for (custody, role) not already used
claim commitment matches caller + role + secret
```

After mint, the ERC-721 `before_update` hook rejects every ownership update. This makes the credential non-transferable while retaining standard ERC-721 ownership/metadata interfaces.

## Replay and uniqueness boundaries

Encrypted helpers reject reused locators and reused encrypted payload commitments.

Invite rejects duplicate creation and repeated consumption.

Rekber rejects duplicate custody commitments, bounded secret-chain misuse, repeated terminal settlement, and repeated resolution claims.

Certificate rejects a second claim for the same `(custody_commitment, role)`.

These application rules do not replace Privacy Pool protocol replay protection.
