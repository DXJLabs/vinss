# VinssMessageHelper

## Source

```text
contracts/src/messaging/vinss_message_helper.cairo
```

Supporting modules:

```text
messaging_interfaces.cairo
messaging_types.cairo
messaging_validation.cairo
messaging_events.cairo
timeline_payload_hash.cairo
```

## Status

**Testnet on-chain verified as part of the current Private Chat flow.**

## Objective

Persist one encrypted VINSS Message action without accepting plaintext Message semantics or reusable participant identity fields.

## Envelope version

```text
2
```

## `privacy_invoke` calldata

```text
[0] envelope_version
[1] message_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
[last] open_note_id
```

The final `open_note_id` belongs to the STRK20 invoke-helper output path and is not part of the Message commitment.

## Commitment

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

## Validation

The contract enforces:

- configured Privacy Pool caller;
- supported envelope version;
- non-zero locator;
- non-zero routing tags;
- non-zero claimed commitment;
- non-empty payload;
- maximum 64 ciphertext chunks;
- exact calldata length;
- exact recomputed commitment match;
- locator uniqueness;
- payload commitment uniqueness.

## Storage

`VinssMessageRecord`:

```text
envelope_version
message_locator
sender_tag
recipient_tag
payload_commitment
payload_chunk_count
```

Ciphertext chunks:

```text
(message_locator, chunk_index)
→ felt252
```

Guarded getters reject unknown locator/out-of-range chunk access.

## Event

```text
MessageCommitted
```

Event shape:

```text
message_locator          key
payload_commitment
sender_tag
recipient_tag
```

No plaintext Message or explicit wallet participant address is emitted by this helper.

## Application revenue

Successful `privacy_invoke` approves the configured Privacy Pool and returns:

```text
OpenNoteDeposit
  amount = 500000000000000000
         = 0.5 STRK
```

against the configured `open_note_token`.

This is paired with the current frontend STRK20 action bundle.

## Security boundary

The helper validates encrypted structure and commitment.

It does not authenticate the semantic Message sender by decrypting payloads, and it does not interpret Message type/content.
