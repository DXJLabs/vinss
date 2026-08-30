import { Router, type Request, type Response } from "express";

import type { AppConfig } from "../config.js";
import type { RekberEventKind } from "../types.js";
import { RekberStore } from "../indexer/rekberStore.js";

const VALID_EVENTS: readonly RekberEventKind[] = [
  "funded",
  "fulfillment_submitted",
  "fulfillment_confirmed",
  "revision_requested",
  "dispute_opened",
  "resolution_authorized",
  "resolution_claimed",
  "released",
  "refunded",
  "resolved",
];

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return 50;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("limit must be an integer from 1 to 100.");
  }

  return parsed;
}

function parseEventKind(value: unknown): RekberEventKind | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (VALID_EVENTS.includes(value as RekberEventKind)) {
    return value as RekberEventKind;
  }

  throw new Error(`event must be one of: ${VALID_EVENTS.join(", ")}`);
}

function parseCustodyCommitment(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error("custodyCommitment must be a 0x-prefixed felt.");
  }

  const numeric = BigInt(value);

  if (numeric <= 0n || numeric >= 1n << 251n) {
    throw new Error("custodyCommitment is outside the Starknet felt range.");
  }

  return `0x${numeric.toString(16)}`;
}

export function createRekberRouter(
  store: RekberStore,
  config: AppConfig,
): Router {
  const router = Router();

  router.get("/rekber/events", async (req: Request, res: Response) => {
    let limit: number;
    let eventKind: RekberEventKind | undefined;
    let custodyCommitment: string | undefined;

    try {
      limit = parseLimit(req.query.limit);
      eventKind = parseEventKind(req.query.event);
      custodyCommitment = parseCustodyCommitment(req.query.custodyCommitment);
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error ? error.message : "Invalid Rekber request.",
      });
    }

    try {
      const items = await store.listEvents(
        config.network,
        config.contracts.escrowRekber,
        {
          limit,
          eventKind,
          custodyCommitment,
        },
      );

      return res.json({
        network: config.network,
        contractAddress: config.contracts.escrowRekber,
        items,
      });
    } catch {
      console.error("[rekber] indexed lookup failed");

      return res.status(500).json({
        error: "Rekber lookup failed.",
      });
    }
  });

  return router;
}
