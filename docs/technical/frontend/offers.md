# Private Offers

## Status

**Testnet on-chain verified.**

## Objective

Private Offers convert negotiation from free-form conversation into immutable encrypted deal actions while preserving a relationship between Offer actions.

## Current deal classification

The encrypted payload can classify a deal as:

```text
otc
freelance
goods
digital_goods
bounty
nft
other
```

The product rationale for each type belongs in Product Documentation.

## Current lifecycle

The code supports:

```text
create
counter
accept
reject
cancel
expire
prepare_escrow
```

Each action receives its own fresh locator.

## Encrypted payload

Offer data can contain:

```text
senderAddress
recipientAddress
sentAt
dealType
rootOfferLocator
parentOfferLocator
asset
amount
paymentTerms
conditions
expiresAt
reason
```

Those fields are encrypted before helper submission.

## Immutable action pattern

The lifecycle wrappers all call the same encrypted action sender:

```ts
sendOfferAction(
  account,
  channelKey,
  { ...payload, kind: "counter" },
  route,
  onPrepared,
);
```

The action kind is part of the encrypted payload.

## Commitment

VINSS commits to the exact encrypted Offer envelope:

```ts
const inputs = [
  shortStringToFelt("VINSS_OFFER_COMMIT_V2"),
  BigInt(OFFER_ENVELOPE_VERSION),
  actionLocator,
  senderTag,
  recipientTag,
  BigInt(ciphertextChunks.length),
  ...ciphertextChunks,
];
```

## STRK20 execution

The current Offer path submits:

```text
withdraw
→ transfer OPEN to treasury
→ invoke Offer Helper
```

through:

```ts
account.strk20InvokeTransaction(...)
```

The current code routes **1 STRK** application revenue per submitted Offer action.

## Discovery and binding

The backend returns ciphertext plus opaque routing metadata.

The frontend:

1. derives candidate pairwise routes;
2. matches recipient tag;
3. decrypts locally;
4. validates sender-tag binding;
5. validates encrypted recipient identity;
6. merges by immutable action locator.

## Agreement linkage

`rootOfferLocator` and `parentOfferLocator` preserve Offer relationships inside encrypted state.

`prepare_escrow` is the transition used to connect the accepted agreement to Escrow Rekber.

## Mobile wallet recovery

Prepared locator/commitment metadata is reflected before wallet handoff.

Delayed callbacks are treated as recoverable pending states and reconciled through Offer discovery.
