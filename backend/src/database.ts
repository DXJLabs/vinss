import { Pool } from "pg";

import type { AppConfig } from "./config.js";

export function createDatabase(config: AppConfig): Pool {
  const pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
    max: 10,
  });

  pool.on("error", () => {
    // Do not print connection details or environment values.
    console.error("[database] unexpected idle client error");
  });

  return pool;
}
