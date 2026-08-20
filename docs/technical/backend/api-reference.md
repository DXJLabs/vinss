# API Reference

Interactive API documentation is served by Swagger.

```text
GET /docs
GET /openapi.json
```

## System

### `GET /health`

Returns basic process/network health metadata.

Example:

```json
{
  "status": "ok",
  "network": "sepolia"
}
```

Note: this is currently a liveness-style response, not a full RPC/contract readiness probe.

## Discovery

### `POST /discover`

Discovers encrypted committed actions.

Request:

```json
{
  "kind": "message",
  "fromBlock": 0,
  "toBlock": "latest"
}
```

`kind`:

```text
message
offer
escrow
```

The API rejects `channelKeyHex`.

Response:

```json
[
  {
    "actionLocator": "0x...",
    "payloadCommitment": "0x...",
    "senderTag": "0x...",
    "recipientTag": "0x...",
    "ciphertextChunks": ["123"],
    "blockNumber": 123,
    "transactionHash": "0x..."
  }
]
```

## Presence

### `POST /presence/publish`

Request:

```json
{
  "channelId": "64-character-hex-id",
  "eventId": "opaque_event_id",
  "iv": "opaque-encoded-iv",
  "ciphertext": "opaque-encoded-ciphertext",
  "ttlMs": 60000
}
```

Successful response:

```text
204 No Content
```

### `POST /presence/poll`

Request:

```json
{
  "channelId": "64-character-hex-id"
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

Returns configured providers and available skills.

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

`provider` is optional.

The server sanitizes `context` again before provider execution.

## Loyalty

### `GET /loyalty/config`

Returns points and level rules.

### `GET /loyalty/:subject`

Returns the current in-process loyalty account.

### `POST /loyalty/events`

Request:

```json
{
  "subject": "user-or-account-subject",
  "action": "offer_created",
  "eventId": "unique-event-id"
}
```

See [Loyalty Service](./loyalty.md) before using this as production mainnet state.

## Error policy

Privacy-sensitive endpoints should return generic operational errors rather than upstream provider internals or secret-bearing context.

## Abuse protection

Swagger documents what exists; it does not provide access control.

Before a public mainnet launch, apply rate limits/authentication where required by [Mainnet Readiness](./mainnet-readiness.md).
