# Backend Configuration

## Objective

Backend configuration separates deployment-specific public infrastructure from server-side secrets and prevents accidental environment mixing.

## Runtime

| Variable | Purpose | Current fallback |
|---|---|---|
| `PORT` | HTTP port | `4000` |
| `STARKNET_NETWORK` | `sepolia` / `mainnet` | `sepolia` |
| `RPC_URL` | Starknet RPC | Sepolia RPC |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:3000` |

## Contract addresses

```text
PRIVACY_POOL_ADDRESS
MESSAGE_HELPER_ADDRESS
OFFER_HELPER_ADDRESS
PRIVATE_ESCROW_HELPER_ADDRESS
ESCROW_REKBER_ADDRESS
```

Current configuration permits empty contract-address values and fails later when a required address is used.

Mainnet hardening should fail closed earlier.

## Agent configuration

```text
VINSS_FEE_BPS
VINSS_LLM_PROVIDER
VINSS_LLM_FALLBACKS
```

Provider credentials/model settings may include:

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

## Important fee distinction

`VINSS_FEE_BPS` is consumed by the backend Agent fee-calculation tool.

It must not be treated as proof that every VINSS financial path uses the same fee.

The current Escrow Rekber fee path is implemented separately in frontend/contract integration code.

## Mainnet configuration rule

Do not rely on development fallbacks.

Explicitly configure:

```env
STARKNET_NETWORK=mainnet
RPC_URL=<verified-mainnet-rpc>
CORS_ORIGIN=https://<production-origin>

PRIVACY_POOL_ADDRESS=<verified-address>
MESSAGE_HELPER_ADDRESS=<verified-address>
OFFER_HELPER_ADDRESS=<verified-address>
PRIVATE_ESCROW_HELPER_ADDRESS=<verified-address>
ESCROW_REKBER_ADDRESS=<verified-address>
```

## Secret boundary

Never:

- commit provider API keys;
- expose provider keys through frontend public environment variables;
- log the environment;
- include production secrets in docs or screenshots.

Production secrets belong in server-side environment/secret management.
