# Frontend Compatibility

Contract and frontend encoding must match exactly.

A successful Cairo build does not prove that the browser constructs the same commitment/calldata.

## Message — compatible

Contract:

```text
version = 2
domain  = VINSS_MSG_COMMIT_V2
header  = 6 felts
```

Frontend:

```text
frontend/lib/privacy/messageRouting.ts
frontend/lib/deal-room/messaging.ts
```

Both commit:

```text
domain
version
locator
sender_tag
recipient_tag
chunk_count
ciphertext
```

Current application revenue also matches:

```text
contract  0.5 STRK
frontend  0.5 STRK
```

## Offer — compatible

Contract:

```text
version = 2
domain  = VINSS_OFFER_COMMIT_V2
header  = 6 felts
```

Frontend:

```text
frontend/lib/deal-room/offers.ts
```

Current commitment order and 1 STRK revenue path match the helper.

## Private Escrow coordination — executable code compatible

Contract executable V2 layout:

```text
version
locator
sender_tag
recipient_tag
commitment
chunk_count
ciphertext
```

Frontend:

```text
frontend/lib/deal-room/escrow.ts
```

Frontend and executable Cairo commitment code both include:

```text
VINSS_PRIVATE_ESCROW_COMMIT_V2
version
locator
sender_tag
recipient_tag
chunk_count
ciphertext
```

### Stale source-comment warning

Some Cairo comments and the leading comment in `frontend/lib/deal-room/escrow.ts` still show an older header without sender/recipient tags.

The executable code and current tests use the V2 six-field shape above.

## Invite — compatible at contract-call level

Create:

```text
frontend [0, commitment, expires_at]
contract [0, commitment, expires_at]
```

Consume:

```text
frontend [1, secret]
contract [1, secret]
```

Both derive commitment from:

```text
VINSS_INVITE_V1 + secret
```

The contract itself returns no OpenNoteDeposit.

## Escrow Rekber deposit — shape and fee compatible

Frontend deposit constructs:

```text
1
custody commitment
release commitment
refund commitment
refund-after
token
principal
```

and appends the revenue OpenNote ID through the Wallet API open-note placeholder.

The contract receives eight felts including that final note ID.

Both frontend and contract currently use:

```text
fee = principal / 100
```

## Escrow Rekber release/refund — code aligned, E2E pending

Frontend and Cairo now use the same domain-separated formulas:

```text
Poseidon(
  VINSS_ESCROW_RELEASE_V1,
  custody_commitment,
  release_secret
)

Poseidon(
  VINSS_ESCROW_REFUND_V1,
  custody_commitment,
  refund_secret
)
```

The frontend also converts the accepted Offer's human-readable decimal amount
to the selected settlement token's exact base units before funding.

This removes the previously identified commitment mismatch.

It does **not** by itself upgrade Escrow Rekber to E2E verified. Release/refund
contract tests and deployed testnet execution evidence are still required.

## Compatibility verification rule

For every envelope/commitment change, verify:

```text
domain
version
field order
felt encoding
chunk count
open-note placeholder position
fee/output amount
frontend hash
Cairo hash
```

with a cross-layer test vector where practical.
