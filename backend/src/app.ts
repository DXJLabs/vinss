import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import swaggerUi from "swagger-ui-express";
import type { Pool } from "pg";

import type { AppConfig } from "./config.js";
import { CertificateIndexer } from "./indexer/certificate.js";
import { CertificateStore } from "./indexer/certificateStore.js";
import type { IndexerDefinition } from "./indexer/definitions.js";
import { RekberIndexer } from "./indexer/rekber.js";
import { RekberStore } from "./indexer/rekberStore.js";
import { DiscoveryIndexer } from "./indexer/service.js";
import { DiscoveryStore } from "./indexer/store.js";
import { loyaltyRouter } from "./loyalty/routes.js";
import { createFixedWindowRateLimit } from "./middleware/rateLimit.js";
import { openApiDocument } from "./openapi.js";
import { agentRouter } from "./routes/agent.js";
import { createAttachmentRouter } from "./routes/attachments.js";
import { createActivityRouter } from "./routes/activity.js";
import { createDiscoverRouter } from "./routes/discover.js";
import { createHealthRouter } from "./routes/health.js";
import { presenceRouter } from "./routes/presence.js";
import { createRekberRouter } from "./routes/rekber.js";

interface AppDependencies {
  database: Pool;
  config: AppConfig;
  definitions: readonly IndexerDefinition[];
  store: DiscoveryStore;
  indexer: DiscoveryIndexer;
  rekberStore: RekberStore;
  rekberIndexer: RekberIndexer;
  certificateStore: CertificateStore;
  certificateIndexer: CertificateIndexer;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  if (dependencies.config.network === "mainnet") {
    // VINSS is deployed behind one managed reverse proxy. This makes req.ip
    // use that proxy's verified forwarded address for endpoint throttling.
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin: dependencies.config.corsOrigin,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  // Request bodies are intentionally never logged.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  app.use(
    createHealthRouter(
      dependencies.config,
      dependencies.indexer,
      dependencies.rekberIndexer,
      dependencies.certificateIndexer,
    ),
  );

  app.get("/openapi.json", (_req: Request, res: Response) => {
    res.json(openApiDocument);
  });

  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "VINSS Backend API",
    }),
  );

  app.use(
    "/discover",
    createFixedWindowRateLimit({
      limit: dependencies.config.rateLimits.discover,
      windowMs: dependencies.config.rateLimits.windowMs,
      scope: "discover",
    }),
  );
  app.use(createDiscoverRouter(dependencies.store, dependencies.definitions));

  app.use(createRekberRouter(dependencies.rekberStore, dependencies.config));

  app.use(
    createActivityRouter(
      dependencies.store,
      dependencies.rekberStore,
      dependencies.certificateStore,
      dependencies.config.network,
      dependencies.config.contracts.escrowRekber,
      dependencies.config.contracts.settlementCertificate,
    ),
  );

  if (dependencies.config.features.agent) {
    app.use(
      "/agent",
      createFixedWindowRateLimit({
        limit: dependencies.config.rateLimits.agent,
        windowMs: dependencies.config.rateLimits.windowMs,
        scope: "agent",
      }),
    );
    app.use(agentRouter);
  }

  // Loyalty writes are unauthenticated/in-memory today. They stay fail-closed
  // unless an operator deliberately enables this non-valuable preview.
  if (dependencies.config.features.loyalty) {
    app.use(loyaltyRouter);
  }
  app.use(presenceRouter);
  app.use(createAttachmentRouter(dependencies.database));

  return app;
}
