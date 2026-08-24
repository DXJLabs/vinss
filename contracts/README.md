# VINSS Smart Contracts

VINSS smart contracts are the Cairo application layer used by the current private Chat and Offer flows on Starknet.

VINSS does **not** replace or modify the STRK20 Privacy Pool. The Privacy Pool remains the privacy/execution substrate. VINSS helper contracts receive application-specific encrypted calldata through the configured Privacy Pool.

## Current documented scope

This README and `docs/technical/smart-contracts/` currently document:

- `VinssMessageHelper`
- `VinssOfferHelper`

Other contract modules may exist in the repository but are outside this documentation scope and are not presented here as completed MVP functionality.

## Source structure

```text
src/
├── messaging/
│   ├── messaging_events.cairo
│   ├── messaging_interfaces.cairo
│   ├── messaging_types.cairo
│   ├── messaging_validation.cairo
│   ├── timeline_payload_hash.cairo
│   └── vinss_message_helper.cairo
│
├── offers/
│   ├── offer_commitments.cairo
│   ├── offer_events.cairo
│   ├── offer_interfaces.cairo
│   ├── offer_types.cairo
│   ├── offer_validation.cairo
│   └── vinss_offer.cairo
│
├── interfaces/
├── utils/
└── tests/
```

## Core boundary

Both current helpers:

- accept writes only from the Privacy Pool address pinned at deployment;
- store public encrypted-envelope structure and ciphertext;
- do not receive plaintext message or Offer terms;
- do not receive public wallet addresses as sender/recipient fields;
- use one-time opaque routing tags;
- validate a domain-separated Poseidon commitment;
- reject locator reuse;
- expose read methods used by ciphertext discovery.

## Current revenue behavior

```text
VinssMessageHelper   7 STRK per submitted private message
VinssOfferHelper     10 STRK per submitted Offer action
VinssEscrowRekberV2  2% of the secured ERC-20 principal at funding
```

The frontend constructs the corresponding STRK20 action bundle. The helper returns an `OpenNoteDeposit` for the configured revenue token and amount.

## Build and test

```bash
cd ~/vinss/contracts

scarb build
snforge test
```

## Technical documentation

Start at [`../docs/technical/smart-contracts/README.md`](../docs/technical/smart-contracts/README.md).
