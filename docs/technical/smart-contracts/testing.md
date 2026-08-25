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
test_vinss_settlement_certificate.cairo
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

The 7 STRK build requires redeployment and fresh E2E evidence.

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

The 10 STRK build requires redeployment and fresh E2E evidence.

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

Current tests cover full-principal reservation, 2% fee output, two-secret release, secret-role separation, timeout refund, early-refund rejection, and replay rejection after release.

## Settlement Certificate

Current tests cover successful payer/payee claims, pre-settlement rejection, refunded-custody rejection, caller-address binding, and claim replay rejection.

## Cross-layer guard

`scripts/test-privacy-boundaries.mjs` compares the active frontend settlement domains with the canonical Cairo commitment module. It also rejects reintroduction of the paid legacy `prepare_escrow` Offer path.

High-value remaining work is deployed two-wallet E2E evidence for release, refund, Ready X output-note construction, and certificate rendering.

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
