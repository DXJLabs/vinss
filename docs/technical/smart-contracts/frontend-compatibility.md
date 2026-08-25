# Frontend Compatibility

Contract and frontend encoding must match exactly. A Cairo build alone does not verify browser calldata or commitments.

## Message

```text
version = 2
domain  = VINSS_MSG_COMMIT_V2
fee     = 7 STRK
```

The helper and frontend commit the domain, version, locator, sender tag, recipient tag, chunk count, and ciphertext.

## Offer

```text
version = 2
domain  = VINSS_OFFER_COMMIT_V2
fee     = 10 STRK per lifecycle action
```

Offer plaintext and participant fields stay encrypted.

## Private Rekber coordination

`VinssPrivateEscrowHelper` and `frontend/lib/deal-room/escrow.ts` use the same six-field encrypted envelope header and `VINSS_PRIVATE_ESCROW_COMMIT_V2` domain.

## Rekber funding

The canonical frontend submits:

```text
1
custody commitment
release authorization commitment
payee claim commitment
refund commitment
payer certificate commitment
payee certificate commitment
refund-after
token
principal
revenue open-note ID
```

Frontend and Cairo both compute:

```text
fee = principal / 50
```

## Rekber release/refund commitments

Frontend `settlement.ts` and Cairo `commitments.cairo` share these immutable domains:

```text
Poseidon(VINSS_RELEASE_AUTH_V2, custody, payer_secret)
Poseidon(VINSS_PAYEE_CLAIM_V2, custody, payee_secret)
Poseidon(VINSS_ESCROW_REFUND_V2, custody, refund_secret)
```

Release calldata contains both release preimages. Refund calldata contains only the payer refund preimage. The wallet appends the output open-note ID.

## Settlement Certificate

The certificate constructor receives the canonical Rekber address. Frontend and Cairo share the certificate claim/token domains and role encoding:

```text
payer = 1
payee = 2
```

## Environment

There is one custody address variable:

```text
NEXT_PUBLIC_ESCROW_REKBER_ADDRESS
```

The backend indexer uses `ESCROW_REKBER_ADDRESS` and the canonical event selectors only.

## Compatibility checklist

For every change, verify domain, version, field order, felt encoding, open-note placeholder position, fee/output amount, event selector, frontend hash, and Cairo hash.
