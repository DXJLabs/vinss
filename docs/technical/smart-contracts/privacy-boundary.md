# Privacy & Trust Boundary

## What the contracts do not receive as plaintext

The current Message and Offer helpers do not accept explicit fields for:

```text
wallet sender address
wallet recipient address
stable conversation id
room id
plaintext message
Offer terms
Offer lifecycle relationship
asset / amount / payment terms
```

Private application semantics are encrypted by the client before helper invocation.

## Public on-chain information

Observers can see that the helper was invoked and can observe:

```text
helper contract address
transaction/block timing
envelope version
one-time locator
sender routing tag
recipient routing tag
payload commitment
ciphertext chunk count
ciphertext
```

Therefore VINSS should be described as reducing plaintext and direct relationship metadata, not eliminating all metadata.

## Routing tags

`sender_tag` and `recipient_tag` are opaque application-derived values.

The contracts validate that they are non-zero but do not map them to wallet addresses.

## Contract authorization

The helper authorization boundary is the configured Privacy Pool.

This prevents direct writes that bypass the intended Privacy Pool invocation path.

It does not by itself prove that the encrypted application sender is authorized to perform every private business action. Private application semantics and user decisions remain client/application concerns.

## Replay / duplicate protection

The helpers independently reject:

- a reused one-time locator;
- a reused encrypted payload commitment.

This helper-level protection is separate from replay/nullifier rules enforced by the Privacy Pool transaction.
