# Discovery & Indexer

## Objective

The discovery subsystem provides a **keyless ciphertext transport/indexing path** for VINSS encrypted on-chain actions.

Endpoint:

```http
POST /discover
```

Supported kinds:

```text
message
offer
escrow
```

## Event mapping

```text
message → MessageCommitted
offer   → OfferActionCommitted
escrow  → PrivateEscrowActionCommitted
```

Contract selection is configuration-driven.

## Important indexer rule

The indexer scans helper events, not transaction sender identity.

Relevant mechanism:

```ts
const events = await rp.getEvents({
  address: contractAddress,
  from_block: { block_number: effectiveFromBlock },
  to_block: { block_number: effectiveToBlock },
  keys: [[EVENT_KEY_BY_KIND[kind]]],
  chunk_size: 100,
});
```

Each record is keyed by the action locator exposed by the helper event.

## Ciphertext retrieval

After event discovery, the backend reads the helper record and ciphertext chunks through view calls.

Record getter mapping:

```text
message → get_message
offer   → get_offer_action
escrow  → get_private_escrow_action
```

Chunk getter mapping:

```text
message → get_payload_chunk
offer   → get_offer_payload_chunk
escrow  → get_private_escrow_payload_chunk
```

Current retrieval performs one getter call per ciphertext chunk.

## Response shape

Typical result:

```json
{
  "actionLocator": "0x...",
  "payloadCommitment": "0x...",
  "senderTag": "0x...",
  "recipientTag": "0x...",
  "ciphertextChunks": ["123", "456"],
  "blockNumber": 123456,
  "transactionHash": "0x..."
}
```

The backend does not decide whether the record belongs to a specific private pair.

That matching happens in the authorized frontend.

## Default scan bound

When called with the default broad range:

```text
fromBlock = 0
toBlock   = latest
```

the current implementation changes the effective live scan to approximately the latest **10,000 blocks**.

Explicit caller-provided ranges preserve their requested bounds.

## Failure behavior

If a helper address is missing, discovery fails explicitly.

If RPC scanning/getters fail, the route returns a generic `500` response while the server logs only a safe error message.

## Scaling limitations

Current implementation is live RPC-backed discovery, not a durable background index.

Current costs include:

```text
event scan
+
record getter
+
N ciphertext chunk getters
```

Before high-volume mainnet use, likely hardening areas are:

- persistent cache of public encrypted records;
- background ingestion/checkpoints;
- pagination;
- RPC failover;
- request rate limiting.

Any optimization must preserve the no-key/no-decryption boundary.
