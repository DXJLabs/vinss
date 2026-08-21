import { Router, type Request, type Response } from "express";

import type { StarknetNetwork } from "../config.js";
import type {
  DiscoverKind,
  GlobalActivityItem,
} from "../types.js";
import { DiscoveryStore } from "../indexer/store.js";

const VALID_KINDS: readonly DiscoverKind[] = [
  "message",
  "offer",
  "escrow",
];

interface ActivityCursor {
  blockNumber: number;
  transactionHash: string;
  actionLocator: string;
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return 30;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > 100
  ) {
    throw new Error("limit must be an integer from 1 to 100.");
  }

  return parsed;
}

function parseKind(value: unknown): DiscoverKind | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (VALID_KINDS.includes(value as DiscoverKind)) {
    return value as DiscoverKind;
  }

  throw new Error(
    `kind must be one of: ${VALID_KINDS.join(", ")}`,
  );
}

function decodeCursor(value: unknown): ActivityCursor | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !value) {
    throw new Error("cursor must be a non-empty string.");
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<ActivityCursor>;

    if (
      !Number.isSafeInteger(decoded.blockNumber) ||
      (decoded.blockNumber ?? -1) < 0 ||
      typeof decoded.transactionHash !== "string" ||
      typeof decoded.actionLocator !== "string"
    ) {
      throw new Error("invalid cursor payload");
    }

    return {
      blockNumber: decoded.blockNumber as number,
      transactionHash: decoded.transactionHash,
      actionLocator: decoded.actionLocator,
    };
  } catch {
    throw new Error("cursor is invalid.");
  }
}

function encodeCursor(
  item: GlobalActivityItem | undefined,
): string | null {
  if (!item) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      blockNumber: item.blockNumber,
      transactionHash: item.transactionHash,
      actionLocator: item.actionLocator,
    }),
    "utf8",
  ).toString("base64url");
}

export function createActivityRouter(
  store: DiscoveryStore,
  network: StarknetNetwork,
): Router {
  const router = Router();

  router.get(
    "/activity",
    async (req: Request, res: Response) => {
      let limit: number;
      let kind: DiscoverKind | undefined;
      let cursor: ActivityCursor | undefined;

      try {
        limit = parseLimit(req.query.limit);
        kind = parseKind(req.query.kind);
        cursor = decodeCursor(req.query.cursor);
      } catch (error) {
        return res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid activity request.",
        });
      }

      try {
        const items = await store.recentActivity(network, {
          limit,
          kind,
          cursor,
        });

        return res.json({
          network,
          items,
          nextCursor:
            items.length === limit
              ? encodeCursor(items.at(-1))
              : null,
        });
      } catch {
        console.error("[activity] indexed lookup failed");

        return res.status(500).json({
          error: "Activity lookup failed.",
        });
      }
    },
  );

  return router;
}
