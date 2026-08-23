import type { Pool, PoolClient } from "pg";

import type { StarknetNetwork } from "../config.js";
import type {
  CertificateIndexerCheckpointView,
  GlobalActivityItem,
  IndexedCertificateEvent,
  IndexerCheckpointStatus,
} from "../types.js";

interface CertificateCheckpointRow {
  network: StarknetNetwork;
  contract_address: string;
  start_block: string;
  next_block: string;
  last_indexed_block: string | null;
  latest_observed_block: string | null;
  status: IndexerCheckpointStatus;
  updated_at: Date | string;
}

interface CertificateEventRow {
  network: StarknetNetwork;
  contract_address: string;
  token_id: string;
  recipient: string;
  custody_commitment: string;
  role: string;
  settled_at: string;
  issued_at: string;
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
  return `${network}:certificate:${contractAddress}`;
}

function toEvent(row: CertificateEventRow): IndexedCertificateEvent {
  return {
    network: row.network,
    contractAddress: row.contract_address,
    tokenId: row.token_id,
    recipient: row.recipient,
    custodyCommitment: row.custody_commitment,
    role: Number(row.role) as 1 | 2,
    settledAt: Number(row.settled_at),
    issuedAt: Number(row.issued_at),
    blockNumber: Number(row.block_number),
    transactionHash: row.transaction_hash,
    indexedAt: toIsoString(row.indexed_at),
  };
}

export class CertificateStore {
  constructor(private readonly pool: Pool) {}

  async initialize(params: {
    network: StarknetNetwork;
    contractAddress: string;
    startBlock: number;
  }): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS settlement_certificate_events (
        network TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        token_id TEXT NOT NULL,
        recipient TEXT NOT NULL,
        custody_commitment TEXT NOT NULL,
        role SMALLINT NOT NULL CHECK (role IN (1, 2)),
        settled_at BIGINT NOT NULL,
        issued_at BIGINT NOT NULL,
        block_number BIGINT NOT NULL,
        transaction_hash TEXT NOT NULL,
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (network, contract_address, token_id)
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS settlement_certificate_activity_idx
      ON settlement_certificate_events (
        network,
        block_number DESC,
        transaction_hash DESC,
        token_id DESC
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS certificate_indexer_checkpoints (
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
        INSERT INTO certificate_indexer_checkpoints (
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
        `Configured certificate start block does not match stored checkpoint: ${checkpoint.identity}`,
      );
    }
  }

  async getCheckpoint(
    network: StarknetNetwork,
    contractAddress: string,
  ): Promise<CertificateIndexerCheckpointView> {
    const result = await this.pool.query<CertificateCheckpointRow>(
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
        FROM certificate_indexer_checkpoints
        WHERE network = $1
          AND contract_address = $2
      `,
      [network, contractAddress],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        `Missing certificate checkpoint: ${identity(network, contractAddress)}`,
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
        UPDATE certificate_indexer_checkpoints
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
        UPDATE certificate_indexer_checkpoints
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

  async insertEvents(
    events: readonly IndexedCertificateEvent[],
  ): Promise<void> {
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
    event: IndexedCertificateEvent,
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO settlement_certificate_events (
          network,
          contract_address,
          token_id,
          recipient,
          custody_commitment,
          role,
          settled_at,
          issued_at,
          block_number,
          transaction_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (network, contract_address, token_id) DO NOTHING
      `,
      [
        event.network,
        event.contractAddress,
        event.tokenId,
        event.recipient,
        event.custodyCommitment,
        event.role,
        event.settledAt,
        event.issuedAt,
        event.blockNumber,
        event.transactionHash,
      ],
    );
  }

  async recentActivity(
    network: StarknetNetwork,
    contractAddress: string,
    options: {
      limit: number;
      cursor?: ActivityCursor;
    },
  ): Promise<GlobalActivityItem[]> {
    const cursor = options.cursor ?? null;

    const result = await this.pool.query<CertificateEventRow>(
      `
        SELECT
          network,
          contract_address,
          token_id,
          recipient,
          custody_commitment,
          role::text,
          settled_at::text,
          issued_at::text,
          block_number::text,
          transaction_hash,
          indexed_at
        FROM settlement_certificate_events
        WHERE network = $1
          AND contract_address = $2
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
              AND token_id < $5
            )
          )
        ORDER BY
          block_number DESC,
          transaction_hash DESC,
          token_id DESC
        LIMIT $6
      `,
      [
        network,
        contractAddress,
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
        kind: "certificate_issued",
        contractAddress: event.contractAddress,
        actionLocator: event.tokenId,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        indexedAt: event.indexedAt,
        certificate: {
          tokenId: event.tokenId,
          recipient: event.recipient,
          custodyCommitment: event.custodyCommitment,
          role: event.role,
          settledAt: event.settledAt,
          issuedAt: event.issuedAt,
        },
      };
    });
  }
}
