import { Router, type Request, type Response } from "express";

import type { StarknetNetwork } from "../config.js";
import type {
  ActivityKind,
  DiscoverKind,
  GlobalActivityItem,
  RekberEventKind,
} from "../types.js";
import { CertificateStore } from "../indexer/certificateStore.js";
import { RekberStore } from "../indexer/rekberStore.js";
import { DiscoveryStore } from "../indexer/store.js";

const VALID_KINDS: readonly ActivityKind[] = [
  "message",
  "offer",
  "escrow",
  "rekber_funded",
  "rekber_released",
  "rekber_refunded",
  "certificate_issued",
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

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("limit must be an integer from 1 to 100.");
  }

  return parsed;
}

function parseKind(value: unknown): ActivityKind | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (VALID_KINDS.includes(value as ActivityKind)) {
    return value as ActivityKind;
  }

  throw new Error(`kind must be one of: ${VALID_KINDS.join(", ")}`);
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

function encodeCursor(item: GlobalActivityItem | undefined): string | null {
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

function isRekberKind(kind: ActivityKind): kind is `rekber_${RekberEventKind}` {
  return kind.startsWith("rekber_");
}

function rekberEventFromKind(
  kind: `rekber_${RekberEventKind}`,
): RekberEventKind {
  return kind.slice("rekber_".length) as RekberEventKind;
}

function compareActivity(a: GlobalActivityItem, b: GlobalActivityItem): number {
  if (a.blockNumber !== b.blockNumber) {
    return b.blockNumber - a.blockNumber;
  }

  if (a.transactionHash !== b.transactionHash) {
    return a.transactionHash > b.transactionHash ? -1 : 1;
  }

  if (a.actionLocator !== b.actionLocator) {
    return a.actionLocator > b.actionLocator ? -1 : 1;
  }

  return 0;
}

export function createActivityRouter(
  store: DiscoveryStore,
  rekberStore: RekberStore,
  certificateStore: CertificateStore,
  network: StarknetNetwork,
  rekberContractAddress: string,
  certificateContractAddress: string,
): Router {
  const router = Router();

  router.get("/activity", async (req: Request, res: Response) => {
    let limit: number;
    let kind: ActivityKind | undefined;
    let cursor: ActivityCursor | undefined;

    try {
      limit = parseLimit(req.query.limit);
      kind = parseKind(req.query.kind);
      cursor = decodeCursor(req.query.cursor);
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error ? error.message : "Invalid activity request.",
      });
    }

    try {
      let items: GlobalActivityItem[];

      if (kind === "certificate_issued") {
        items = await certificateStore.recentActivity(
          network,
          certificateContractAddress,
          {
            limit,
            cursor,
          },
        );
      } else if (kind && isRekberKind(kind)) {
        items = await rekberStore.recentActivity(
          network,
          rekberContractAddress,
          {
            limit,
            cursor,
            eventKind: rekberEventFromKind(kind),
          },
        );
      } else if (kind) {
        items = await store.recentActivity(network, {
          limit,
          kind: kind as DiscoverKind,
          cursor,
        });
      } else {
        const [privateItems, rekberItems, certificateItems] = await Promise.all(
          [
            store.recentActivity(network, {
              limit,
              cursor,
            }),
            rekberStore.recentActivity(network, rekberContractAddress, {
              limit,
              cursor,
            }),
            certificateStore.recentActivity(
              network,
              certificateContractAddress,
              {
                limit,
                cursor,
              },
            ),
          ],
        );

        items = [...privateItems, ...rekberItems, ...certificateItems]
          .sort(compareActivity)
          .slice(0, limit);
      }

      return res.json({
        network,
        items,
        nextCursor: items.length === limit ? encodeCursor(items.at(-1)) : null,
      });
    } catch {
      console.error("[activity] indexed lookup failed");

      return res.status(500).json({
        error: "Activity lookup failed.",
      });
    }
  });

  return router;
}
