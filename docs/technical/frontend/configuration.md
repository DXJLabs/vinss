# Frontend Configuration

## Objective

Frontend configuration separates deployment-specific public addresses from private credentials and keeps Sepolia/mainnet environments explicit.

## Core

```text
NEXT_PUBLIC_STARKNET_NETWORK
NEXT_PUBLIC_RPC_URL
NEXT_PUBLIC_BACKEND_URL
```

## Contracts / application addresses

```text
NEXT_PUBLIC_PRIVACY_POOL_ADDRESS
NEXT_PUBLIC_MESSAGE_HELPER_ADDRESS
NEXT_PUBLIC_MESSAGE_HELPER_OPEN_NOTE_TOKEN
NEXT_PUBLIC_INVITE_ADDRESS
NEXT_PUBLIC_OFFER_HELPER_ADDRESS
NEXT_PUBLIC_OFFER_HELPER_OPEN_NOTE_TOKEN
NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS
NEXT_PUBLIC_ESCROW_REKBER_ADDRESS
NEXT_PUBLIC_STRK_ADDRESS
NEXT_PUBLIC_VINSS_TREASURY_ADDRESS
```

## Public environment boundary

Every `NEXT_PUBLIC_*` variable is client-visible.

Never put these values there:

```text
wallet private key
room secret
pairwise private key
channel key
Escrow Rekber release/refund secret
server API secret
LLM provider key
```

## Address normalization

Contract/token addresses are normalized once in `lib/starknet/constants.ts` using `num.toHex()`.

This prevents strict Wallet API felt validation from rejecting zero-padded addresses.

## Current code-defined revenue

Current Message path:

```text
0.5 STRK per submitted private Message action
```

Current Offer path:

```text
1 STRK per submitted Offer action
```

Current Escrow Rekber deposit path:

```text
1% of principal
```

These are implementation facts from current code and should not be confused with generic UI fee quoting helpers.

## Environment consistency

Frontend network, RPC URL, backend, and deployed helper addresses must point to the same Starknet environment.
