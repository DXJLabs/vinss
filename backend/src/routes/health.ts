import { Router, type Request, type Response } from "express";

import type { AppConfig } from "../config.js";
import { DiscoveryIndexer } from "../indexer/service.js";

export function createHealthRouter(
  config: AppConfig,
  indexer: DiscoveryIndexer,
): Router {
  const router = Router();

  router.get(
    "/health",
    async (_req: Request, res: Response) => {
      try {
        const checkpoints = await indexer.getStatus();
        const degraded = Object.values(checkpoints).some(
          (checkpoint) => checkpoint.status === "error",
        );

        return res.status(degraded ? 503 : 200).json({
          status: degraded ? "degraded" : "ok",
          network: config.network,
          indexer: checkpoints,
        });
      } catch {
        return res.status(503).json({
          status: "degraded",
          network: config.network,
          indexer: null,
        });
      }
    },
  );

  return router;
}
