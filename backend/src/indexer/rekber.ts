import { hash, num, RpcProvider } from "starknet";

import type { AppConfig, StarknetNetwork } from "../config.js";
import type {
  IndexedRekberEvent,
  RekberEventKind,
  RekberIndexerCheckpointView,
} from "../types.js";
import { RekberStore } from "./rekberStore.js";

const EVENT_NAMES: Record<RekberEventKind, readonly string[]> = {
  funded: ["EscrowRekberCustodyFunded"],
  fulfillment_submitted: ["EscrowRekberFulfillmentSubmitted"],
  fulfillment_confirmed: ["EscrowRekberFulfillmentConfirmed"],
  revision_requested: ["EscrowRekberRevisionRequested"],
  dispute_opened: ["EscrowRekberDisputeOpened"],
  resolution_authorized: ["EscrowRekberDisputeResolutionAuthorized"],
  resolution_claimed: ["EscrowRekberResolutionClaimed"],
  released: ["EscrowRekberCustodyReleased"],
  refunded: ["EscrowRekberCustodyRefunded"],
  resolved: ["EscrowRekberCustodyResolved"],
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function canonicalFelt(value: string): string {
  return num.toHex(BigInt(value));
}

export function createRekberIndexerIdentity(
  network: StarknetNetwork,
  contractAddress: string,
): string {
  return `${network}:rekber:${contractAddress}`;
}

export class RekberEventSource {
  private readonly provider: RpcProvider;
  private readonly selectors: Record<RekberEventKind, string[]>;
  private readonly selectorToKind: Map<string, RekberEventKind>;

  constructor(
    rpcUrl: string,
    private readonly eventPageSize: number,
  ) {
    this.provider = new RpcProvider({ nodeUrl: rpcUrl });

    this.selectors = {
      funded: EVENT_NAMES.funded.map(hash.getSelectorFromName),
      fulfillment_submitted:
        EVENT_NAMES.fulfillment_submitted.map(hash.getSelectorFromName),
      fulfillment_confirmed:
        EVENT_NAMES.fulfillment_confirmed.map(hash.getSelectorFromName),
      revision_requested:
        EVENT_NAMES.revision_requested.map(hash.getSelectorFromName),
      dispute_opened:
        EVENT_NAMES.dispute_opened.map(hash.getSelectorFromName),
      resolution_authorized:
        EVENT_NAMES.resolution_authorized.map(hash.getSelectorFromName),
      resolution_claimed:
        EVENT_NAMES.resolution_claimed.map(hash.getSelectorFromName),
      released: EVENT_NAMES.released.map(hash.getSelectorFromName),
      refunded: EVENT_NAMES.refunded.map(hash.getSelectorFromName),
      resolved: EVENT_NAMES.resolved.map(hash.getSelectorFromName),
    };

    this.selectorToKind = new Map(
      (
        Object.entries(this.selectors) as Array<
          [RekberEventKind, string[]]
        >
      ).flatMap(([kind, selectors]) =>
        selectors.map(
          (selector) => [BigInt(selector).toString(), kind] as const,
        ),
      ),
    );
  }

  async getLatestBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async scan(
    config: AppConfig,
    fromBlock: number,
    toBlock: number,
  ): Promise<IndexedRekberEvent[]> {
    const events: IndexedRekberEvent[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.provider.getEvents({
        address: config.contracts.escrowRekber,
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        keys: [Object.values(this.selectors).flat()],
        chunk_size: this.eventPageSize,
        continuation_token: continuationToken,
      });

      for (const event of page.events) {
        const selector = event.keys[0];
        const custodyCommitment = event.keys[1];
        const thirdKey = event.keys[2];
        const blockNumber = event.block_number;
        const transactionHash = event.transaction_hash;

        if (
          !selector ||
          !custodyCommitment ||
          blockNumber === undefined ||
          !transactionHash
        ) {
          continue;
        }

        const eventKind = this.selectorToKind.get(BigInt(selector).toString());

        if (!eventKind) {
          continue;
        }

        const base = {
          network: config.network,
          eventKind,
          contractAddress: config.contracts.escrowRekber,
          custodyCommitment: canonicalFelt(custodyCommitment),
          timestamp: 0,
          blockNumber,
          transactionHash: canonicalFelt(transactionHash),
          indexedAt: new Date().toISOString(),
        } satisfies IndexedRekberEvent;

        if (eventKind === "funded") {
          if (!thirdKey || event.data.length < 3) {
            continue;
          }

          events.push({
            ...base,
            token: canonicalFelt(thirdKey),
            amount: BigInt(event.data[0] ?? "0").toString(),
            refundAfter: Number(BigInt(event.data[1] ?? "0")),
            timestamp: Number(BigInt(event.data[2] ?? "0")),
          });

          continue;
        }

        if (!thirdKey) {
          continue;
        }

        if (eventKind === "fulfillment_submitted") {
          if (event.data.length < 2) {
            continue;
          }

          events.push({
            ...base,
            timestamp: Number(BigInt(event.data[0] ?? "0")),
          });

          continue;
        }

        if (eventKind === "fulfillment_confirmed") {
          if (event.data.length < 2) {
            continue;
          }

          events.push({
            ...base,
            timestamp: Number(BigInt(event.data[1] ?? "0")),
          });

          continue;
        }

        if (eventKind === "revision_requested") {
          if (event.data.length < 3) {
            continue;
          }

          events.push({
            ...base,
            timestamp: Number(BigInt(event.data[1] ?? "0")),
          });

          continue;
        }

        if (eventKind === "dispute_opened") {
          if (event.data.length < 2) {
            continue;
          }

          events.push({
            ...base,
            timestamp: Number(BigInt(event.data[1] ?? "0")),
          });

          continue;
        }

        if (
          eventKind === "resolution_authorized" ||
          eventKind === "resolved"
        ) {
          if (event.data.length < 3) {
            continue;
          }

          events.push({
            ...base,
            resolutionCommitment: canonicalFelt(thirdKey),
            resolutionPayerAmount:
              BigInt(event.data[0] ?? "0").toString(),
            resolutionPayeeAmount:
              BigInt(event.data[1] ?? "0").toString(),
            timestamp: Number(BigInt(event.data[2] ?? "0")),
          });

          continue;
        }

        if (eventKind === "resolution_claimed") {
          if (event.data.length < 3) {
            continue;
          }

          events.push({
            ...base,
            outputNoteId: canonicalFelt(thirdKey),
            amount: BigInt(event.data[1] ?? "0").toString(),
            timestamp: Number(BigInt(event.data[2] ?? "0")),
          });

          continue;
        }

        if (event.data.length < 1) {
          continue;
        }

        events.push({
          ...base,
          outputNoteId: canonicalFelt(thirdKey),
          timestamp: Number(BigInt(event.data[0] ?? "0")),
        });
      }

      continuationToken = page.continuation_token || undefined;
    } while (continuationToken);

    return events;
  }
}

export class RekberIndexer {
  private stopRequested = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly source: RekberEventSource,
    private readonly store: RekberStore,
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

  async getStatus(): Promise<RekberIndexerCheckpointView> {
    return this.store.getCheckpoint(
      this.config.network,
      this.config.contracts.escrowRekber,
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

      console.error(`[rekber-indexer] latest block query failed: ${errorName}`);
      return;
    }

    try {
      await this.sync(latestBlock);
    } catch (error) {
      await this.store.setCheckpointStatus(
        this.config.network,
        this.config.contracts.escrowRekber,
        "error",
        latestBlock,
      );

      const errorName = error instanceof Error ? error.name : "UnknownError";

      console.error(
        `[rekber-indexer] ${createRekberIndexerIdentity(
          this.config.network,
          this.config.contracts.escrowRekber,
        )} sync failed: ${errorName}`,
      );
    }
  }

  private async sync(latestBlock: number): Promise<void> {
    let checkpoint = await this.store.getCheckpoint(
      this.config.network,
      this.config.contracts.escrowRekber,
    );

    if (checkpoint.nextBlock > latestBlock) {
      await this.store.setCheckpointStatus(
        this.config.network,
        this.config.contracts.escrowRekber,
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
        this.config.contracts.escrowRekber,
        "syncing",
        latestBlock,
      );

      const events = await this.source.scan(this.config, fromBlock, toBlock);

      await this.store.insertEvents(events);

      await this.store.advanceCheckpoint(
        this.config.network,
        this.config.contracts.escrowRekber,
        toBlock + 1,
        toBlock,
        latestBlock,
      );

      checkpoint = await this.store.getCheckpoint(
        this.config.network,
        this.config.contracts.escrowRekber,
      );
    }
  }
}
