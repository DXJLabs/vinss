# VinssMessageHelper

## Source

```text
contracts/src/messaging/
├── messaging_events.cairo
├── messaging_interfaces.cairo
├── messaging_types.cairo
├── messaging_validation.cairo
├── timeline_payload_hash.cairo
└── vinss_message_helper.cairo
```

## Purpose

Store one independently discoverable encrypted Message action while keeping plaintext Message semantics and direct wallet participant addresses out of helper storage.

## Constructor

```text
privacy_pool: ContractAddress
open_note_token: ContractAddress
fee_policy: ContractAddress
```

All addresses must be non-zero.

## Envelope

Version:

```text
2
```

Committed envelope:

```text
[0] envelope_version
[1] message_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
```

Full `privacy_invoke` calldata appends two fields:

```text
[...encrypted envelope,
 quoted_fee,
 open_note_id]
```

`quoted_fee` and `open_note_id` are not part of the encrypted payload commitment.

## Commitment

```text
Poseidon(
  'VINSS_MSG_COMMIT_V2',
  envelope_version,
  message_locator,
  sender_tag,
  recipient_tag,
  payload_chunk_count,
  ...ciphertext_chunks
)
```

## Validation

The executable path enforces:

```text
caller == configured Privacy Pool
supported envelope version
non-zero locator
non-zero sender tag
non-zero recipient tag
non-zero claimed commitment
1..64 ciphertext chunks
exact envelope length
exact recomputed commitment
unused locator
unused payload commitment
quoted_fee >= FeePolicy.quote_fee(FEE_ACTION_MESSAGE)
```

## Storage

```text
VinssMessageRecord {
  envelope_version
  message_locator
  sender_tag
  recipient_tag
  payload_commitment
  payload_chunk_count
}

(message_locator, chunk_index) -> ciphertext felt
```

Explicit existence and committed-payload maps prevent zero-default ambiguity and duplicate reuse.

## Revenue output

After storing the envelope, the helper approves the Privacy Pool for exactly `quoted_fee` and returns:

```text
OpenNoteDeposit {
  note_id: open_note_id,
  token: open_note_token,
  amount: quoted_fee
}
```

The fee is dynamic. Do not document Message as a permanently hardcoded `7 STRK` contract fee.

## Event

```text
MessageCommitted
  key: message_locator
  data:
    payload_commitment
    sender_tag
    recipient_tag
```

No plaintext Message is emitted.

## Read surface

The contract exposes existence, structural-record, ciphertext-chunk, and payload-commitment lookup methods. Chunk getters reject unknown locators and out-of-range indexes.

## Security boundary

The helper proves encrypted envelope structure, integrity, uniqueness, and Privacy-Pool invocation.

It does not decrypt or independently prove the application-level identity of the human Message sender.
