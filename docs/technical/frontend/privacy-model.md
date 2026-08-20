# Frontend Privacy Model

## Direct identity

Direct messaging creates a per-room, per-wallet WebCrypto ECDH P-256 identity in:

```text
lib/privacy/participantKeys.ts
```

The private key is re-imported as a **non-exportable `CryptoKey`** and stored in IndexedDB.

## Pairwise direct key

Alice and Bob derive the same room-scoped pairwise key:

```text
ECDH shared secret
      ↓
HKDF-SHA-256
      ↓
VINSS_DIRECT_MESSAGE_KEY_V1
```

The room ID is included in the HKDF salt.

This pairwise key is used by current direct Chat and direct Offer flows.

## Room-level key

Current room-level key derivation:

```text
SHA-256("VINSS_ROOM_KEY_V1:" + roomSecret)
```

This is application keying. It must not be described as the STRK20 Privacy Pool viewing-key ECDH.

`lib/privacy/channelKey.ts` also contains a separate Stark-curve ECDH scaffold, but it is not the active UI path.

## Payload encryption

VINSS uses WebCrypto AES-GCM:

```text
JSON payload
    ↓
AES-GCM with fresh 96-bit IV
    ↓
IV + ciphertext
    ↓
Starknet-safe felt chunks
```

## Discovery

The backend receives candidate encrypted records, not the pairwise key. Routing-tag matching and decryption happen locally.

## Presence

Typing/read/participant events are encrypted before `/presence/publish`. The relay receives only opaque channel ID, event ID, IV, ciphertext, and TTL.

## Agent

Automatic timeline context is reduced to generic labels such as:

```text
Encrypted private message
Encrypted Offer action
Encrypted private activity
```

The backend sanitizes again. Text explicitly typed by the user into the Agent is still remote-provider input.
