# VINSS Smart Contract Technical Documentation

VINSS smart contracts are the **application-specific Cairo layer** invoked through the configured STRK20 Privacy Pool.

They do not replace the Privacy Pool. They define how VINSS persists encrypted coordination, enforces application-level commitments, manages one-time Invite state, and performs Escrow Rekber custody/settlement.

## Core contract capabilities

| Contract | Technical role | Current status |
|---|---|---|
| **VinssInvite** | One-time commitment-based Invite create/consume + expiry | Implemented + Cairo tested |
| **VinssMessageHelper** | Persist encrypted Message envelopes and return 7 STRK revenue OpenNoteDeposit | New fee build; redeploy + E2E pending |
| **VinssOfferHelper** | Persist immutable encrypted Offer actions and return 10 STRK revenue OpenNoteDeposit | New fee build; redeploy + E2E pending |
| **VinssPrivateEscrowHelper** | Persist encrypted Escrow Rekber coordination actions | Implemented + Cairo tested |
| **VinssEscrowRekber** | ERC-20 custody, 2% fee, two-party release, timeout refund | Canonical build; redeploy + E2E pending |
| **VinssSettlementCertificate** | Optional public ERC-721 evidence after successful release | Implemented + Cairo tested; redeploy pending |
| **Mainnet deployment/evidence** | Live STRK20 contract execution evidence | 🟡 Pending |

## Contract architecture

```text
VINSS frontend
    ↓ encrypted / commitment-based action
privacy-enabled wallet
    ↓
STRK20 Privacy Pool
    ↓ privacy_invoke
VINSS Cairo contract
```

The configured Privacy Pool is the write-authority boundary for every current VINSS `privacy_invoke` contract.

## Two contract families

### Encrypted coordination contracts

```text
VinssMessageHelper
VinssOfferHelper
VinssPrivateEscrowHelper
```

These contracts:

- receive public ciphertext envelopes;
- verify envelope structure and Poseidon commitment;
- enforce one-time locator/commitment rules;
- persist ciphertext for discovery;
- do not decrypt private application semantics.

### Commitment/state contracts

```text
VinssInvite
VinssEscrowRekber
VinssSettlementCertificate
```

`VinssInvite` stores a one-time Invite commitment with expiry/consumption state.

`VinssEscrowRekber` stores public custody commitments and ERC-20 settlement state. It is intentionally **not** a ciphertext-only contract because custody requires public token/amount state in the current implementation.

`VinssSettlementCertificate` reads canonical Rekber custody and allows each party to claim its own optional public certificate after release.

## Privacy boundary at a glance

```text
Encrypted coordination:
  plaintext semantics        → NOT stored
  ciphertext                 → public
  locator/tags/commitment    → public

Invite:
  encrypted Invite payload   → off-chain/client
  commitment/expiry/state    → public
  consume secret             → revealed when consumed

Escrow Rekber:
  deal conversation/terms    → NOT stored
  participant addresses      → NOT stored
  token/amount/refund time   → public
  commitments/state          → public
  release/refund preimage    → client-held before use,
                                revealed in settlement calldata
```

VINSS therefore reduces plaintext and direct participant relationship exposure; it does not claim that all metadata or all settlement data is hidden.

## Rekber commitment compatibility

The active frontend and Cairo contract share these immutable domains:

```text
VINSS_RELEASE_AUTH_V2
VINSS_PAYEE_CLAIM_V2
VINSS_ESCROW_REFUND_V2
```

The canonical source has dedicated release/refund tests. Deployed two-wallet E2E evidence is still pending.

See [Frontend Compatibility](./frontend-compatibility.md).

## Read in this order

1. [Architecture](./architecture.md)
2. [Privacy & Trust Boundary](./privacy-boundary.md)
3. [Invite](./invite.md)
4. [Message Helper](./message-helper.md)
5. [Offer Helper](./offer-helper.md)
6. [Private Escrow Helper](./private-escrow-helper.md)
7. [Escrow Rekber](./escrow-rekber.md)
8. [Envelope, Commitment & Events](./envelopes-events.md)
9. [Frontend Compatibility](./frontend-compatibility.md)
10. [Tests](./testing.md)
11. [Current Scope](./current-scope.md)

## Documentation rule

These pages distinguish:

```text
implemented contract code
≠
Cairo unit-tested behavior
≠
testnet E2E verification
≠
mainnet verification
```

Only small source excerpts that expose an important invariant or boundary are included.

Executable contract/frontend code and tests remain the source of truth.
