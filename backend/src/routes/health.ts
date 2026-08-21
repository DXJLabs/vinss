import { Router, type Request, type Response } from "express";

import type { AppConfig } from "../config.js";
import { RekberIndexer } from "../indexer/rekber.js";
import { DiscoveryIndexer } from "../indexer/service.js";

export function createHealthRouter(
  config: AppConfig,
  indexer: DiscoveryIndexer,
  rekberIndexer: RekberIndexer,
): Router {
  const router = Router();

  router.get("/health", async (_req: Request, res: Response) => {
    try {
      const [checkpoints, rekberCheckpoint] = await Promise.all([
        indexer.getStatus(),
        rekberIndexer.getStatus(),
      ]);

      const degraded =
        Object.values(checkpoints).some(
          (checkpoint) => checkpoint.status === "error",
        ) || rekberCheckpoint.status === "error";

      return res.status(degraded ? 503 : 200).json({
        status: degraded ? "degraded" : "ok",
        network: config.network,
        indexer: checkpoints,
        rekberIndexer: rekberCheckpoint,
      });
    } catch {
      return res.status(503).json({
        status: "degraded",
        network: config.network,
        indexer: null,
        rekberIndexer: null,
      });
    }
  });

  return router;
}
