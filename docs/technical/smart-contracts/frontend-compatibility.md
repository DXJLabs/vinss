# Frontend Compatibility

Contract and frontend encoding must match exactly. Cairo compilation alone does not validate browser calldata, Ready X action ordering, commitment generation, or output-note substitution.

## Message

```text
version = 2
domain  = VINSS_MSG_COMMIT_V2
```

Contract `privacy_invoke` expects:

```text
[envelope fields + ciphertext,
 quoted_fee,
 open_note_id]
```

The frontend must quote against the helper's configured FeePolicy. The contract accepts `quoted_fee >= minimum` and returns exactly that amount in its revenue `OpenNoteDeposit`.

## Offer

```text
version = 2
domain  = VINSS_OFFER_COMMIT_V2
```

Contract layout:

```text
[envelope fields + ciphertext,
 quoted_fee,
 open_note_id]
```

Offer lifecycle type and terms remain encrypted.

## Private Rekber coordination

```text
version = 2
domain  = VINSS_PRIVATE_ESCROW_COMMIT_V2
```

Layout:

```text
version
locator
sender tag
recipient tag
claimed commitment
chunk count
ciphertext...
```

There is no contract-level revenue output from `VinssPrivateEscrowHelper`.

## Invite

Create:

```text
[0,
 commitment,
 expires_at,
 quoted_fee,
 open_note_id]
```

Consume:

```text
[1, secret]
```

Only create returns a fee `OpenNoteDeposit`.

## Rekber domains

Frontend `frontend/lib/deal-room/settlement.ts` and Cairo must share:

```text
VINSS_RELEASE_AUTH
VINSS_PAYEE_CLAIM
VINSS_ESCROW_REFUND
VINSS_PAYER_CONFIRM
VINSS_PAYER_DISPUTE
VINSS_PAYEE_DISPUTE
VINSS_REFUND_CONSENT
VINSS_FULFILL_CHAIN
VINSS_REVISION_CHAIN
VINSS_CERT_CLAIM
VINSS_CERT_TOKEN
```

Do not use the obsolete `_V2` suffix for Rekber capability domains.

## Rekber funding

Action `1` must encode 22 felts:

```text
1
custody commitment
release authorization commitment
payee claim commitment
refund commitment
payer confirmation commitment
payer dispute commitment
payee dispute commitment
payee refund-consent commitment
fulfillment chain head
revision chain head
payer certificate commitment
payee certificate commitment
fulfillment deadline
review window
verification policy
fulfillment rounds
revision rounds
token
principal
exact quoted fee
revenue open-note ID
```

The frontend must call `quote_rekber_fee(token, principal)` immediately before constructing the funding transaction.

The contract requires exact equality with the live quote.

## Rekber terminal/output actions

The wallet appends the output open-note ID expected by the contract:

```text
release:
[2, custody, release_secret, payee_claim_secret, output_note_id]

timeout refund:
[3, custody, refund_secret, output_note_id]

auto release:
[8, custody, payee_claim_secret, output_note_id]

mutual refund:
[9, custody, refund_secret, payee_consent_secret, output_note_id]

resolution claim:
[10, custody, role, party_secret, output_note_id]
```

State-only Rekber actions do not return custody output:

```text
submit fulfillment:
[4, custody, chain_secret, evidence_commitment]

confirm fulfillment:
[5, custody, confirmation_secret, evidence_commitment]

open dispute:
[6, custody, role, dispute_secret, evidence_commitment]

request revision:
[7, custody, chain_secret, reason_commitment]
```

## Workflow charge vs contract invariant

The current frontend may bundle a 3 STRK VINSS charge with selected Rekber workflow actions.

That price comes from application transaction construction. It is not validated by `VinssEscrowRekber`.

Funding is different: the Rekber contract itself validates the service fee.

## Certificate

Roles:

```text
payer = 1
payee = 2
```

Claim commitment binds:

```text
custody
role
recipient wallet address
secret
```

The current Cairo bytecode must include the `CERT_NON_TRANSFERABLE` hook. Frontend UI should not expose a transfer affordance.

## Environment alignment

Relevant frontend variables include:

```text
NEXT_PUBLIC_PRIVACY_POOL_ADDRESS
NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS
NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN
NEXT_PUBLIC_INVITE_ADDRESS
NEXT_PUBLIC_OFFER_HELPER_ADDRESS
NEXT_PUBLIC_OFFER_HELPER_OPEN_NOTE_TOKEN
NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS
NEXT_PUBLIC_ESCROW_REKBER_ADDRESS
NEXT_PUBLIC_SETTLEMENT_CERTIFICATE_ADDRESS
NEXT_PUBLIC_STRK_ADDRESS
NEXT_PUBLIC_USDC_ADDRESS
NEXT_PUBLIC_VINSS_TREASURY_ADDRESS
```

Addresses are network-specific and must not be hardcoded into compatibility documentation.

## Compatibility checklist

For every contract/frontend change verify:

```text
constructor argument order
entrypoint/action selector
calldata field order
felt/u8/u64/u128 conversion
domain string
Poseidon input order
role encoding
ciphertext chunk count
quoted-fee rule
open-note placeholder position
token/output amount
event selector and field order
custody state decoding
network-specific address
```
