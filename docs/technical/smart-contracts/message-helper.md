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

## Envelope version

```text
2
```

## Message calldata

Before the Wallet API appends the open-note identifier:

```text
[0] envelope_version
[1] message_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
```

`privacy_invoke` receives the same envelope followed by:

```text
[last] open_note_id
```

## Validation

The helper validates:

- caller is the configured Privacy Pool;
- supported envelope version;
- non-zero message locator;
- non-zero sender tag;
- non-zero recipient tag;
- non-zero payload commitment;
- non-empty payload;
- payload chunk count within limit;
- exact calldata length;
- claimed commitment equals recomputed commitment;
- locator has not already been stored;
- commitment has not already been stored.

## Stored record

`VinssMessageRecord` contains:

```text
envelope_version
message_locator
sender_tag
recipient_tag
payload_commitment
payload_chunk_count
```

Ciphertext is stored separately by `(message_locator, chunk_index)`.

## Event

```text
MessageCommitted
```

Event data contains:

```text
message_locator          key
payload_commitment
sender_tag
recipient_tag
```

No plaintext message or explicit wallet participant address is emitted.

## Revenue

Successful private message invocation returns one `OpenNoteDeposit`:

```text
amount = 500000000000000000
      = 0.5 STRK
```

against the configured `open_note_token`.

The frontend action bundle routes this application revenue through the STRK20 open-note flow.
