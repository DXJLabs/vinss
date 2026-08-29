# VinssOfferHelper

## Source

```text
contracts/src/offers/
├── offer_commitments.cairo
├── offer_events.cairo
├── offer_interfaces.cairo
├── offer_types.cairo
├── offer_validation.cairo
└── vinss_offer.cairo
```

## Purpose

Persist immutable encrypted Offer lifecycle actions while keeping deal terms and lifecycle semantics inside ciphertext.

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
[1] offer_action_locator
[2] sender_tag
[3] recipient_tag
[4] claimed_payload_commitment
[5] payload_chunk_count
[6...] ciphertext_chunks
```

Full `privacy_invoke` calldata:

```text
[...encrypted envelope,
 quoted_fee,
 open_note_id]
```

The two tail fields are outside the encrypted Offer commitment.

## Commitment

```text
Poseidon(
  'VINSS_OFFER_COMMIT_V2',
  envelope_version,
  offer_action_locator,
  sender_tag,
  recipient_tag,
  payload_chunk_count,
  ...ciphertext_chunks
)
```

## Semantics intentionally not parsed

The contract does not decode whether an action is:

```text
create
counter
accept
reject
cancel
expire
```

It also does not decode:

```text
deal type
asset
amount
payment terms
conditions
expiry
root/parent relationships
participant wallet addresses
```

Those remain encrypted application semantics.

## Validation

```text
caller == configured Privacy Pool
V2 envelope
non-zero locator
non-zero routing tags
non-zero commitment
1..64 ciphertext chunks
exact envelope size
exact recomputed commitment
unused locator
unused payload commitment
quoted_fee >= FeePolicy.quote_fee(FEE_ACTION_OFFER)
```

## Storage

```text
EncryptedOfferActionRecord {
  envelope_version
  offer_action_locator
  sender_tag
  recipient_tag
  payload_commitment
  payload_chunk_count
}

(offer_action_locator, chunk_index) -> ciphertext felt
```

## Revenue output

The executable helper approves the Privacy Pool and returns:

```text
OpenNoteDeposit {
  note_id: open_note_id,
  token: open_note_token,
  amount: quoted_fee
}
```

The Offer fee is FeePolicy-driven. It must not be documented as a permanently hardcoded `10 STRK` contract fee.

## Event

```text
OfferActionCommitted
  key: offer_action_locator
  data:
    payload_commitment
    sender_tag
    recipient_tag
```

## Security boundary

The helper verifies encrypted envelope integrity and uniqueness. It does not enforce plaintext semantic rules such as which participant is allowed to accept or cancel a particular Offer.
