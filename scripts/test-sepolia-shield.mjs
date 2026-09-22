import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("../frontend/", import.meta.url));
const env = { ...process.env };
for (const line of readFileSync(new URL("../frontend/env.sepolia.example", import.meta.url), "utf8").split("\n")) {
  if (!line.startsWith("NEXT_PUBLIC_")) continue;
  const split = line.indexOf("=");
  env[line.slice(0, split)] = line.slice(split + 1);
}
// These tests use local wallet/RPC doubles and never submit a transaction.
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "tests/shield.test.ts"], {
  cwd: frontend, env, stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
