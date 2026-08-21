import type { AppConfig } from "../config.js";
import type {
  DiscoverKind,
  IndexedAction,
  IndexerCheckpointView,
} from "../types.js";
import type { IndexerDefinition } from "./definitions.js";
import type { RawCommittedAction } from "./poolEvents.js";
import { StarknetEventSource } from "./poolEvents.js";
import { DiscoveryStore } from "./store.js";

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const output = new Array<TOutput>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      output[index] = await worker(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker(),
  );

  await Promise.all(workers);

  return output;
}

export class DiscoveryIndexer {
  private stopRequested = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly definitions: readonly IndexerDefinition[],
    private readonly source: StarknetEventSource,
    private readonly store: DiscoveryStore,
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

  async getStatus(): Promise<
    Record<DiscoverKind, IndexerCheckpointView>
  > {
    return this.store.listCheckpoints(this.definitions);
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
      console.error(`[indexer] latest block query failed: ${errorName}`);
      return;
    }

    for (const definition of this.definitions) {
      if (this.stopRequested) {
        return;
      }

      try {
        await this.syncDefinition(definition, latestBlock);
      } catch (error) {
        await this.store.setCheckpointStatus(
          definition,
          "error",
          latestBlock,
        );

        const errorName =
          error instanceof Error ? error.name : "UnknownError";

        console.error(
          `[indexer] ${definition.identity} sync failed: ${errorName}`,
        );
      }
    }
  }

  private async syncDefinition(
    definition: IndexerDefinition,
    latestBlock: number,
  ): Promise<void> {
    let checkpoint = await this.store.getCheckpoint(definition);

    if (checkpoint.nextBlock > latestBlock) {
      await this.store.setCheckpointStatus(
        definition,
        "caught_up",
        latestBlock,
      );
      return;
    }

    while (
      checkpoint.nextBlock <= latestBlock &&
      !this.stopRequested
    ) {
      const fromBlock = checkpoint.nextBlock;
      const toBlock = Math.min(
        latestBlock,
        fromBlock + this.config.indexer.blockRange - 1,
      );

      await this.store.setCheckpointStatus(
        definition,
        "syncing",
        latestBlock,
      );

      const committed = await this.source.scanCommittedActions(
        definition,
        fromBlock,
        toBlock,
      );

      const existingLocators =
        await this.store.findExistingLocators(
          definition,
          committed.map((action) => action.actionLocator),
        );

      const missing = committed.filter(
        (action) => !existingLocators.has(action.actionLocator),
      );

      const indexedActions = await mapWithConcurrency(
        missing,
        this.config.indexer.fetchConcurrency,
        async (action) =>
          this.hydrateAction(definition, action),
      );

      await this.store.insertActions(indexedActions);

      await this.store.advanceCheckpoint(
        definition,
        toBlock + 1,
        toBlock,
        latestBlock,
      );

      checkpoint = await this.store.getCheckpoint(definition);
    }
  }

  private async hydrateAction(
    definition: IndexerDefinition,
    action: RawCommittedAction,
  ): Promise<IndexedAction> {
    const ciphertextChunks =
      await this.source.fetchCiphertextChunks(
        definition,
        action.actionLocator,
      );

    return {
      network: definition.network,
      kind: definition.kind,
      contractAddress: definition.contractAddress,
      actionLocator: action.actionLocator,
      payloadCommitment: action.payloadCommitment,
      senderTag: action.senderTag,
      recipientTag: action.recipientTag,
      ciphertextChunks,
      blockNumber: action.blockNumber,
      transactionHash: action.transactionHash,
      indexedAt: new Date().toISOString(),
    };
  }
}
