# VINSS Smart Contracts

VINSS contracts are the Cairo-owned application layer for encrypted onchain communication, negotiation, and private escrow workflows on Starknet.

VINSS does not replace or modify the Starknet Canonical Privacy Pool. Privacy Pool remains responsible for privacy primitives, note handling, nullifiers, proof verification, and private execution. VINSS owns product-level contracts and state transitions.

## Contract Modules

- `contracts/messaging/` - `VINSSChannelHelper`, encrypted timeline storage, and `privacy_invoke` compatibility.
- `contracts/offers/` - `VINSSOffer`, offer lifecycle, counter-offers, acceptance, cancellation, and escrow binding.
- `contracts/claim_escrow/` - private claim-link custody and claim validation.
- `contracts/private_escrow/` - private escrow action commitments.
- `contracts/private_escrow_settlement/` - private custody settlement through the Privacy Pool.
- `contracts/interfaces/` - shared Cairo interfaces and Privacy Pool-compatible return types.
- `contracts/events/` - shared event definitions.
- `contracts/utils/` - shared constants, hashing, validation, and time helpers.

## Starknet Sepolia Testnet Deployment

Last updated: 2026-08-15.

| Contract | Address | Class hash | Deploy transaction |
| --- | --- | --- | --- |
| `VinssMessageHelper` | `0x0173f5b0a94bc454084bed9892c6cee961b93abf8e1aaa63ff87c93ead63cf77` | `0x07a1f3489c4e62351812a99ed880e3bb1b35527845f87df39689f0f6f1e623ca` | `0x00a04d11cf7d90936cf7450b2ee08d247ef750838bfb22e9f3973d4cee0ec43d` |
| `VinssOfferHelper` | `0x0184a7c69e83f9b2ef9e6a0e0cf7f8680308e4701b715b8281037b91b3732bb9` | `0x05d6fec1f155f10666c97be54130cd55b4b808ad1fccc8c8d13d5fc65e7543d6` | `0x04d7de9b5dc7e38b3516daea9a5a3632adf2893306ff0fe1510d814ce0cf6030` |
| `VinssClaimEscrow` | `0x0345e61ed5e046ed4a7670b2a8a8b16c889f489cf95c6a326ae9b22253639280` | `0x04efbe39dd1ac0b77db29cdd6fab7b018b6d2876e2a3306b3ad0abbe0ef05946` | `0x0187c0b98d78d0c78d0f93d3a0c6639510f1d4b78196e795c845421fe41e454a` |
| `VinssPrivateEscrowHelper` | `0x01038379f1b0f876f719116eddc9c41d97e9e968f5dbec3ba603a9eb2211664a` | `0x033402e23b912c0b88528b223653c73472cef9ca597adaa2afafde2c5aa4a004` | `0x024cd65ac31f67aa6368885d732e15148b5410d16a6e512eeab4a959e91d077f` |
| `VinssPrivateEscrowSettlement` | `0x06973364950e28379b8784ac36fed200770aac9bd16502392a16e88e023ae6c7` | `0x04c84494c21f92d19979df307f1a4170983c1fa276a72c71e98d8760ced9e2de` | `0x025fe8dc77e247a3b5c26e715bab6564ca1e5c7b390628f8b0445c9a8636fb1d` |

### Privacy Pool

`0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91`

All five VINSS application contracts above were successfully deployed on Starknet Sepolia using the configured Privacy Pool address.

These addresses are **Sepolia testnet deployments only** and must not be used as Starknet Mainnet addresses.


## Detailed Docs

- [Messaging helper](../docs/contracts/messaging.md)
- [Offers](../docs/contracts/offers.md)
- [Privacy and security boundaries](../docs/contracts/privacy-and-security.md)

## Architecture Boundary

- `contracts/` is VINSS-owned Cairo code.
- `reference/contract/` and `reference/contracts/` are protocol references and must remain read-only unless explicitly updating the local reference.
- VINSS private escrow contracts are VINSS-owned. They are not Privacy Pool primitives.
- Shielded paths use Privacy Pool `InvokeExternal` into VINSS contracts where compatible.
- Direct helper paths must not be labeled as shielded.

## Validation Before Push

Run:

```bash
npm run build
npm run test:sdk
scarb --release build
snforge test
```

Do not push if build or tests fail.
