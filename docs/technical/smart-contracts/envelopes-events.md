# Envelopes, Commitments & Events

## Encrypted coordination envelope family

Message, Offer, and Private Escrow coordination use V2 envelopes with six fixed felts:

```text
version
one-time locator
sender tag
recipient tag
claimed commitment
chunk count
ciphertext...
```

Each module has an independent domain separator.

## Message V2

```text
Poseidon(
  VINSS_MSG_COMMIT_V2,
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

## Offer V2

```text
Poseidon(
  VINSS_OFFER_COMMIT_V2,
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

## Private Escrow coordination V2

Executable commitment:

```text
Poseidon(
  VINSS_PRIVATE_ESCROW_COMMIT_V2,
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

## Payload limits

```text
Message                 64 chunks
Offer                   64 chunks
Private Escrow          64 chunks
```

These are implementation limits, not yet final production benchmark conclusions.

## Locator rule

A locator identifies one encrypted action only.

Do not reuse it as:

```text
room id
conversation id
wallet id
participant id
deal id
escrow id
```

## Invite commitment/event family

Invite commitment:

```text
Poseidon(
  VINSS_INVITE_V1,
  secret
)
```

Events:

```text
InviteCreated
  key: commitment
  data: expires_at

InviteConsumed
  key: commitment
```

## Escrow Rekber commitment/event family

Payer release authorization:

```text
Poseidon(
  VINSS_RELEASE_AUTH_V2,
  custody_commitment,
  payer_release_secret
)
```

Payee claim:

```text
Poseidon(
  VINSS_PAYEE_CLAIM_V2,
  custody_commitment,
  payee_claim_secret
)
```

Refund:

```text
Poseidon(
  VINSS_ESCROW_REFUND_V2,
  custody_commitment,
  refund_secret
)
```

Events:

```text
EscrowRekberCustodyFunded
EscrowRekberCustodyReleased
EscrowRekberCustodyRefunded
```

These settlement events are not ciphertext-only events; they intentionally expose the public custody fields required by the current design.
