import { createApp } from "./app.js";
import { config } from "./config.js";
import { createDatabase } from "./database.js";
import { createIndexerDefinitions } from "./indexer/definitions.js";
import { StarknetEventSource } from "./indexer/poolEvents.js";
import { DiscoveryIndexer } from "./indexer/service.js";
import { DiscoveryStore } from "./indexer/store.js";

async function main(): Promise<void> {
  const database = createDatabase(config);
  const definitions = createIndexerDefinitions(config);
  const store = new DiscoveryStore(database);

  try {
    await store.initialize(definitions);
  } catch {
    console.error("[startup] database initialization failed");
    await database.end();
    process.exitCode = 1;
    return;
  }

  const source = new StarknetEventSource(
    config.rpcUrl,
    config.indexer.eventPageSize,
  );

  const indexer = new DiscoveryIndexer(
    config,
    definitions,
    source,
    store,
  );

  const app = createApp({
    config,
    definitions,
    store,
    indexer,
  });

  const server = app.listen(config.port, () => {
    console.log(
      `VINSS backend listening on :${config.port} (${config.network})`,
    );
  });

  indexer.start();

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`[shutdown] ${signal}`);

    await indexer.stop();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await database.end();
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

main().catch(() => {
  console.error("[startup] fatal initialization error");
  process.exitCode = 1;
});
