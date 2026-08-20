# Privacy & Security

## Core security objective

The VINSS backend must remain useful without becoming capable of reading private deal content.

## Data classification

### Must remain client-side

| Data                           | Backend   |
| ------------------------------ | --------- |
| Message plaintext              | Forbidden |
| Offer plaintext terms          | Forbidden |
| Room secret                    | Forbidden |
| Channel key                    | Forbidden |
| Pairwise key                   | Forbidden |
| Viewing key                    | Forbidden |
| Wallet private key             | Forbidden |
| Decrypted conversation history | Forbidden |

### May pass through the backend

| Data                            | Reason                |
| ------------------------------- | --------------------- |
| Ciphertext chunks               | Discovery transport   |
| Payload commitment              | Public chain metadata |
| Action locator                  | Public helper record  |
| Opaque sender/recipient tags    | Helper event metadata |
| Block number                    | Public chain metadata |
| Transaction hash                | Public chain metadata |
| Encrypted presence envelope     | Temporary relay       |
| Sanitized Agent metadata        | Remote reasoning      |
| Loyalty application identifiers | Application service   |

## Ciphertext-only discovery boundary

`POST /discover` explicitly rejects `channelKeyHex`.

```ts
if ("channelKeyHex" in body) {
  return res.status(400).json({
    error: "channelKeyHex is not accepted. Discovery is ciphertext-only.",
  });
}
```

This is a network boundary, not merely a UI convention.

## Client-side matching

VINSS does not add a reusable public conversation identifier solely to make server indexing easier.

The backend can return candidate encrypted records; channel membership is determined by client-side cryptographic processing.

This deliberately trades some indexing efficiency for metadata resistance.

## Sender attribution

The indexer reads VINSS helper events rather than treating a normal transaction sender as the private user identity.

Private operations pass through the privacy infrastructure, so the privacy layer/helper context is not equivalent to a public user address.

## Agent boundary

The Agent has two separate defenses:

1. **context sanitation** — arbitrary private context is not forwarded as-is;
2. **tool authorization** — each active skill has a code-enforced tool allowlist.

```ts
if (!skill.allowedTools.includes(name)) {
  throw new Error(`Tool not allowed for ${skill.id} skill: ${name}`);
}
```

The model cannot grant itself a transaction execution tool.

## Logging

The Express request logger records only:

```text
METHOD PATH
```

Request bodies are intentionally excluded.

Provider failures are also logged without raw upstream error details because an upstream error can echo request content.

## Presence privacy

Presence storage receives only:

```text
channelId
eventId
iv
ciphertext
ttl
```

The backend should not receive plaintext event semantics or cryptographic room/pairwise keys.

## Security assumptions

VINSS still depends on external infrastructure:

- Starknet RPC correctness/availability;
- deployed helper-contract correctness;
- wallet behavior;
- privacy-pool behavior;
- LLM provider availability for optional Agent functionality;
- Railway/runtime security for backend execution.

The backend privacy model minimizes sensitive server knowledge but does not eliminate infrastructure risk.

## Mainnet rules

Before mainnet:

- use explicit mainnet RPC;
- use verified mainnet helper addresses;
- restrict CORS to production origins;
- keep LLM keys server-side;
- add abuse protection to public/costly endpoints;
- replace or explicitly disable non-durable product state;
- run privacy tests on every release;
- never log request bodies or secrets.

See [Mainnet Readiness](./mainnet-readiness.md).
