import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";

import { config } from "./config.js";
import { loyaltyRouter } from "./loyalty/routes.js";
import { openApiDocument } from "./openapi.js";
import { agentRouter } from "./routes/agent.js";
import { discoverRouter } from "./routes/discover.js";
import { presenceRouter } from "./routes/presence.js";

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

// Deliberately minimal logging — request bodies are never logged. Discovery
// is ciphertext-only, so channel keys must never reach this process.
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", network: config.network });
});

app.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "VINSS Backend API",
  }),
);

app.use(discoverRouter);
app.use(agentRouter);
app.use(loyaltyRouter);
app.use(presenceRouter);

app.listen(config.port, () => {
  console.log(`VINSS backend listening on :${config.port} (${config.network})`);
});
