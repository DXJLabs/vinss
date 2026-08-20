# Application Flow

## Reviewer path

For the tested two-party MVP:

```text
Connect wallet
    ↓
Open/join Deal Room
    ↓
Discover participant identity
    ↓
Select private peer
    ↓
Derive pairwise encryption key
    ↓
Private Chat / Offer
    ↓
Ready + STRK20
    ↓
VINSS helper contract
    ↓
Backend ciphertext discovery
    ↓
Local match + decrypt
```

## Private message

```mermaid
sequenceDiagram
    participant U as User
    participant F as VINSS Frontend
    participant W as Ready / STRK20
    participant H as Message Helper
    participant B as VINSS Backend
    participant P as Peer Frontend

    U->>F: Send private message
    F->>F: Derive pairwise key
    F->>F: Encrypt payload + derive opaque routing tags
    F->>W: STRK20 action bundle
    W->>H: privacy_invoke
    H-->>H: Commit ciphertext record
    P->>B: POST /discover {kind: message}
    B-->>P: Candidate ciphertext
    P->>P: Match + decrypt locally
```

## Private Offer

```mermaid
sequenceDiagram
    participant U as User
    participant F as VINSS Frontend
    participant W as Ready / STRK20
    participant H as Offer Helper
    participant B as VINSS Backend
    participant P as Peer Frontend

    U->>F: Create Offer action
    F->>F: Reuse direct pairwise context
    F->>F: Encrypt Offer terms
    F->>W: STRK20 action bundle
    W->>H: privacy_invoke
    H-->>H: Commit immutable Offer action
    P->>B: POST /discover {kind: offer}
    B-->>P: Candidate Offer ciphertext
    P->>P: Match + decrypt locally
```

## Agent

The Agent is separate from transaction execution:

```text
User instruction
    ↓
Frontend minimizes automatic context
    ↓
POST /agent with explicit skill
    ↓
Backend sanitizes again
    ↓
Agent returns draft/analysis/proposal
    ↓
User decides whether to use it
```
