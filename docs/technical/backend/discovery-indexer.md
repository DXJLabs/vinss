# Discovery & Indexer

## Goal

The discovery subsystem provides a keyless way for clients to find VINSS encrypted on-chain actions.

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

## Flow

```mermaid
flowchart LR
    C[Client]
    -->|kind + block range| R[/discover]
    --> I[scanCommittedActions]
    --> E[Helper events]
    --> G[Helper getters]
    --> X[Ciphertext chunks]
    --> R
    -->|encrypted records| C
```

## Event families

The indexer maps discovery kinds to helper events:

```text
message → MessageCommitted
offer   → OfferActionCommitted
escrow  → PrivateEscrowActionCommitted
```

The associated contract address is selected from backend configuration.

## Public record returned

Typical discovery record:

```json
{
  "actionLocator": "0x...",
  "payloadCommitment": "0x...",
  "senderTag": "0x...",
  "recipientTag": "0x...",
  "ciphertextChunks": ["1", "2", "3"],
  "blockNumber": 123456,
  "transactionHash": "0x..."
}
```

Ciphertext chunks are serialized as strings because JSON does not support JavaScript `bigint`.

## Block-range behavior

The API accepts:

```json
{
  "kind": "message",
  "fromBlock": 0,
  "toBlock": "latest"
}
```

When the request uses the default genesis-to-latest shape, the current indexer bounds live discovery to the latest 10,000 blocks.

This avoids a single unbounded RPC scan.

Explicit caller-provided ranges keep their requested bounds.

## Ciphertext retrieval

After an event is found, the indexer calls the matching helper getter.

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

## Scaling considerations

The current implementation is a live RPC-backed indexer.

For mainnet scale, monitor:

- RPC event-query latency;
- RPC rate limits;
- number of committed actions in the scan window;
- number of chunk getter calls per action;
- `/discover` request frequency;
- duplicate scanning between users.

Potential future optimization must preserve the privacy boundary.

Good options:

- persistent cache of public ciphertext records;
- background event ingestion;
- block checkpoints;
- database indexes over public action locators;
- response pagination;
- RPC failover.

Avoid solving scale by:

- sending channel keys to the backend;
- server-side plaintext matching;
- introducing a public reusable conversation identifier without explicit privacy review.
