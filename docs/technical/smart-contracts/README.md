# VINSS Smart Contract Technical Reference

This directory documents the Cairo contracts exported by `contracts/src/lib.cairo` and the application boundaries that must remain synchronized with the VINSS frontend, STRK20 Privacy Pool integration, indexer, and deployment workflows.

Executable Cairo source and tests are the source of truth. This documentation does not replace ABI inspection, deployment artifacts, or network verification.

## Contract inventory

| Contract | Role |
|---|---|
| `VinssFeePolicy` | Shared oracle-backed application fee floor and sponsor-cost policy |
| `VinssInvite` | One-time expiring Invite commitment with fee-bearing creation |
| `VinssMessageHelper` | Stores encrypted Message V2 envelopes and returns a revenue `OpenNoteDeposit` |
| `VinssOfferHelper` | Stores encrypted Offer V2 actions and returns a revenue `OpenNoteDeposit` |
| `VinssPrivateEscrowHelper` | Stores encrypted Rekber coordination actions; never custodies principal |
| `VinssEscrowRekber` | STRK/USDC custody, fulfillment, review, revision, refund, dispute, resolution, and settlement |
| `VinssSettlementCertificate` | Claimable non-transferable ERC-721 credential for clean successful settlements |

## Execution layers

```text
VINSS frontend
    |
    v
privacy-enabled wallet / Ready X
    |
    v
STRK20 Privacy Pool
    |
    +--> VinssInvite
    +--> VinssMessageHelper
    +--> VinssOfferHelper
    +--> VinssPrivateEscrowHelper
    +--> VinssEscrowRekber

Pragma
    +--> VinssFeePolicy
    +--> VinssEscrowRekber

VinssFeePolicy
    +--> Invite / Message / Offer fee floors
    +--> Rekber lifecycle reserve floor

Dedicated dispute resolver
    +--> VinssEscrowRekber.authorize_dispute_resolution()

Optional objective verifier
    +--> VinssEscrowRekber.confirm_external_fulfillment()

Wallet
    +--> VinssSettlementCertificate.claim()
            |
            v
       canonical Rekber state
```

All current `privacy_invoke` contracts restrict that entrypoint to the configured Privacy Pool. That is an invocation boundary, not proof that the contract knows a plaintext participant identity.

## Important technical boundaries

Encrypted Message, Offer, and Private Escrow helpers store public ciphertext plus opaque routing metadata. They do not decrypt business semantics.

`VinssEscrowRekber` is intentionally not ciphertext-only. Token, principal, fee, deadlines, policy, commitments, evidence commitments, dispute state, and resolution amounts are public contract state.

The dispute resolver can authorize only an exact payer/payee split whose sum equals the custody principal. It cannot redirect principal to itself. Each party must later claim its own authorized share using a capability committed at funding.

`VinssSettlementCertificate` is an ERC-721-compatible credential whose ownership is soulbound after mint. The ERC-721 hook permits only the initial zero-owner-to-recipient update; later transfer or burn attempts revert with `CERT_NON_TRANSFERABLE`.

## Fee model

`VinssFeePolicy` is the shared source for Room activation, Message, Offer, and Rekber reserve floors. Quotes are oracle-backed and compare a public USD floor against a sponsor-cost floor.

Rekber funding is different from a flat helper fee:

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

The funding quote must match exactly at execution.

Current frontend workflow charges such as a 3 STRK Rekber action charge are application transaction-bundle behavior; they are not an invariant enforced by `VinssEscrowRekber` itself.

## Read in this order

1. [Architecture](./architecture.md)
2. [Fee Policy](./fee-policy.md)
3. [Privacy & Trust Boundary](./privacy-boundary.md)
4. [Invite](./invite.md)
5. [Message Helper](./message-helper.md)
6. [Offer Helper](./offer-helper.md)
7. [Private Escrow Helper](./private-escrow-helper.md)
8. [Escrow Rekber](./escrow-rekber.md)
9. [Settlement Certificate](./settlement-certificate.md)
10. [Envelopes, Commitments & Events](./envelopes-events.md)
11. [Frontend Compatibility](./frontend-compatibility.md)
12. [Testing](./testing.md)
13. [Current Scope](./current-scope.md)

## Evidence labels

These are different claims and must not be conflated:

```text
implemented source
Cairo build success
Starknet Foundry test success
testnet deployment
testnet wallet E2E
mainnet deployment
Voyager source verification
mainnet product E2E
```

A passing unit test does not prove a Ready X request shape, Privacy Pool proof, deployment configuration, or production E2E outcome.
