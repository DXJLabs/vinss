# VinssOfferHelper

## Source

```text
contracts/src/offers/vinss_offer.cairo
```

Supporting modules:

```text
offer_interfaces.cairo
offer_types.cairo
offer_validation.cairo
offer_events.cairo
offer_commitments.cairo
```

## Envelope version

```text
2
```

## Offer calldata

Before the Wallet API appends the open-note identifier:

```text
[0] envelope_version
[1] offer_action_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
```

`privacy_invoke` receives:

```text
envelope
+
[last] open_note_id
```

## Contract semantics

The contract does not parse the private Offer lifecycle action.

For the helper, create/counter/accept/reject are encrypted payloads with the same public envelope structure.

The frontend performs the private lifecycle interpretation after local decryption.

## Validation

The helper validates:

- caller is the configured Privacy Pool;
- envelope version;
- non-zero locator;
- non-zero sender tag;
- non-zero recipient tag;
- non-zero commitment;
- non-empty payload;
- maximum payload chunks;
- exact calldata size;
- recomputed commitment;
- locator uniqueness;
- commitment uniqueness.

## Stored record

`EncryptedOfferActionRecord` contains:

```text
envelope_version
offer_action_locator
sender_tag
recipient_tag
payload_commitment
payload_chunk_count
```

Ciphertext chunks are stored separately.

## Event

```text
OfferActionCommitted
```

Event fields:

```text
offer_action_locator     key
payload_commitment
sender_tag
recipient_tag
```

## Revenue

Successful Offer invocation returns one `OpenNoteDeposit`:

```text
amount = 1000000000000000000
      = 1 STRK
```

against the configured `open_note_token`.

This matches the current frontend Offer action bundle.
