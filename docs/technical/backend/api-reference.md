# Backend API Reference

Interactive API documentation:

```text
GET /docs
GET /openapi.json
```

## System

### `GET /health`

Current response:

```json
{
  "status": "ok",
  "network": "sepolia"
}
```

This is a liveness/configuration response, not a complete dependency readiness probe.

## Discovery

### `POST /discover`

Request:

```json
{
  "kind": "message",
  "fromBlock": 0,
  "toBlock": "latest"
}
```

Allowed `kind`:

```text
message
offer
escrow
```

`channelKeyHex` is explicitly rejected.

Response record:

```json
{
  "actionLocator": "0x...",
  "payloadCommitment": "0x...",
  "senderTag": "0x...",
  "recipientTag": "0x...",
  "ciphertextChunks": ["123"],
  "blockNumber": 123,
  "transactionHash": "0x..."
}
```

## Presence

### `POST /presence/publish`

Request:

```json
{
  "channelId": "64-character-lowercase-hex",
  "eventId": "opaque_event_id",
  "iv": "opaque-encoded-iv",
  "ciphertext": "opaque-encoded-ciphertext",
  "ttlMs": 60000
}
```

Success:

```text
204 No Content
```

### `POST /presence/poll`

Request:

```json
{
  "channelId": "64-character-lowercase-hex"
}
```

Response:

```json
{
  "events": [
    {
      "eventId": "...",
      "iv": "...",
      "ciphertext": "...",
      "createdAt": 0,
      "expiresAt": 0
    }
  ]
}
```

## Agent

### `GET /agent/providers`

Returns:

```text
defaultProvider
configuredProviders
skills
```

### `POST /agent`

Request:

```json
{
  "message": "Review the current deal state",
  "context": {},
  "skill": "offer",
  "provider": "groq"
}
```

Skills:

```text
chat
offer
escrow
```

Provider selection:

```text
auto
groq
openai
anthropic
qwen
```

The server sanitizes `context` before Agent execution.

The explicit `message` string is remote-provider input.

## Loyalty — auxiliary

```text
GET  /loyalty/config
GET  /loyalty/:subject
POST /loyalty/events
```

This API is current in-memory application state, not production settlement state.

## Error boundary

Privacy-sensitive endpoints should return bounded/generic operational errors rather than raw upstream content that could echo request data.

## Public API hardening

Before public mainnet use, add abuse protection to costly/public endpoints.

CORS is not authentication.
