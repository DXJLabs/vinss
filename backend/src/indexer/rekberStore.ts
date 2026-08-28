import type { Pool, PoolClient } from "pg";

import type { StarknetNetwork } from "../config.js";
import type {
  GlobalActivityItem,
  IndexedRekberEvent,
  IndexerCheckpointStatus,
  RekberEventKind,
  RekberIndexerCheckpointView,
} from "../types.js";

interface RekberCheckpointRow {
  network: StarknetNetwork;
  contract_address: string;
  start_block: string;
  next_block: string;
  last_indexed_block: string | null;
  latest_observed_block: string | null;
  status: IndexerCheckpointStatus;
  updated_at: Date | string;
}

interface RekberEventRow {
  network: StarknetNetwork;
  event_kind: RekberEventKind;
  contract_address: string;
  custody_commitment: string;
  token: string | null;
  amount: string | null;
  refund_after: string | null;
  output_note_id: string | null;
  resolution_commitment: string | null;
  resolution_payer_amount: string | null;
  resolution_payee_amount: string | null;
  event_timestamp: string;
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
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function identity(network: StarknetNetwork, contractAddress: string): string {
  return `${network}:rekber:${contractAddress}`;
}

function toEvent(row: RekberEventRow): IndexedRekberEvent {
  return {
    network: row.network,
    eventKind: row.event_kind,
    contractAddress: row.contract_address,
    custodyCommitment: row.custody_commitment,
    token: row.token ?? undefined,
    amount: row.amount ?? undefined,
    refundAfter:
      row.refund_after === null ? undefined : Number(row.refund_after),
    outputNoteId: row.output_note_id ?? undefined,
    resolutionCommitment:
      row.resolution_commitment ?? undefined,
    resolutionPayerAmount:
      row.resolution_payer_amount ?? undefined,
    resolutionPayeeAmount:
      row.resolution_payee_amount ?? undefined,
    timestamp: Number(row.event_timestamp),
    blockNumber: Number(row.block_number),
    transactionHash: row.transaction_hash,
    indexedAt: toIsoString(row.indexed_at),
  };
}

export class RekberStore {
  constructor(private readonly pool: Pool) {}

  async initialize(params: {
    network: StarknetNetwork;
    contractAddress: string;
    startBlock: number;
  }): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rekber_events (
        network TEXT NOT NULL,
        event_kind TEXT NOT NULL CHECK (
          event_kind IN ('funded', 'released', 'refunded', 'resolved')
        ),
        contract_address TEXT NOT NULL,
        custody_commitment TEXT NOT NULL,
        token TEXT,
        amount TEXT,
        refund_after BIGINT,
        output_note_id TEXT,
        resolution_commitment TEXT,
        resolution_payer_amount NUMERIC(78, 0),
        resolution_payee_amount NUMERIC(78, 0),
        event_timestamp BIGINT NOT NULL,
        block_number BIGINT NOT NULL,
        transaction_hash TEXT NOT NULL,
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (
          network,
          contract_address,
          transaction_hash,
          event_kind,
          custody_commitment
        )
      )
    `);

    // Existing deployments predate the resolved event; migrate in place.
    await this.pool.query(`
      ALTER TABLE rekber_events
        ADD COLUMN IF NOT EXISTS resolution_commitment TEXT,
        ADD COLUMN IF NOT EXISTS resolution_payer_amount NUMERIC(78, 0),
        ADD COLUMN IF NOT EXISTS resolution_payee_amount NUMERIC(78, 0)
    `);

    await this.pool.query(`
      ALTER TABLE rekber_events
        DROP CONSTRAINT IF EXISTS rekber_events_event_kind_check
    `);

    await this.pool.query(`
      ALTER TABLE rekber_events
        ADD CONSTRAINT rekber_events_event_kind_check
        CHECK (
          event_kind IN (
            'funded',
            'released',
            'refunded',
            'resolved'
          )
        )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS rekber_events_lookup_idx
      ON rekber_events (
        network,
        contract_address,
        custody_commitment,
        block_number
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS rekber_events_activity_idx
      ON rekber_events (
        network,
        block_number DESC,
        transaction_hash DESC,
        custody_commitment DESC
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rekber_indexer_checkpoints (
        network TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        start_block BIGINT NOT NULL,
        next_block BIGINT NOT NULL,
        last_indexed_block BIGINT,
        latest_observed_block BIGINT,
        status TEXT NOT NULL CHECK (
          status IN ('idle', 'syncing', 'caught_up', 'error')
        ),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (network, contract_address)
      )
    `);

    await this.pool.query(
      `
        INSERT INTO rekber_indexer_checkpoints (
          network,
          contract_address,
          start_block,
          next_block,
          status
        )
        VALUES ($1, $2, $3, $3, 'idle')
        ON CONFLICT (network, contract_address) DO NOTHING
      `,
      [params.network, params.contractAddress, params.startBlock],
    );

    const checkpoint = await this.getCheckpoint(
      params.network,
      params.contractAddress,
    );

    if (checkpoint.startBlock !== params.startBlock) {
      throw new Error(
        `Configured Rekber start block does not match stored checkpoint: ${checkpoint.identity}`,
      );
    }
  }

  async getCheckpoint(
    network: StarknetNetwork,
    contractAddress: string,
  ): Promise<RekberIndexerCheckpointView> {
    const result = await this.pool.query<RekberCheckpointRow>(
      `
        SELECT
          network,
          contract_address,
          start_block::text,
          next_block::text,
          last_indexed_block::text,
          latest_observed_block::text,
          status,
          updated_at
        FROM rekber_indexer_checkpoints
        WHERE network = $1
          AND contract_address = $2
      `,
      [network, contractAddress],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        `Missing Rekber checkpoint: ${identity(network, contractAddress)}`,
      );
    }

    return {
      identity: identity(network, contractAddress),
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

  async setCheckpointStatus(
    network: StarknetNetwork,
    contractAddress: string,
    status: IndexerCheckpointStatus,
    latestObservedBlock: number | null,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE rekber_indexer_checkpoints
        SET status = $3,
            latest_observed_block = $4,
            updated_at = NOW()
        WHERE network = $1
          AND contract_address = $2
      `,
      [network, contractAddress, status, latestObservedBlock],
    );
  }

