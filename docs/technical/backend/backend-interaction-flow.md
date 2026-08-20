# Backend Interaction Flow

This document explains the backend-specific flow from a user's action to the backend services involved.

It is not a frontend UX flow. It answers:

> When a VINSS user does something, what role does the backend play?

## Private messaging

```mermaid
sequenceDiagram
    participant A as User A Device
    participant W as Ready / STRK20
    participant H as Messaging Helper
    participant B as VINSS Backend
    participant I as Indexer
    participant C as User B Device

    A->>A: Encrypt message locally
    A->>W: Submit privacy action
    W->>H: Invoke privacy action
    H-->>H: Commit locator + payload commitment + ciphertext

    C->>B: POST /discover { kind: message }
    B->>I: Scan MessageCommitted events
    I->>H: Read message + ciphertext chunks
    H-->>I: Ciphertext + public metadata
    I-->>B: Encrypted record
    B-->>C: Ciphertext only
    C->>C: Match/decrypt locally
```

### Backend value to the user

The user does not need to implement raw Starknet event scanning and chunk retrieval in the browser for every refresh.

The backend provides the transport/indexing layer while preserving local decryption.

## Offer actions

```mermaid
sequenceDiagram
    participant A as User A
    participant H as Offer Helper
    participant B as VINSS Backend
    participant C as User B

    A->>A: Create and encrypt Offer action
    A->>H: Commit encrypted action through privacy path
    C->>B: POST /discover { kind: offer }
    B->>H: Read OfferActionCommitted + chunks
    H-->>B: Ciphertext + public metadata
    B-->>C: Encrypted Offer record
    C->>C: Decrypt and update deal state
```

The same discovery family supports:

- create;
- counter;
- accept;
- reject;

as encrypted Offer actions.

## Escrow discovery

The backend also recognizes the `escrow` discovery kind and scans `PrivateEscrowActionCommitted`.

This is a technical primitive. It does not mean the complete product-level Escrow E2E flow is already considered finished.

## Presence

```mermaid
sequenceDiagram
    participant A as User A
    participant B as VINSS Backend
    participant C as User B

    A->>A: Encrypt typing/read event
    A->>B: POST /presence/publish
    Note over B: Store opaque envelope with TTL

    C->>B: POST /presence/poll
    B-->>C: Encrypted presence events
    C->>C: Decrypt locally
```

The backend never needs to know whether an opaque presence event means `typing`, `read`, or another client-defined event.

## Agent interaction

```mermaid
flowchart LR
    U[User explicit instruction]
    --> F[Frontend]
    --> R[POST /agent]
    --> S[Server-side sanitizer]
    --> K{Skill}

    K -->|chat| C[ChatSkill]
    K -->|offer| O[OfferSkill]
    K -->|escrow| E[EscrowSkill]

    C --> A[Agent Runtime]
    O --> A
    E --> A

    A --> P[Configured Provider]
    P --> A
    A --> X[Draft / analysis / proposal]
    X --> U2[User reviews]
```

The Agent does not submit the blockchain transaction.

## Loyalty interaction

The current loyalty service provides:

```text
GET  /loyalty/config
GET  /loyalty/:subject
POST /loyalty/events
```

This is application-side state, not part of the STRK20 privacy protocol.

See [Loyalty Service](./loyalty.md) and [Mainnet Readiness](./mainnet-readiness.md) before enabling it as a production reward system.
