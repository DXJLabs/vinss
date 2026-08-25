# VINSS Smart Contracts

VINSS contracts are the Cairo application layer invoked through the configured STRK20 Privacy Pool.

## Contracts

- `VinssInvite`
- `VinssMessageHelper`
- `VinssOfferHelper`
- `VinssPrivateEscrowHelper`
- `VinssEscrowRekber`
- `VinssSettlementCertificate`

`VinssMessageHelper`, `VinssOfferHelper`, and `VinssPrivateEscrowHelper` persist encrypted envelopes without plaintext application semantics. `VinssEscrowRekber` is the single supported custody contract. `VinssSettlementCertificate` provides optional public ERC-721 evidence after a successful Rekber release.

## Rekber source

```text
src/escrow_rekber/
├── commitments.cairo
├── errors.cairo
├── events.cairo
├── interfaces.cairo
├── types.cairo
└── vinss_escrow_rekber.cairo
```

The canonical Rekber requires the payer release-authorization secret and the independent payee claim secret. Timeout refund remains a payer recovery path. The removed legacy unilateral-release implementation is not compiled.

## Revenue

```text
VinssMessageHelper  7 STRK per private message
VinssOfferHelper    10 STRK per Offer action
VinssEscrowRekber   2% of secured principal at funding
```

## Build and test

```bash
cd ~/vinss/contracts
scarb build
snforge test
```

See [`../docs/technical/smart-contracts/README.md`](../docs/technical/smart-contracts/README.md) for boundaries and verification status.
