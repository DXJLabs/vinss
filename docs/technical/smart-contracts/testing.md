# Smart Contract Testing

## Commands

```bash
cd ~/vinss/contracts

scarb build
snforge test
```

## Message helper tests

`test_vinss_message_helper.cairo` covers contract-level behavior including:

- deployment configuration;
- Privacy-Pool-only caller enforcement;
- envelope validation;
- deterministic Poseidon commitment;
- locator binding;
- ciphertext-order binding;
- envelope-version binding;
- ciphertext storage;
- guarded reads;
- one-time locator protection;
- discovery event structure;
- 0.5 STRK revenue `OpenNoteDeposit`.

## Offer helper tests

`test_vinss_offer_helper.cairo` verifies:

- configured Privacy Pool;
- successful V2 record storage;
- sender/recipient routing tags;
- ciphertext chunk retrieval;
- 1 STRK revenue deposit;
- rejection of non-Pool callers;
- rejection of zero routing tags;
- rejection of invalid commitment;
- locator replay rejection;
- V2 event routing tags.

## Test boundary

Cairo tests validate helper behavior.

Wallet execution, Privacy Pool proof construction, browser encryption, backend discovery, and two-user E2E behavior are separate integration layers and must not be claimed as proven solely by `snforge test`.
