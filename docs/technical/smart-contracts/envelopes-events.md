# Envelopes, Commitments & Events

## Encrypted envelope family

Message, Offer, and Private Escrow coordination use a six-field V2 header:

```text
version
one-time locator
sender tag
recipient tag
claimed commitment
chunk count
ciphertext...
```

The tags are opaque routing values, not plaintext wallet addresses.

Payload limit:

```text
Message        <= 64 chunks
Offer          <= 64 chunks
Private Escrow <= 64 chunks
```

These are implementation bounds.

## Message commitment

```text
Poseidon(
  'VINSS_MSG_COMMIT_V2',
  version,
  message_locator,
  sender_tag,
  recipient_tag,
  chunk_count,
  ...ciphertext
)
```

Event:

```text
MessageCommitted
  key: message_locator
  data:
    payload_commitment
    sender_tag
    recipient_tag
```

## Offer commitment

```text
Poseidon(
  'VINSS_OFFER_COMMIT_V2',
  version,
  offer_action_locator,
  sender_tag,
  recipient_tag,
  chunk_count,
  ...ciphertext
)
```

Event:

```text
OfferActionCommitted
  key: offer_action_locator
  data:
    payload_commitment
    sender_tag
    recipient_tag
```

## Private Escrow coordination commitment

```text
Poseidon(
  'VINSS_PRIVATE_ESCROW_COMMIT_V2',
  version,
  private_escrow_action_locator,
  sender_tag,
  recipient_tag,
  chunk_count,
  ...ciphertext
)
```

Event:

```text
PrivateEscrowActionCommitted
  key: private_escrow_action_locator
  data:
    payload_commitment
    sender_tag
    recipient_tag
```

## Invite commitment

```text
Poseidon(
  'VINSS_INVITE_V1',
  secret
)
```

Events:

```text
InviteCreated(commitment, expires_at)
InviteConsumed(commitment)
```

## Rekber capability commitments

Release authorization:

```text
Poseidon(
  'VINSS_RELEASE_AUTH',
  custody_commitment,
  payer_release_secret
)
```

Payee claim:

```text
Poseidon(
  'VINSS_PAYEE_CLAIM',
  custody_commitment,
  payee_claim_secret
)
```

Payer refund:

```text
Poseidon(
  'VINSS_ESCROW_REFUND',
  custody_commitment,
  payer_refund_secret
)
```

Payer fulfillment confirmation:

```text
Poseidon(
  'VINSS_PAYER_CONFIRM',
  custody_commitment,
  payer_confirmation_secret
)
```

Payer dispute:

```text
Poseidon(
  'VINSS_PAYER_DISPUTE',
  custody_commitment,
  payer_dispute_secret
)
```

Payee dispute:

```text
Poseidon(
  'VINSS_PAYEE_DISPUTE',
  custody_commitment,
  payee_dispute_secret
)
```

Payee refund consent:

```text
Poseidon(
  'VINSS_REFUND_CONSENT',
  custody_commitment,
  payee_refund_consent_secret
)
```

Do not append `_V2` to these Rekber domains; the executable source uses the exact strings above.

## Rekber one-way chains

Fulfillment step:

```text
Poseidon(
  'VINSS_FULFILL_CHAIN',
  custody_commitment,
  secret
)
```

Revision step:

```text
Poseidon(
  'VINSS_REVISION_CHAIN',
  custody_commitment,
  secret
)
```

Revealing one chain secret advances the stored head without exposing a future secret.

## Certificate commitments

Claim capability:

```text
Poseidon(
  'VINSS_CERT_CLAIM',
  custody_commitment,
  role,
  recipient_address,
  certificate_secret
)
```

Token ID:

```text
Poseidon(
  'VINSS_CERT_TOKEN',
  custody_commitment,
  role
)
```

## Rekber lifecycle events

### `EscrowRekberCustodyFunded`

Keys:

```text
custody_commitment
token
```

Data:

```text
amount
fulfillment_deadline
timestamp
fee_amount
review_window
verification_policy
```

### `EscrowRekberFulfillmentSubmitted`

Keys:

```text
custody_commitment
evidence_commitment
```

Data:

```text
timestamp
rounds_remaining
```

### `EscrowRekberFulfillmentConfirmed`

Keys:

```text
custody_commitment
evidence_commitment
```

Data:

```text
review_deadline
timestamp
```

### `EscrowRekberRevisionRequested`

Keys:

```text
custody_commitment
reason_commitment
```

Data:

```text
revision_deadline
timestamp
rounds_remaining
```

### `EscrowRekberDisputeOpened`

Keys:

```text
custody_commitment
evidence_commitment
```

Data:

```text
opened_by_role
timestamp
```

### `EscrowRekberDisputeResolutionAuthorized`

Keys:

```text
custody_commitment
resolution_commitment
```

Data:

```text
payer_amount
payee_amount
timestamp
```

### `EscrowRekberResolutionClaimed`

Keys:

```text
custody_commitment
output_note_id
```

Data:

```text
role
amount
timestamp
```

### `EscrowRekberCustodyReleased`

Keys:

```text
custody_commitment
output_note_id
```

Data:

```text
timestamp
release_mode
```

Release modes:

```text
1 = mutual release
2 = review-timeout auto-release
```

### `EscrowRekberCustodyRefunded`

Keys:

```text
custody_commitment
output_note_id
```

Data:

```text
timestamp
refund_mode
```

Refund modes:

```text
1 = no-fulfillment timeout
2 = mutual refund
```

### `EscrowRekberCustodyResolved`

Keys:

```text
custody_commitment
resolution_commitment
```

Data:

```text
payer_amount
payee_amount
timestamp
```

## Settlement Certificate event

```text
SettlementCertificateIssued
  token_id
  recipient
  custody_commitment
  role
  settled_at
  issued_at
```

These events expose public verification/accounting commitments. They do not contain plaintext Offer terms, fulfillment files, or dispute text.