  async advanceCheckpoint(
    network: StarknetNetwork,
    contractAddress: string,
    nextBlock: number,
    lastIndexedBlock: number,
    latestObservedBlock: number,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE rekber_indexer_checkpoints
        SET next_block = $3::bigint,
            last_indexed_block = $4::bigint,
            latest_observed_block = $5::bigint,
            status = CASE
              WHEN $3::bigint > $5::bigint THEN 'caught_up'
              ELSE 'syncing'
            END,
            updated_at = NOW()
        WHERE network = $1
          AND contract_address = $2
      `,
      [
        network,
        contractAddress,
        nextBlock,
        lastIndexedBlock,
        latestObservedBlock,
      ],
    );
  }

  async insertEvents(events: readonly IndexedRekberEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const event of events) {
        await this.insertEvent(client, event);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertEvent(
    client: PoolClient,
    event: IndexedRekberEvent,
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO rekber_events (
          network,
          event_kind,
          contract_address,
          custody_commitment,
          token,
          amount,
          refund_after,
          output_note_id,
          resolution_commitment,
          resolution_payer_amount,
          resolution_payee_amount,
          event_timestamp,
          block_number,
          transaction_hash
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14
        )
        ON CONFLICT (
          network,
          contract_address,
          transaction_hash,
          event_kind,
          custody_commitment
        ) DO NOTHING
      `,
      [
        event.network,
        event.eventKind,
        event.contractAddress,
        event.custodyCommitment,
        event.token ?? null,
        event.amount ?? null,
        event.refundAfter ?? null,
        event.outputNoteId ?? null,
        event.resolutionCommitment ?? null,
        event.resolutionPayerAmount ?? null,
        event.resolutionPayeeAmount ?? null,
        event.timestamp,
        event.blockNumber,
        event.transactionHash,
      ],
    );
  }

  async listEvents(
    network: StarknetNetwork,
    contractAddress: string,
    options: {
      limit: number;
      eventKind?: RekberEventKind;
      custodyCommitment?: string;
    },
  ): Promise<IndexedRekberEvent[]> {
    const result = await this.pool.query<RekberEventRow>(
      `
        SELECT
          network,
          event_kind,
          contract_address,
          custody_commitment,
          token,
          amount,
          refund_after::text,
          output_note_id,
          resolution_commitment,
          resolution_payer_amount::text,
          resolution_payee_amount::text,
          event_timestamp::text,
          block_number::text,
          transaction_hash,
          indexed_at
        FROM rekber_events
        WHERE network = $1
          AND contract_address = $2
          AND ($3::text IS NULL OR event_kind = $3)
          AND ($4::text IS NULL OR custody_commitment = $4)
        ORDER BY
          block_number DESC,
          transaction_hash DESC,
          custody_commitment DESC
        LIMIT $5
      `,
      [
        network,
        contractAddress,
        options.eventKind ?? null,
        options.custodyCommitment ?? null,
        options.limit,
      ],
    );

    return result.rows.map(toEvent);
  }

  async recentActivity(
    network: StarknetNetwork,
    contractAddress: string,
    options: {
      limit: number;
      eventKind?: RekberEventKind;
      cursor?: ActivityCursor;
    },
  ): Promise<GlobalActivityItem[]> {
    const cursor = options.cursor ?? null;

    const result = await this.pool.query<RekberEventRow>(
      `
        SELECT
          network,
          event_kind,
          contract_address,
          custody_commitment,
          token,
          amount,
          refund_after::text,
          output_note_id,
          resolution_commitment,
          resolution_payer_amount::text,
          resolution_payee_amount::text,
          event_timestamp::text,
          block_number::text,
          transaction_hash,
          indexed_at
        FROM rekber_events
        WHERE network = $1
          AND contract_address = $2
          AND ($3::text IS NULL OR event_kind = $3)
          AND (
            $4::bigint IS NULL
            OR block_number < $4
            OR (
              block_number = $4
              AND transaction_hash < $5
            )
            OR (
              block_number = $4
              AND transaction_hash = $5
              AND custody_commitment < $6
            )
          )
        ORDER BY
          block_number DESC,
          transaction_hash DESC,
          custody_commitment DESC
        LIMIT $7
      `,
      [
        network,
        contractAddress,
        options.eventKind ?? null,
        cursor?.blockNumber ?? null,
        cursor?.transactionHash ?? null,
        cursor?.actionLocator ?? null,
        options.limit,
      ],
    );

    return result.rows.map((row) => {
      const event = toEvent(row);

      return {
        network: event.network,
        kind: `rekber_${event.eventKind}`,
        contractAddress: event.contractAddress,
        actionLocator: event.custodyCommitment,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        indexedAt: event.indexedAt,
        rekber: {
          eventKind: event.eventKind,
          custodyCommitment: event.custodyCommitment,
          token: event.token,
          amount: event.amount,
          refundAfter: event.refundAfter,
          outputNoteId: event.outputNoteId,
          resolutionCommitment:
            event.resolutionCommitment,
          resolutionPayerAmount:
            event.resolutionPayerAmount,
          resolutionPayeeAmount:
            event.resolutionPayeeAmount,
          timestamp: event.timestamp,
        },
      };
    });
  }
}
