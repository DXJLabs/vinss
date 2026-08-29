
VINSS Smart Contract Technical Reference

This directory documents the Cairo contracts exported by "contracts/src/lib.cairo", their security and authorization boundaries, public state, fee behavior, and the integration assumptions that must remain synchronized with the surrounding VINSS application stack.

Executable Cairo source and tests are the source of truth. This documentation does not replace ABI inspection, deployment artifacts, contract verification, or network-level testing.

Contract Inventory

Contract| Responsibility
"VinssFeePolicy"| Shared oracle-backed fee-floor and sponsor-cost policy
"VinssInvite"| Creates one-time, expiring Invite commitments with fee-bearing activation
"VinssMessageHelper"| Stores encrypted Message V2 envelopes and returns a revenue "OpenNoteDeposit"
"VinssOfferHelper"| Stores encrypted Offer V2 actions and returns a revenue "OpenNoteDeposit"
"VinssPrivateEscrowHelper"| Stores encrypted Rekber coordination actions and never custodies settlement principal
"VinssEscrowRekber"| Custodies STRK or USDC and enforces fulfillment, review, revision, refund, dispute, resolution, and settlement
"VinssSettlementCertificate"| Issues claimable, non-transferable ERC-721 settlement credentials for eligible successful settlements

Execution and Dependency Model

flowchart TD
    FE[VINSS Frontend]
    WALLET[Privacy-enabled Wallet / Ready X]
    POOL[STRK20 Privacy Pool]

    INVITE[VinssInvite]
    MESSAGE[VinssMessageHelper]
    OFFER[VinssOfferHelper]
    PRIVATE_ESCROW[VinssPrivateEscrowHelper]
    REKBER[VinssEscrowRekber]
    FEE[VinssFeePolicy]
    CERT[VinssSettlementCertificate]

    PRAGMA[Pragma Oracle]
    RESOLVER[Dedicated Dispute Resolver]
    VERIFIER[Optional Objective Verifier]
    CLAIMANT[Claimant Wallet]

    FE --> WALLET
    WALLET --> POOL

    POOL --> INVITE
    POOL --> MESSAGE
    POOL --> OFFER
    POOL --> PRIVATE_ESCROW
    POOL --> REKBER

    PRAGMA --> FEE
    PRAGMA --> REKBER

    FEE -->|Invite fee floor| INVITE
    FEE -->|Message fee floor| MESSAGE
    FEE -->|Offer fee floor| OFFER
    FEE -->|Rekber lifecycle reserve floor| REKBER

    RESOLVER -->|authorize_dispute_resolution| REKBER
    VERIFIER -->|confirm_external_fulfillment| REKBER

    CLAIMANT -->|claim| CERT
    CERT -->|verifies canonical settlement state| REKBER

All current contracts exposing "privacy_invoke" restrict the caller of that entrypoint to the configured STRK20 Privacy Pool contract.

This is an invocation boundary. It does not imply that the receiving contract knows the plaintext identity or business semantics of a participant.

Authorization Boundaries

Authorization is enforced independently from privacy.

A call originating through the configured Privacy Pool proves only that the invocation passed through the expected contract boundary. Participant authority must still be derived from the capabilities, commitments, roles, or state transitions enforced by the destination contract.

"VinssEscrowRekber" additionally defines explicit settlement roles and state-dependent permissions for payer, payee, dispute resolver, and optional objective verifier actions.

The dispute resolver may authorize only a payer/payee distribution that satisfies the custody invariant:

payer_amount + payee_amount = custody_principal

The resolver cannot redirect settlement principal to itself.

After resolution, each party claims only its own authorized share using the capability committed during funding.

Privacy and Public-State Boundary

The Message, Offer, and Private Escrow helper contracts are ciphertext-oriented contracts.

They store public encrypted envelopes together with opaque routing or commitment metadata required for discovery and verification. They do not decrypt business semantics on-chain.

"VinssEscrowRekber" intentionally has a different privacy boundary.

The following settlement information may exist as public contract state:

- settlement token
- custody principal
- service fee
- lifecycle reserve
- deadlines
- settlement policy
- custody commitments
- evidence commitments
- fulfillment state
- review state
- dispute state
- authorized resolution amounts
- final settlement state

Encrypted negotiation content and plaintext business semantics remain outside the Rekber contract unless explicitly committed through a public cryptographic commitment.

Rekber Custody Invariants

"VinssEscrowRekber" is responsible for custody correctness, not merely coordination.

