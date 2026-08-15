# VINSS Backend — Ciphertext-Only Discovery Indexer

The VINSS backend exposes `POST /discover` as a public-data discovery
transport. It scans VINSS helper-contract events, fetches encrypted payload
chunks, and returns ciphertext plus public blockchain metadata.

**The backend is not a decryption server.**

## Privacy boundary

```text
Client → local encryption → Privacy Pool / InvokeExternal → Helper
       → Starknet → VINSS Indexer → ciphertext only → Client → local decryption
```

The backend must never receive or process channel keys, room secrets, viewing
keys, plaintext messages, or decrypted payloads.

`POST /discover` rejects requests containing `channelKeyHex`.

## Discovery API

Request:

```json
{
  "kind": "message",
  "fromBlock": 0,
  "toBlock": "latest"
}
```

Response:

```json
[
  {
    "actionLocator": "0x...",
    "payloadCommitment": "0x...",
    "ciphertextChunks": ["0x...", "0x..."],
    "blockNumber": 123,
    "transactionHash": "0x..."
  }
]
```

Ciphertext chunks are strings because JSON cannot represent JavaScript
`bigint` values.

## Discovery and scaling

VINSS intentionally has no reusable public channel/conversation identifier
in the encrypted message record. The backend therefore returns ciphertext
for committed actions and the client determines channel membership by local
decryption.

This is a privacy boundary, not a claim that discovery is infinitely
scalable. At high mainnet volume, the amount of public ciphertext the client
must inspect becomes an indexing/performance problem. Do not solve that by
reintroducing server-side decryption or a public channel ID.

## Structure

- `src/config.ts` — RPC URL and contract addresses.
- `src/indexer/poolEvents.ts` — helper event scanning and ciphertext retrieval.
- `src/routes/discover.ts` — keyless ciphertext-only discovery API.
- `src/agent/` — agent tools with an explicit no-signing boundary.

`src/indexer/decrypt.ts` has intentionally been removed. Decryption belongs to
the VINSS client.
