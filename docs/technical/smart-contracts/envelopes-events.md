# Envelope, Commitment & Events

## Message V2 commitment

```text
Poseidon(
  VINSS_MSG_COMMIT_V2,
  envelope_version,
  message_locator,
  sender_tag,
  recipient_tag,
  payload_chunk_count,
  ...ciphertext_chunks
)
```

## Offer V2 commitment

```text
Poseidon(
  VINSS_OFFER_COMMIT_V2,
  envelope_version,
  offer_action_locator,
  sender_tag,
  recipient_tag,
  payload_chunk_count,
  ...ciphertext_chunks
)
```

The claimed commitment itself is not included as an input to its own hash.

## One-time locator

A locator identifies exactly one encrypted action. It is not a stable conversation, room, participant, wallet, or deal identifier.

## Payload limits

```text
MAX_PAYLOAD_CHUNKS        = 64
MAX_OFFER_PAYLOAD_CHUNKS  = 64
```

## Event design

Message and Offer events expose only data required for public ciphertext discovery:

```text
one-time locator
commitment
opaque sender tag
opaque recipient tag
```

Ciphertext chunks are read from contract storage using the locator.
