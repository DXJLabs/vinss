# Frontend Configuration

## Core

```text
NEXT_PUBLIC_STARKNET_NETWORK
NEXT_PUBLIC_RPC_URL
NEXT_PUBLIC_BACKEND_URL
```

## Contracts and application addresses

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

`NEXT_PUBLIC_*` values are client-visible. Never put wallet private keys, room secrets, LLM provider keys, or server credentials there.

## Revenue vs generic fee display

Do not confuse generic fee quoting configuration with the fixed action revenue currently encoded in message/Offer submission:

```text
Message  0.5 STRK
Offer    1 STRK
```

Development currently falls back to Sepolia when explicit network/RPC configuration is absent.
