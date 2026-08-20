# Two-Party Private Chat

## Status

Two-party private Chat is part of the current tested MVP.

## Key files

```text
hooks/room/useDirectConversation.ts
hooks/room/useRoomParticipants.ts
lib/deal-room/messaging.ts
lib/privacy/participantKeys.ts
lib/privacy/messageRouting.ts
lib/privacy/presence.ts
lib/privacy/encryptedChatCache.ts
```

## Sending

`sendMessage()` performs:

```text
pairwise encryption/routing context
        ↓
one-time action locator
        ↓
sender + recipient routing tags
        ↓
encrypt MessagePayload
        ↓
commit encrypted envelope
        ↓
submit STRK20 action bundle
```

Current application revenue:

```text
0.5 STRK per submitted private message
```

## Discovery

The browser calls:

```http
POST /discover
```

with:

```json
{ "kind": "message" }
```

The frontend derives expected private routing tags, ignores unrelated records, decrypts matching ciphertext locally, verifies sender-tag binding, and renders messages for the selected pair.

## Local encrypted history

Direct history may be cached locally with AES-GCM through `lib/privacy/encryptedChatCache.ts`.

The cache is a UX optimization. External history discovery remains ciphertext-based.