The following invariants must hold across the settlement lifecycle:

released principal
+ refunded principal
+ dispute-authorized principal
<= funded custody principal

A final settlement path must not distribute more principal than was funded.

A dispute resolution must satisfy:

payer allocation + payee allocation = custody principal

A resolver cannot become a principal recipient merely by resolving a dispute.

Finalized settlement state must not be executable a second time through another mutually exclusive settlement path.

Refund, release, dispute, and resolution transitions are therefore state-dependent and role-dependent.

Settlement Certificate

"VinssSettlementCertificate" exposes an ERC-721-compatible ownership interface while enforcing non-transferability after mint.

A certificate may be minted only through the supported claim path after the contract verifies eligible canonical Rekber settlement state.

The ERC-721 ownership update hook permits only the initial transition:

zero owner -> certificate recipient

Subsequent transfer or burn attempts revert with:

CERT_NON_TRANSFERABLE

The certificate therefore behaves as a soulbound settlement credential rather than a freely transferable NFT.

Fee Model

"VinssFeePolicy" provides shared fee floors used by Room activation, Message, Offer, and Rekber lifecycle pricing.

Quotes are oracle-backed and compare the configured public USD floor against the sponsor-cost floor.

Conceptually:

required fee floor =
max(
  configured USD floor,
  sponsor-cost floor
)

The resulting USD requirement is converted into the relevant token-denominated execution quote using the configured oracle path.

Rekber Funding Fee

Rekber funding does not use a simple flat helper fee.

Its fee is computed as:

Rekber fee =
max(
  2% of principal,
  token-denominated value of
    max(
      configured Rekber minimum USD,
      FeePolicy Rekber lifecycle reserve USD
    )
)

The caller-supplied funding quote must exactly match the contract-computed quote at execution.

This prevents execution using a stale, underquoted, or otherwise mismatched funding fee.

Application-Level Workflow Charges

Frontend workflow charges are distinct from contract-enforced fee invariants.

For example, a frontend workflow may currently bundle an additional Rekber action charge such as:

3 STRK

That charge belongs to VINSS application transaction-bundle behavior unless it is independently enforced by the Cairo contract.

It must therefore not be interpreted as an invariant of "VinssEscrowRekber".

Contract Layer vs Application Layer

The smart-contract layer defines:

authorization
public state
custody
fee enforcement
state transitions
settlement invariants
events
certificate eligibility

The surrounding application layer is responsible for concerns such as:

wallet UX
Ready X request construction
STRK20 proving workflow
frontend transaction bundling
indexer synchronization
ciphertext discovery
client-side decryption
mainnet product E2E

Application behavior may depend on the contracts, but it must not be described as contract-enforced unless the corresponding condition is actually checked on-chain.

Documentation Order

For a complete understanding of the contract system, read the documentation in this order:

1. "Architecture" (./architecture.md)
2. "Fee Policy" (./fee-policy.md)
3. "Privacy & Trust Boundary" (./privacy-boundary.md)
4. "Invite" (./invite.md)
5. "Message Helper" (./message-helper.md)
6. "Offer Helper" (./offer-helper.md)
7. "Private Escrow Helper" (./private-escrow-helper.md)
8. "Escrow Rekber" (./escrow-rekber.md)
9. "Settlement Certificate" (./settlement-certificate.md)
10. "Envelopes, Commitments & Events" (./envelopes-events.md)
11. "Frontend Compatibility" (./frontend-compatibility.md)
12. "Testing" (./testing.md)
13. "Current Scope" (./current-scope.md)

Verification and Evidence Levels

The following labels represent different engineering claims and must not be treated as equivalent:

implemented source
        |
        v
Cairo build success
        |
        v
Starknet Foundry test success
        |
        v
testnet deployment
        |
        v
testnet wallet E2E
        |
        v
mainnet deployment
        |
        v
Voyager source verification
        |
        v
mainnet product E2E

A successful step does not automatically prove any later step.

For example, passing Starknet Foundry tests does not prove:

- Ready X request compatibility
- STRK20 Privacy Pool proof generation
- paymaster behavior
- deployment configuration
- frontend ABI compatibility
- indexer synchronization
- production wallet behavior
- mainnet product E2E correctness

Similarly, a successful deployment proves that bytecode was deployed to a network; it does not by itself prove source verification or successful application-level integration.

Where possible, documentation should state the exact evidence level supporting each claim rather than using broad labels such as "tested", "verified", or "production-ready".
