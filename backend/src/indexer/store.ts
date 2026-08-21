import type { Pool, PoolClient } from "pg";

import type { StarknetNetwork } from "../config.js";
import type {
  DiscoverKind,
  DiscoveredAction,
  GlobalActivityItem,
  IndexedAction,
  IndexerCheckpointStatus,
  IndexerCheckpointView,
} from "../types.js";
import type { IndexerDefinition } from "./definitions.js";

interface CheckpointRow {
  network: StarknetNetwork;
  kind: DiscoverKind;
  contract_address: string;
  start_block: string;
  next_block: string;
  last_indexed_block: string | null;
  latest_observed_block: string | null;
  status: IndexerCheckpointStatus;
  updated_at: Date | string;
}

interface IndexedActionRow {
  network: StarknetNetwork;
  kind: DiscoverKind;
  contract_address: string;
  action_locator: string;
  payload_commitment: string;
  sender_tag: string | null;
  recipient_tag: string | null;
  ciphertext_chunks: string[];
  block_number: string;
  transaction_hash: string;
  indexed_at: Date | string;
}

interface ActivityRow {
  network: StarknetNetwork;
  kind: DiscoverKind;
  contract_address: string;
  action_locator: string;
  block_number: string;
  transaction_hash: string;
  indexed_at: Date | string;
}

interface ActivityCursor {
  blockNumber: number;
  transactionHash: string;
  actionLocator: string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toCheckpointView(
  row: CheckpointRow,
  identity: string,
): IndexerCheckpointView {
  return {
    identity,
    kind: row.kind,
    contractAddress: row.contract_address,
    startBlock: Number(row.start_block),
    nextBlock: Number(row.next_block),
    lastIndexedBlock:
      row.last_indexed_block === null ? null : Number(row.last_indexed_block),
    latestObservedBlock:
      row.latest_observed_block === null
        ? null
        : Number(row.latest_observed_block),
    status: row.status,
    updatedAt: toIsoString(row.updated_at),
  };
}

function toIndexedAction(row: IndexedActionRow): IndexedAction {
  return {
    network: row.network,
    kind: row.kind,
    contractAddress: row.contract_address,
    actionLocator: row.action_locator,
    payloadCommitment: row.payload_commitment,
    senderTag: row.sender_tag ?? undefined,
    recipientTag: row.recipient_tag ?? undefined,
    ciphertextChunks: row.ciphertext_chunks,
    blockNumber: Number(row.block_number),
    transactionHash: row.transaction_hash,
    indexedAt: toIsoString(row.indexed_at),
  };
}

export class DiscoveryStore {
  constructor(private readonly pool: Pool) {}

  async initialize(
    definitions: readonly IndexerDefinition[],
  ): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS discovery_records (
        network TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('message', 'offer', 'escrow')),
        contract_address TEXT NOT NULL,
        action_locator TEXT NOT NULL,
        payload_commitment TEXT NOT NULL,
        sender_tag TEXT,
        recipient_tag TEXT,
        ciphertext_chunks TEXT[] NOT NULL,
        block_number BIGINT NOT NULL,
        transaction_hash TEXT NOT NULL,
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (network, kind, contract_address, action_locator)
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS discovery_records_lookup_idx
      ON discovery_records (
        network,
        kind,
        contract_address,
        block_number
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS discovery_records_activity_idx
      ON discovery_records (
        network,
        block_number DESC,
        transaction_hash DESC,
        action_locator DESC
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS indexer_checkpoints (
        network TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('message', 'offer', 'escrow')),
        contract_address TEXT NOT NULL,
        start_block BIGINT NOT NULL,
        next_block BIGINT NOT NULL,
        last_indexed_block BIGINT,
        latest_observed_block BIGINT,
        status TEXT NOT NULL CHECK (
          status IN ('idle', 'syncing', 'caught_up', 'error')
        ),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (network, kind, contract_address)
      )
    `);

    for (const definition of definitions) {
      await this.ensureCheckpoint(definition);
    }
  }

  async ensureCheckpoint(
    definition: IndexerDefinition,
  ): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO indexer_checkpoints (
          network,
          kind,
          contract_address,
          start_block,
          next_block,
          status
        )
        VALUES ($1, $2, $3, $4, $4, 'idle')
        ON CONFLICT (network, kind, contract_address) DO NOTHING
      `,
      [
        definition.network,
        definition.kind,
        definition.contractAddress,
        definition.startBlock,
      ],
    );

    const checkpoint = await this.getCheckpoint(definition);

    if (checkpoint.startBlock !== definition.startBlock) {
      throw new Error(
        `Configured start block does not match stored checkpoint: ${definition.identity}`,
      );
    }
  }

