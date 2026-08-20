# Frontend Architecture

## Role

The VINSS frontend owns privacy-sensitive client responsibilities:

- wallet connection and STRK20 capability detection;
- local key generation and derivation;
- message and Offer encryption before wallet submission;
- private routing-tag derivation;
- ciphertext discovery requests;
- client-side matching and decryption;
- encrypted local chat caching;
- Deal Room state and UX;
- privacy-safe Agent request construction.

## Layers

```mermaid
flowchart TB
    PAGE["app/room/[roomId]/page.tsx"]

    subgraph UI["UI"]
      COMP["components/room/*"]
      AGENTUI["components/agent/*"]
    end

    subgraph ORCH["Room orchestration"]
      ROOM["useRoom"]
      CONV["useRoomConversation"]
      DIRECT["useDirectConversation"]
      OFFERS["useRoomOffers"]
      PARTICIPANTS["useRoomParticipants"]
      INVITE["useRoomInvitation"]
      AGENTHOOK["useRoomAgent"]
    end

    subgraph APP["Deal Room integration layer"]
      MSG["lib/deal-room/messaging.ts"]
      OFFERMOD["lib/deal-room/offers.ts"]
      INVITEMOD["lib/deal-room/invitation.ts"]
      ESCROWMOD["lib/deal-room/escrow.ts"]
    end

    subgraph PRIV["Client privacy"]
      ENVELOPE["lib/privacy/envelope.ts"]
      KEYS["lib/privacy/participantKeys.ts"]
      ROUTING["lib/privacy/messageRouting.ts"]
      PRESENCE["lib/privacy/presence.ts"]
      CACHE["lib/privacy/encryptedChatCache.ts"]
    end

    subgraph CHAIN["Starknet access"]
      WALLET["lib/starknet/walletClient.ts"]
      CONFIG["lib/starknet/constants.ts"]
    end

    PAGE --> UI
    PAGE --> ORCH
    ORCH --> APP
    APP --> PRIV
    APP --> CHAIN
    ORCH --> PRIV
    ORCH --> CHAIN
```

## Main page

The primary Deal Room route is:

```text
app/room/[roomId]/page.tsx
```

It composes domain hooks instead of implementing all protocol operations directly.

## Backend relationship

The frontend sends public discovery parameters such as:

```json
{ "kind": "message" }
```

or:

```json
{ "kind": "offer" }
```

The backend returns candidate ciphertext records. Matching and decryption happen in the browser.
