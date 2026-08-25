# Privacy & Trust Boundary

## Objective

This page states exactly what current VINSS contracts hide, what they expose, and what becomes public during settlement.

## Configured Privacy Pool authority

All current VINSS `privacy_invoke` paths are restricted to the Privacy Pool address fixed at deployment.

This proves only the invocation path.

It does **not** mean the helper contract understands the encrypted user's identity or every application-level authorization rule.

## Message / Offer / Private Escrow coordination

These encrypted helpers do not accept plaintext fields for:

```text
wallet sender address
wallet recipient address
room id
stable conversation id
plaintext Message
Offer terms
Offer lifecycle kind
private Escrow coordination kind
deal terms
```

Public state includes:

```text
helper address
transaction/block timing
envelope version
one-time locator
sender routing tag
recipient routing tag
payload commitment
ciphertext chunk count
ciphertext
```

The routing tags are opaque values. Contracts validate non-zero structure but do not map them to wallet addresses.

## Invite privacy boundary

Before consumption, on-chain Invite state exposes:

```text
commitment
expiry
exists / consumed state
InviteCreated / InviteConsumed events
```

The full Invite payload is not stored by `VinssInvite`.

The commitment is:

```text
Poseidon(
  VINSS_INVITE_V1,
  secret
)
```

### Important: consume reveals the secret

Invite consumption calldata is:

```text
[1, secret]
```

InvokeExternal calldata is public on-chain.

Therefore the Invite secret is a **one-time preimage**, not a forever-private on-chain secret.

The contract marks the Invite consumed in the same transaction so the revealed preimage cannot be used for another successful consumption of that Invite.

## Escrow Rekber privacy boundary

The public custody record contains:

```text
custody_commitment
release_commitment
refund_commitment
token
amount
refund_after
consumed
refunded
created_at
settled_at
```

Public events also expose:

```text
funded:
  custody commitment
  token
  amount
  refund boundary
  timestamp

released/refunded:
  custody commitment
  output note id
  timestamp
```

The contract intentionally does **not** store:

```text
buyer address
seller address
Deal Room id
conversation id
plaintext Offer / Escrow terms
public participant relationship
```

## Settlement preimage behavior

Before settlement:

```text
payer release authorization secret
payee claim secret
payer refund secret
  = client-held authorization preimages
```

At settlement, the used preimages are passed in public `privacy_invoke` calldata:

```text
release:
[2, custody_commitment, payer_release_secret, payee_claim_secret, output_note_id]

refund:
[3, custody_commitment, refund_secret, output_note_id]
```

So the selected secret becomes observable after use.

Security depends on:

- domain-separated commitment validation;
- independent payer/payee release authority;
- custody being unconsumed before settlement;
- the valid time window;
- atomic custody consumption.

Unused secrets remain sensitive client material.

## Metadata claim

Correct claim:

> VINSS keeps private deal semantics and direct participant identities out of plaintext helper state while exposing the minimum public structure required by the current execution/custody design.

Incorrect claims:

```text
no metadata
everything is hidden
Escrow Rekber amount is private
release/refund secret stays private forever
perfect anonymity
```