  async getCheckpoint(
    definition: IndexerDefinition,
  ): Promise<IndexerCheckpointView> {
    const result = await this.pool.query<CheckpointRow>(
      `
        SELECT
          network,
          kind,
          contract_address,
          start_block::text,
          next_block::text,
          last_indexed_block::text,
          latest_observed_block::text,
          status,
          updated_at
        FROM indexer_checkpoints
        WHERE network = $1
          AND kind = $2
          AND contract_address = $3
      `,
      [
        definition.network,
        definition.kind,
        definition.contractAddress,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(`Missing checkpoint: ${definition.identity}`);
    }

    return toCheckpointView(row, definition.identity);
  }

  async listCheckpoints(
    definitions: readonly IndexerDefinition[],
  ): Promise<Record<DiscoverKind, IndexerCheckpointView>> {
    const entries = await Promise.all(
      definitions.map(async (definition) => [
        definition.kind,
        await this.getCheckpoint(definition),
      ] as const),
    );

    return Object.fromEntries(entries) as Record<
      DiscoverKind,
      IndexerCheckpointView
    >;
  }

  async setCheckpointStatus(
    definition: IndexerDefinition,
    status: IndexerCheckpointStatus,
    latestObservedBlock: number | null,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE indexer_checkpoints
        SET status = $4,
            latest_observed_block = $5,
            updated_at = NOW()
        WHERE network = $1
          AND kind = $2
          AND contract_address = $3
      `,
      [
        definition.network,
        definition.kind,
        definition.contractAddress,
        status,
        latestObservedBlock,
      ],
    );
  }

  async advanceCheckpoint(
    definition: IndexerDefinition,
    nextBlock: number,
    lastIndexedBlock: number,
    latestObservedBlock: number,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE indexer_checkpoints
        SET next_block = $4,
            last_indexed_block = $5,
            latest_observed_block = $6,
            status = CASE
              WHEN $4 > $6 THEN 'caught_up'
              ELSE 'syncing'
            END,
            updated_at = NOW()
        WHERE network = $1
          AND kind = $2
          AND contract_address = $3
      `,
      [
        definition.network,
        definition.kind,
        definition.contractAddress,
        nextBlock,
        lastIndexedBlock,
        latestObservedBlock,
      ],
    );
  }

  async findExistingLocators(
    definition: IndexerDefinition,
    locators: readonly string[],
  ): Promise<Set<string>> {
    if (locators.length === 0) {
      return new Set();
    }

    const result = await this.pool.query<{ action_locator: string }>(
      `
        SELECT action_locator
        FROM discovery_records
        WHERE network = $1
          AND kind = $2
          AND contract_address = $3
          AND action_locator = ANY($4::text[])
      `,
      [
        definition.network,
        definition.kind,
        definition.contractAddress,
        locators,
      ],
    );

    return new Set(result.rows.map((row) => row.action_locator));
  }

  async insertActions(
    actions: readonly IndexedAction[],
  ): Promise<void> {
    if (actions.length === 0) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const action of actions) {
        await this.insertAction(client, action);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertAction(
    client: PoolClient,
    action: IndexedAction,
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO discovery_records (
          network,
          kind,
          contract_address,
          action_locator,
          payload_commitment,
          sender_tag,
          recipient_tag,
          ciphertext_chunks,
          block_number,
          transaction_hash
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10
        )
        ON CONFLICT (
          network,
          kind,
          contract_address,
          action_locator
        ) DO NOTHING
      `,
      [
        action.network,
        action.kind,
        action.contractAddress,
        action.actionLocator,
        action.payloadCommitment,
        action.senderTag ?? null,
        action.recipientTag ?? null,
        action.ciphertextChunks,
        action.blockNumber,
        action.transactionHash,
      ],
    );
  }

  async discover(
    definition: IndexerDefinition,
    fromBlock: number,
    toBlock: number | "latest",
  ): Promise<DiscoveredAction[]> {
    const upperBound = toBlock === "latest" ? null : toBlock;

    const result = await this.pool.query<IndexedActionRow>(
      `
        SELECT
          network,
          kind,
          contract_address,
          action_locator,
          payload_commitment,
          sender_tag,
          recipient_tag,
          ciphertext_chunks,
          block_number::text,
          transaction_hash,
          indexed_at
        FROM discovery_records
        WHERE network = $1
          AND kind = $2
          AND contract_address = $3
          AND block_number >= $4
          AND ($5::bigint IS NULL OR block_number <= $5)
        ORDER BY block_number ASC, transaction_hash ASC, action_locator ASC
      `,
      [
        definition.network,
        definition.kind,
        definition.contractAddress,
        fromBlock,
        upperBound,
      ],
    );

    return result.rows.map((row) => {
      const action = toIndexedAction(row);

      return {
        actionLocator: action.actionLocator,
        payloadCommitment: action.payloadCommitment,
        senderTag: action.senderTag,
        recipientTag: action.recipientTag,
        ciphertextChunks: action.ciphertextChunks,
        blockNumber: action.blockNumber,
        transactionHash: action.transactionHash,
      };
    });
  }

  async recentActivity(
    network: StarknetNetwork,
    options: {
      limit: number;
      kind?: DiscoverKind;
      cursor?: ActivityCursor;
    },
  ): Promise<GlobalActivityItem[]> {
    const kind = options.kind ?? null;
    const cursor = options.cursor ?? null;

    const result = await this.pool.query<ActivityRow>(
      `
        SELECT
          network,
          kind,
          contract_address,
          action_locator,
          block_number::text,
          transaction_hash,
          indexed_at
        FROM discovery_records
        WHERE network = $1
          AND ($2::text IS NULL OR kind = $2)
          AND (
            $3::bigint IS NULL
            OR block_number < $3
            OR (
              block_number = $3
              AND transaction_hash < $4
            )
            OR (
              block_number = $3
              AND transaction_hash = $4
              AND action_locator < $5
            )
          )
        ORDER BY
          block_number DESC,
          transaction_hash DESC,
          action_locator DESC
        LIMIT $6
      `,
      [
        network,
        kind,
        cursor?.blockNumber ?? null,
        cursor?.transactionHash ?? null,
        cursor?.actionLocator ?? null,
        options.limit,
      ],
    );

    return result.rows.map((row) => ({
      network: row.network,
      kind: row.kind,
      contractAddress: row.contract_address,
      actionLocator: row.action_locator,
      blockNumber: Number(row.block_number),
      transactionHash: row.transaction_hash,
      indexedAt: toIsoString(row.indexed_at),
    }));
  }
}
