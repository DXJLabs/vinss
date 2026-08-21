import { hash } from "starknet";

import type { AppConfig, StarknetNetwork } from "../config.js";
import type { DiscoverKind } from "../types.js";

export interface IndexerDefinition {
  identity: string;
  network: StarknetNetwork;
  kind: DiscoverKind;
  contractAddress: string;
  startBlock: number;
  eventSelector: string;
  recordGetter: string;
  chunkGetter: string;
}

export function createIndexerIdentity(
  network: StarknetNetwork,
  kind: DiscoverKind,
  contractAddress: string,
): string {
  return `${network}:${kind}:${contractAddress}`;
}

export function createIndexerDefinitions(
  config: AppConfig,
): IndexerDefinition[] {
  const common = {
    network: config.network,
  };

  const definitions: Array<
    Omit<IndexerDefinition, "identity" | "eventSelector"> & {
      eventName: string;
    }
  > = [
    {
      ...common,
      kind: "message",
      contractAddress: config.contracts.messageHelper,
      startBlock: config.indexer.startBlocks.message,
      eventName: "MessageCommitted",
      recordGetter: "get_message",
      chunkGetter: "get_payload_chunk",
    },
    {
      ...common,
      kind: "offer",
      contractAddress: config.contracts.offerHelper,
      startBlock: config.indexer.startBlocks.offer,
      eventName: "OfferActionCommitted",
      recordGetter: "get_offer_action",
      chunkGetter: "get_offer_payload_chunk",
    },
    {
      ...common,
      kind: "escrow",
      contractAddress: config.contracts.privateEscrowHelper,
      startBlock: config.indexer.startBlocks.escrow,
      eventName: "PrivateEscrowActionCommitted",
      recordGetter: "get_private_escrow_action",
      chunkGetter: "get_private_escrow_payload_chunk",
    },
  ];

  return definitions.map(({ eventName, ...definition }) => ({
    ...definition,
    identity: createIndexerIdentity(
      definition.network,
      definition.kind,
      definition.contractAddress,
    ),
    eventSelector: hash.getSelectorFromName(eventName),
  }));
}

export function getIndexerDefinition(
  definitions: readonly IndexerDefinition[],
  kind: DiscoverKind,
): IndexerDefinition {
  const definition = definitions.find((item) => item.kind === kind);

  if (!definition) {
    throw new Error(`Missing indexer definition for kind: ${kind}`);
  }

  return definition;
}
