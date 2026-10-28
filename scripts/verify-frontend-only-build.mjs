import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Match a frontend-directory Vercel upload: no sibling backend or root workspace.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "frontend");
const dependencies = join(source, "node_modules");
if (!existsSync(dependencies)) {
  throw new Error("Install frontend dependencies before verifying its isolated build.");
}

const temporary = mkdtempSync(join(tmpdir(), "vinss-frontend-only-"));
const isolated = join(temporary, "frontend");
try {
  cpSync(source, isolated, {
    recursive: true,
    filter: (path) => {
      const name = basename(path);
      return !["node_modules", ".next", ".vercel"].includes(name) &&
        !name.startsWith(".env") && !name.endsWith(".tsbuildinfo");
    },
  });
  symlinkSync(dependencies, join(isolated, "node_modules"), "dir");
  const result = spawnSync("npm", ["run", "build"], {
    cwd: isolated,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
