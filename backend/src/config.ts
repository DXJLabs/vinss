import "dotenv/config";

export type StarknetNetwork = "sepolia" | "mainnet";
export type VinssLlmSelection =
  "auto" | "groq" | "openai" | "anthropic" | "qwen";

export interface AppConfig {
  port: number;
  corsOrigin: string;
  rpcUrl: string;
  network: StarknetNetwork;
  database: {
    url: string;
    ssl: boolean;
  };
  contracts: {
    privacyPool: string;
    messageHelper: string;
    offerHelper: string;
    privateEscrowHelper: string;
    escrowRekber: string;
  };
  indexer: {
    startBlocks: {
      message: number;
      offer: number;
      escrow: number;
      rekber: number;
    };
    pollIntervalMs: number;
    blockRange: number;
    eventPageSize: number;
    fetchConcurrency: number;
  };
  agent: {
    feeBps: number;
    defaultProvider: VinssLlmSelection;
  };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function parseNetwork(value: string): StarknetNetwork {
  if (value === "sepolia" || value === "mainnet") {
    return value;
  }

  throw new Error(
    `STARKNET_NETWORK must be "sepolia" or "mainnet"; received "${value}".`,
  );
}

function parseUrl(value: string, name: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use http or https.`);
  }

  return value;
}

function parseDatabaseUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres or postgresql.");
  }

  return value;
}

function parseInteger(
  value: string | undefined,
  name: string,
  options: {
    fallback?: number;
    min?: number;
    max?: number;
  } = {},
): number {
  const raw = value?.trim();

  if (!raw) {
    if (options.fallback !== undefined) {
      return options.fallback;
    }

    throw new Error(`Missing required env var: ${name}`);
  }

  const parsed = Number(raw);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer.`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${name} must be >= ${options.min}.`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`${name} must be <= ${options.max}.`);
  }

  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  throw new Error(`Expected boolean value, received "${value}".`);
}

function parseAddress(value: string, name: string): string {
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed Starknet address.`);
  }

  const numeric = BigInt(value);

  if (numeric <= 0n) {
    throw new Error(`${name} must be non-zero.`);
  }

  if (numeric >= 1n << 251n) {
    throw new Error(`${name} is outside the Starknet felt range.`);
  }

  return `0x${numeric.toString(16)}`;
}

function parseLlmSelection(value: string | undefined): VinssLlmSelection {
  const normalized = value?.trim().toLowerCase() || "groq";

  if (
    normalized === "auto" ||
    normalized === "groq" ||
    normalized === "openai" ||
    normalized === "anthropic" ||
    normalized === "qwen"
  ) {
    return normalized;
  }

  throw new Error(
    "VINSS_LLM_PROVIDER must be auto, groq, openai, anthropic, or qwen.",
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const network = parseNetwork(requireEnv(env, "STARKNET_NETWORK"));

  return {
    port: parseInteger(env.PORT, "PORT", {
      fallback: 4000,
      min: 1,
      max: 65_535,
    }),
    corsOrigin: env.CORS_ORIGIN?.trim() || "http://localhost:3000",
    rpcUrl: parseUrl(requireEnv(env, "RPC_URL"), "RPC_URL"),
    network,
    database: {
      url: parseDatabaseUrl(requireEnv(env, "DATABASE_URL")),
      ssl: parseBoolean(env.DATABASE_SSL, false),
    },
    contracts: {
      privacyPool: parseAddress(
        requireEnv(env, "PRIVACY_POOL_ADDRESS"),
        "PRIVACY_POOL_ADDRESS",
      ),
      messageHelper: parseAddress(
        requireEnv(env, "MESSAGE_HELPER_ADDRESS"),
        "MESSAGE_HELPER_ADDRESS",
      ),
      offerHelper: parseAddress(
        requireEnv(env, "OFFER_HELPER_ADDRESS"),
        "OFFER_HELPER_ADDRESS",
      ),
      privateEscrowHelper: parseAddress(
        requireEnv(env, "PRIVATE_ESCROW_HELPER_ADDRESS"),
        "PRIVATE_ESCROW_HELPER_ADDRESS",
      ),
      escrowRekber: parseAddress(
        requireEnv(env, "ESCROW_REKBER_ADDRESS"),
        "ESCROW_REKBER_ADDRESS",
      ),
    },
    indexer: {
      startBlocks: {
        message: parseInteger(
          env.MESSAGE_HELPER_START_BLOCK,
          "MESSAGE_HELPER_START_BLOCK",
          { min: 0 },
        ),
        offer: parseInteger(
          env.OFFER_HELPER_START_BLOCK,
          "OFFER_HELPER_START_BLOCK",
          { min: 0 },
        ),
        escrow: parseInteger(
          env.PRIVATE_ESCROW_HELPER_START_BLOCK,
          "PRIVATE_ESCROW_HELPER_START_BLOCK",
          { min: 0 },
        ),
        rekber: parseInteger(
          env.ESCROW_REKBER_START_BLOCK,
          "ESCROW_REKBER_START_BLOCK",
          { min: 0 },
        ),
      },
      pollIntervalMs: parseInteger(
        env.INDEXER_POLL_INTERVAL_MS,
        "INDEXER_POLL_INTERVAL_MS",
        { fallback: 5_000, min: 1_000, max: 300_000 },
      ),
      blockRange: parseInteger(env.INDEXER_BLOCK_RANGE, "INDEXER_BLOCK_RANGE", {
        fallback: 2_000,
        min: 1,
        max: 50_000,
      }),
      eventPageSize: parseInteger(
        env.INDEXER_EVENT_PAGE_SIZE,
        "INDEXER_EVENT_PAGE_SIZE",
        { fallback: 100, min: 1, max: 1_000 },
      ),
      fetchConcurrency: parseInteger(
        env.INDEXER_FETCH_CONCURRENCY,
        "INDEXER_FETCH_CONCURRENCY",
        { fallback: 4, min: 1, max: 16 },
      ),
    },
    agent: {
      feeBps: parseInteger(env.VINSS_FEE_BPS, "VINSS_FEE_BPS", {
        fallback: 25,
        min: 0,
        max: 10_000,
      }),
      defaultProvider: parseLlmSelection(env.VINSS_LLM_PROVIDER),
    },
  };
}

export const config = loadConfig();
