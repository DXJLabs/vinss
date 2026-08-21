import { RpcProvider } from "starknet";

import type { IndexerDefinition } from "./definitions.js";

const MAX_CIPHERTEXT_CHUNKS = 4_096;

export interface RawCommittedAction {
  actionLocator: string;
  payloadCommitment: string;
  senderTag?: string;
  recipientTag?: string;
  blockNumber: number;
  transactionHash: string;
}

export class StarknetEventSource {
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

  async scanCommittedActions(
    definition: IndexerDefinition,
    fromBlock: number,
    toBlock: number,
  ): Promise<RawCommittedAction[]> {
    const actions: RawCommittedAction[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.provider.getEvents({
        address: definition.contractAddress,
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        keys: [[definition.eventSelector]],
        chunk_size: this.eventPageSize,
        continuation_token: continuationToken,
      });

      for (const event of page.events) {
        const actionLocator = event.keys[1];
        const payloadCommitment = event.data[0];
        const blockNumber = event.block_number;
        const transactionHash = event.transaction_hash;

        if (
          !actionLocator ||
          !payloadCommitment ||
          blockNumber === undefined ||
          !transactionHash
        ) {
          continue;
        }

        actions.push({
          actionLocator,
          payloadCommitment,
          senderTag: event.data[1],
          recipientTag: event.data[2],
          blockNumber,
          transactionHash,
        });
      }

      continuationToken = page.continuation_token || undefined;
    } while (continuationToken);

    return actions;
  }

  async fetchCiphertextChunks(
    definition: IndexerDefinition,
    actionLocator: string,
  ): Promise<string[]> {
    const record = await this.provider.callContract({
      contractAddress: definition.contractAddress,
      entrypoint: definition.recordGetter,
      calldata: [actionLocator],
    });

    const chunkCount = Number(BigInt(record.at(-1) ?? "0"));

    if (
      !Number.isSafeInteger(chunkCount) ||
      chunkCount < 0 ||
      chunkCount > MAX_CIPHERTEXT_CHUNKS
    ) {
      throw new Error("Invalid ciphertext chunk count.");
    }

    const chunks: string[] = [];

    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = await this.provider.callContract({
        contractAddress: definition.contractAddress,
        entrypoint: definition.chunkGetter,
        calldata: [actionLocator, String(index)],
      });

      chunks.push(String(BigInt(chunk[0] ?? "0")));
    }

    return chunks;
  }
}
