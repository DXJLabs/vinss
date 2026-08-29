# Privacy & Trust Boundary

## Scope

VINSS uses privacy-preserving coordination, but not every on-chain value is private.

This page describes what the current contracts actually expose.

## Privacy Pool authority

Current `privacy_invoke` contracts accept that entrypoint only when:

```text
get_caller_address() == configured Privacy Pool
```

This prevents arbitrary direct writes through the intended private path.

It does not mean a helper contract has decrypted participant identity or business semantics.

## Message / Offer / Private Escrow

Public:

```text
contract address
transaction/block timing
envelope version
one-time locator
opaque sender tag
opaque recipient tag
payload commitment
ciphertext chunk count
ciphertext chunks
events carrying structural routing fields
```

Not accepted as plaintext application fields:

```text
wallet sender address
wallet recipient address
room ID
stable conversation ID
Message plaintext
Offer plaintext
Offer lifecycle kind
deal terms
private Escrow coordination kind
```

Ciphertext is public data. Confidentiality depends on client-side encryption/key management, not on ciphertext being invisible on-chain.

## FeePolicy

FeePolicy is public configuration and has no private semantics.

Publicly observable configuration includes:

```text
pricing admin
Pragma address
STRK/USD pair
sponsor cost
oracle age requirement
minimum oracle source requirement
fee action constants/floors from bytecode/source
```

## Invite

Before consume, public state includes:

```text
Invite commitment
expiry
exists/consumed state
InviteCreated event
```

Consume calldata is:

```text
[1, secret]
```

The one-time secret becomes public when consumed.

The contract atomically marks the Invite consumed so the revealed preimage cannot successfully consume it again.

## Rekber custody

Rekber intentionally exposes settlement/accounting state.

Public custody includes:

```text
custody commitment

release/payee/refund commitments
payer confirmation commitment
payer/payee dispute commitments
payee refund-consent commitment
fulfillment/revision chain heads
payer/payee certificate commitments

token
principal amount
fee amount

fulfillment/review/revision deadlines
verification policy
remaining fulfillment/revision rounds

fulfillment evidence commitment
dispute evidence commitment

resolution commitment
payer resolution amount
payee resolution amount

lifecycle booleans
created/fulfilled/settled timestamps
```

Public events expose the corresponding custody, token, amount, deadline, evidence-commitment, resolution, output-note, role, and timestamp fields documented in `envelopes-events.md`.

Rekber does not store plaintext:

```text
Deal Room ID
conversation ID
Offer text
work files
tracking details
dispute narrative
human identity
explicit payer/payee wallet addresses
```

Participant roles are represented by precommitted capabilities rather than stored wallet addresses.

## Preimage behavior

Capabilities are client-held before use.

When a capability is used through `privacy_invoke`, its preimage is part of public transaction calldata.

Examples:

```text
release:
[2, custody, payer_release_secret, payee_claim_secret, output_note_id]

no-fulfillment refund:
[3, custody, payer_refund_secret, output_note_id]

dispute:
[6, custody, role, dispute_secret, evidence_commitment]

resolution claim:
[10, custody, role, party_secret, output_note_id]
```

Therefore used secrets do not remain private forever.

Security depends on domain separation, custody binding, role-specific commitments, one-time state transitions, deadlines, and atomic consumption.

## Evidence boundary

Fulfillment/dispute plaintext or file bytes remain encrypted/off-chain.

The Rekber contract stores only opaque `felt252` evidence commitments.

A commitment proves equality to a submitted hash value; by itself it does not make a truth claim about the underlying evidence.

## Dispute resolver boundary

The immutable resolver address is public.

Resolver authorization publicly exposes:

```text
resolution_commitment
payer_amount
payee_amount
```

The split must equal the exact principal.

The resolver cannot choose an arbitrary payout recipient and does not receive principal. Each participant still needs its precommitted claim capability.

## Settlement Certificate

A certificate is intentionally public reputation data.

After claim, public data includes:

```text
token ID
recipient/owner address
custody commitment
role
settled_at
issued_at
ERC-721 mint event
SettlementCertificateIssued event
```

The certificate is non-transferable after mint, but non-transferability is not privacy.

## Claims VINSS should and should not make

Accurate:

> VINSS keeps plaintext deal semantics and direct participant relationship fields out of encrypted coordination helpers while exposing the public commitments and accounting state required by custody and settlement.

Inaccurate:

```text
no metadata
everything is hidden
Rekber amount is private
used settlement secrets stay private forever
certificate ownership is private
perfect anonymity
```
