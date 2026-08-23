import { hash, num, RpcProvider } from "starknet";

import type { AppConfig, StarknetNetwork } from "../config.js";
import type {
  CertificateIndexerCheckpointView,
  IndexedCertificateEvent,
} from "../types.js";
import { CertificateStore } from "./certificateStore.js";

const EVENT_SELECTOR = hash.getSelectorFromName("SettlementCertificateIssued");

interface RawCertificateEvent {
  keys: string[];
  data: string[];
  block_number?: number;
  transaction_hash?: string;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function canonicalFelt(value: string): string {
  return num.toHex(BigInt(value));
}

function safeNumber(value: string): number | null {
  const parsed = Number(BigInt(value));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function createCertificateIndexerIdentity(
  network: StarknetNetwork,
  contractAddress: string,
): string {
  return `${network}:certificate:${contractAddress}`;
}

export function decodeCertificateEvent(
  config: AppConfig,
  event: RawCertificateEvent,
): IndexedCertificateEvent | null {
  const selector = event.keys[0];
  const tokenId = event.keys[1];
  const recipient = event.keys[2];
  const custodyCommitment = event.data[0];
  const rawRole = event.data[1];
  const rawSettledAt = event.data[2];
  const rawIssuedAt = event.data[3];

  if (
    !selector ||
    !tokenId ||
    !recipient ||
    !custodyCommitment ||
    !rawRole ||
    !rawSettledAt ||
    !rawIssuedAt ||
    event.block_number === undefined ||
    !event.transaction_hash ||
    BigInt(selector) !== BigInt(EVENT_SELECTOR)
  ) {
    return null;
  }

  const role = safeNumber(rawRole);
  const settledAt = safeNumber(rawSettledAt);
  const issuedAt = safeNumber(rawIssuedAt);

  if ((role !== 1 && role !== 2) || settledAt === null || issuedAt === null) {
    return null;
  }

  return {
    network: config.network,
    contractAddress: config.contracts.settlementCertificate,
    tokenId: canonicalFelt(tokenId),
    recipient: canonicalFelt(recipient),
    custodyCommitment: canonicalFelt(custodyCommitment),
    role,
    settledAt,
    issuedAt,
    blockNumber: event.block_number,
    transactionHash: canonicalFelt(event.transaction_hash),
    indexedAt: new Date().toISOString(),
  };
}

export class CertificateEventSource {
  private readonly provider: RpcProvider;

  constructor(
    rpcUrl: string,
    private readonly eventPageSize: number,
  ) {
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });
  }

  async getLatestBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async scan(
    config: AppConfig,
    fromBlock: number,
    toBlock: number,
  ): Promise<IndexedCertificateEvent[]> {
    const events: IndexedCertificateEvent[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.provider.getEvents({
        address: config.contracts.settlementCertificate,
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        keys: [[EVENT_SELECTOR]],
        chunk_size: this.eventPageSize,
        continuation_token: continuationToken,
      });

      for (const rawEvent of page.events) {
        const event = decodeCertificateEvent(config, rawEvent);

        if (event) {
          events.push(event);
        }
      }

      continuationToken = page.continuation_token || undefined;
    } while (continuationToken);

    return events;
  }
}

export class CertificateIndexer {
  private stopRequested = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly source: CertificateEventSource,
    private readonly store: CertificateStore,
  ) {}

  start(): void {
    if (this.loopPromise) {
      return;
    }

    this.stopRequested = false;
    this.loopPromise = this.runLoop().finally(() => {
      this.loopPromise = null;
    });
  }

  async stop(): Promise<void> {
    this.stopRequested = true;

    if (this.loopPromise) {
      await this.loopPromise;
    }
  }

  async getStatus(): Promise<CertificateIndexerCheckpointView> {
    return this.store.getCheckpoint(
      this.config.network,
      this.config.contracts.settlementCertificate,
    );
  }

  private async runLoop(): Promise<void> {
    while (!this.stopRequested) {
      await this.runCycle();

      if (!this.stopRequested) {
        await sleep(this.config.indexer.pollIntervalMs);
      }
    }
  }

  private async runCycle(): Promise<void> {
    let latestBlock: number;

    try {
      latestBlock = await this.source.getLatestBlockNumber();
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error(
        `[certificate-indexer] latest block query failed: ${errorName}`,
      );
      return;
    }

    try {
      await this.sync(latestBlock);
    } catch (error) {
      await this.store.setCheckpointStatus(
        this.config.network,
        this.config.contracts.settlementCertificate,
        "error",
        latestBlock,
      );

      const errorName = error instanceof Error ? error.name : "UnknownError";

      console.error(
        `[certificate-indexer] ${createCertificateIndexerIdentity(
          this.config.network,
          this.config.contracts.settlementCertificate,
        )} sync failed: ${errorName}`,
      );
    }
  }

  private async sync(latestBlock: number): Promise<void> {
    let checkpoint = await this.store.getCheckpoint(
      this.config.network,
      this.config.contracts.settlementCertificate,
    );

    if (checkpoint.nextBlock > latestBlock) {
      await this.store.setCheckpointStatus(
        this.config.network,
        this.config.contracts.settlementCertificate,
        "caught_up",
        latestBlock,
      );
      return;
    }

    while (checkpoint.nextBlock <= latestBlock && !this.stopRequested) {
      const fromBlock = checkpoint.nextBlock;
      const toBlock = Math.min(
        latestBlock,
        fromBlock + this.config.indexer.blockRange - 1,
      );

      await this.store.setCheckpointStatus(
        this.config.network,
        this.config.contracts.settlementCertificate,
        "syncing",
        latestBlock,
      );

      const events = await this.source.scan(this.config, fromBlock, toBlock);

      await this.store.insertEvents(events);

      await this.store.advanceCheckpoint(
        this.config.network,
        this.config.contracts.settlementCertificate,
        toBlock + 1,
        toBlock,
        latestBlock,
      );

      checkpoint = await this.store.getCheckpoint(
        this.config.network,
        this.config.contracts.settlementCertificate,
      );
    }
  }
}
