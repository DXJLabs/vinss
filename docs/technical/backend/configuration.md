# Configuration

Backend configuration is loaded from environment variables.

## Core runtime

| Variable           | Purpose                   |
| ------------------ | ------------------------- |
| `PORT`             | HTTP port, default `4000` |
| `STARKNET_NETWORK` | `sepolia` or `mainnet`    |
| `RPC_URL`          | Starknet RPC endpoint     |
| `CORS_ORIGIN`      | Allowed frontend origin   |

## Contracts

| Variable                        | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `PRIVACY_POOL_ADDRESS`          | STRK20 Privacy Pool                  |
| `MESSAGE_HELPER_ADDRESS`        | Messaging helper                     |
| `OFFER_HELPER_ADDRESS`          | Offer helper                         |
| `PRIVATE_ESCROW_HELPER_ADDRESS` | Private escrow helper                |
| `ESCROW_REKBER_ADDRESS`         | Settlement/rekber contract reference |

## Agent

| Variable              | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `VINSS_FEE_BPS`       | Fee basis points used by Agent calculation tools |
| `VINSS_LLM_PROVIDER`  | Preferred provider                               |
| `VINSS_LLM_FALLBACKS` | Provider fallback order                          |

Provider credentials/model variables may include:

```text
GROQ_API_KEY
GROQ_MODEL

OPENAI_API_KEY
OPENAI_MODEL
OPENAI_BASE_URL

ANTHROPIC_API_KEY
ANTHROPIC_MODEL
ANTHROPIC_BASE_URL
ANTHROPIC_VERSION
ANTHROPIC_MAX_TOKENS

QWEN_API_KEY
DASHSCOPE_API_KEY
QWEN_MODEL
QWEN_BASE_URL
```

## Mainnet configuration rules

Do not rely on development defaults for a mainnet launch.

Explicitly set:

```env
STARKNET_NETWORK=mainnet
RPC_URL=<mainnet RPC>

PRIVACY_POOL_ADDRESS=<verified mainnet address>
MESSAGE_HELPER_ADDRESS=<verified mainnet address>
OFFER_HELPER_ADDRESS=<verified mainnet address>
PRIVATE_ESCROW_HELPER_ADDRESS=<verified mainnet address>
ESCROW_REKBER_ADDRESS=<verified mainnet address>

CORS_ORIGIN=https://<production-vinss-origin>
```

## Secret handling

Never:

- commit API keys to Git;
- expose provider keys through `NEXT_PUBLIC_*`;
- log environment contents;
- paste production secrets into documentation.

Use Railway/environment secret management for production credentials.

## Current configuration caveat

The current code has a Sepolia RPC fallback.

That is convenient for development but means mainnet operations must set `RPC_URL` explicitly.

A production hardening improvement is to fail closed when `STARKNET_NETWORK=mainnet` but a required mainnet RPC/contract address is missing.
