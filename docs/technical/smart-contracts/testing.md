# Smart Contract Testing

## Commands

```bash
cd ~/vinss/contracts

scarb build
snforge test
```

## Test files

```text
test_vinss_message_helper.cairo
test_vinss_offer_helper.cairo
test_vinss_private_escrow_helper.cairo
test_vinss_invite.cairo
test_vinss_escrow_rekber.cairo
```

## Message Helper

Current tests cover contract-level behavior including:

- deployment configuration;
- Privacy-Pool-only caller enforcement;
- V2 envelope validation;
- deterministic domain-separated Poseidon commitment;
- locator/ciphertext/version binding;
- ciphertext storage/getters;
- locator/commitment replay guards;
- event structure;
- 7 STRK revenue OpenNoteDeposit.

The product flow is also currently marked testnet on-chain verified.

## Offer Helper

Current tests verify:

- configured Privacy Pool;
- V2 storage;
- routing tags;
- ciphertext retrieval;
- 10 STRK revenue deposit;
- unauthorized caller rejection;
- zero routing-tag rejection;
- invalid commitment rejection;
- locator replay rejection;
- event routing tags.

The Offer product flow is currently marked testnet on-chain verified.

## Private Escrow Helper

Current tests verify:

- V2 encrypted coordination record;
- sender/recipient tags;
- ciphertext retrieval;
- empty OpenNoteDeposit output;
- Pool caller restriction;
- zero routing-tag rejection;
- invalid commitment rejection;
- locator replay rejection;
- event structure.

This proves the encrypted coordination helper, not full Rekber custody settlement.

## Invite

Current tests cover:

- constructor Pool configuration;
- create state;
- no output deposit;
- successful consume;
- duplicate create rejection;
- double-consume rejection;
- unknown secret rejection;
- expiry rules;
- unauthorized caller rejection.

## Escrow Rekber

Current dedicated test coverage is narrower.

The existing test verifies deposit-side economics/invariants:

```text
wallet-equivalent balance = principal + 2%
returned fee note         = 2%
stored custody amount     = full principal
reserved amount           = full principal
Pool allowance            = fee
```

The dedicated test file currently does **not** cover release and refund execution paths.

## Missing high-value tests

Before Escrow Rekber E2E verification, add/verify:

- release commitment success;
- wrong release secret rejection;
- release after refund boundary rejection;
- refund success at/after boundary;
- early refund rejection;
- wrong refund secret rejection;
- double settlement rejection;
- reserve accounting after settlement;
- exact allowance reset/pull behavior;
- cross-layer frontend/Cairo commitment vectors.

## Current known cross-layer failure

A cross-layer regression guard now requires the frontend and Cairo release/refund commitment domains to remain aligned.

This alignment removes the previous integration blocker but does not replace deployed E2E evidence.

## Test boundary

`snforge test` proves Cairo behavior under the test environment.

It does not by itself prove:

```text
Wallet API request shape
STRK20 Privacy Pool proof/execution
browser encryption
backend discovery
two-user E2E flow
mainnet deployment
```

Use explicit evidence labels for each layer.
