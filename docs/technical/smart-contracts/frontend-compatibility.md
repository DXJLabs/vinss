# Frontend Compatibility

The contract envelope must remain bit-for-bit compatible with the frontend Deal Room integration layer.

## Message

Contract:

```text
VINSS_MESSAGE_ENVELOPE_VERSION = 2
VINSS_MESSAGE_COMMITMENT_DOMAIN = VINSS_MSG_COMMIT_V2
MESSAGE_ENVELOPE_HEADER_FELTS = 6
```

Frontend:

```text
frontend/lib/privacy/messageRouting.ts
frontend/lib/deal-room/messaging.ts
```

The frontend and Cairo commitment order match:

```text
version
locator
sender_tag
recipient_tag
chunk_count
ciphertext chunks
```

## Offer

Contract:

```text
VINSS_OFFER_ENVELOPE_VERSION = 2
VINSS_OFFER_COMMITMENT_DOMAIN = VINSS_OFFER_COMMIT_V2
OFFER_ENVELOPE_HEADER_FELTS = 6
```

Frontend:

```text
frontend/lib/deal-room/offers.ts
```

## Revenue compatibility

```text
Message contract  0.5 STRK
Message frontend  0.5 STRK

Offer contract    1 STRK
Offer frontend    1 STRK
```

The token configured as `open_note_token` must match the token used by the frontend action bundle for the corresponding helper deployment.
