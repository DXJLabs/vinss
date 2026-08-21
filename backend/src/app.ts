import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import swaggerUi from "swagger-ui-express";

import type { AppConfig } from "./config.js";
import type { IndexerDefinition } from "./indexer/definitions.js";
import { DiscoveryIndexer } from "./indexer/service.js";
import { DiscoveryStore } from "./indexer/store.js";
import { loyaltyRouter } from "./loyalty/routes.js";
import { openApiDocument } from "./openapi.js";
import { agentRouter } from "./routes/agent.js";
import { createActivityRouter } from "./routes/activity.js";
import { createDiscoverRouter } from "./routes/discover.js";
import { createHealthRouter } from "./routes/health.js";
import { presenceRouter } from "./routes/presence.js";

interface AppDependencies {
  config: AppConfig;
  definitions: readonly IndexerDefinition[];
  store: DiscoveryStore;
  indexer: DiscoveryIndexer;
}

export function createApp(
  dependencies: AppDependencies,
): Express {
  const app = express();

  app.use(
    cors({
      origin: dependencies.config.corsOrigin,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  // Request bodies are intentionally never logged.
  app.use(
    (
      req: Request,
      _res: Response,
      next: NextFunction,
    ) => {
      console.log(`${req.method} ${req.path}`);
      next();
    },
  );

  app.use(
    createHealthRouter(
      dependencies.config,
      dependencies.indexer,
    ),
  );

  app.get(
    "/openapi.json",
    (_req: Request, res: Response) => {
      res.json(openApiDocument);
    },
  );

  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "VINSS Backend API",
    }),
  );

  app.use(
    createDiscoverRouter(
      dependencies.store,
      dependencies.definitions,
    ),
  );

  app.use(
    createActivityRouter(
      dependencies.store,
      dependencies.config.network,
    ),
  );

  app.use(agentRouter);
  app.use(loyaltyRouter);
  app.use(presenceRouter);

  return app;
}
