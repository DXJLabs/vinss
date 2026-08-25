# Current Frontend Scope

This page prevents implemented foundations, tested behavior, and verified on-chain behavior from being conflated.

## Verification status

| Capability | Status |
|---|---|
| Two-party direct Message | Testnet on-chain verified |
| Direct pairwise encryption | Implemented |
| Opaque Message routing | Implemented |
| Ciphertext-only Message discovery | Implemented |
| Encrypted presence/read state | Implemented |
| Encrypted local chat cache | Implemented |
| Structured private Offer | Testnet on-chain verified |
| Offer lifecycle relationships | Implemented |
| Ciphertext-only Offer discovery | Implemented |
| Invite V3 encryption/commitment | Implemented |
| Escrow Rekber coordination | Implemented / integration stage |
| Canonical Rekber deposit/release/refund path | Implemented / Cairo tested / E2E pending |
| NFT Settlement Certificate | Implemented / Cairo tested / deployment pending |
| Mainnet STRK20 proof | Pending |

## Current privacy boundary

### Hidden/protected by current frontend design

- Message plaintext;
- Offer plaintext;
- direct participant metadata inside encrypted payloads;
- pairwise keys;
- messaging private ECDH key;
- encrypted presence payloads;
- Escrow Rekber release/refund secrets.

### Still public/observable

- transaction timing;
- helper/pool interaction;
- action locators;
- routing tags;
- commitments;
- ciphertext;
- current Escrow Rekber token/amount path.

## Not claimed

The frontend documentation does not claim:

```text
zero metadata
perfect anonymity
fully private Rekber settlement
mainnet verification
production security maturity
```

## Integration layer status

`frontend/lib/deal-room/` is application-internal.

It is not currently presented as a stable external SDK.
