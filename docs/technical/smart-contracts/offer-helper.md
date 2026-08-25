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

## Status

**Testnet on-chain verified as part of the current Structured Offer flow.**

## Objective

Persist immutable encrypted Offer actions while keeping Offer lifecycle semantics and deal terms inside ciphertext.

## Envelope version

```text
2
```

## `privacy_invoke` calldata

```text
[0] envelope_version
[1] offer_action_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
[last] open_note_id
```

## Commitment

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

## Contract semantics

The helper does not parse whether an encrypted action is:

```text
create
counter
accept
reject
cancel
expire
```

Nor does it parse:

```text
deal type
asset
amount
payment terms
conditions
expiry
root/parent Offer relationship
participant addresses
```

Those are encrypted application semantics interpreted by the authorized client.

## Validation

The contract enforces:

- configured Privacy Pool caller;
- V2 envelope;
- non-zero locator;
- non-zero routing tags;
- non-zero commitment;
- 1–64 ciphertext chunks;
- exact calldata size;
- commitment recomputation;
- locator uniqueness;
- commitment uniqueness.

## Storage

```text
EncryptedOfferActionRecord
  envelope_version
  offer_action_locator
  sender_tag
  recipient_tag
  payload_commitment
  payload_chunk_count
```

Ciphertext remains separately addressable by locator + chunk index.

## Event

```text
OfferActionCommitted
```

Event:

```text
offer_action_locator     key
payload_commitment
sender_tag
recipient_tag
```

## Application revenue

Successful external invocation returns one:

```text
OpenNoteDeposit
  amount = 10000000000000000000
         = 10 STRK
```

against the configured `open_note_token`.

## Security boundary

The helper proves only encrypted envelope integrity/uniqueness and Privacy-Pool invocation.

It does not independently enforce semantic Offer authorization such as who is allowed to accept/cancel a particular encrypted deal.
