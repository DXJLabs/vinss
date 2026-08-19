import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { discoverRouter } from "./routes/discover.js";
import { agentRouter } from "./routes/agent.js";
import { loyaltyRouter } from "./loyalty/routes.js";
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

app.use(discoverRouter);
app.use(agentRouter);
app.use(loyaltyRouter);
app.use(presenceRouter);

app.listen(config.port, () => {
  console.log(`VINSS backend listening on :${config.port} (${config.network})`);
});
