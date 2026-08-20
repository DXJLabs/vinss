import {
  runVinssAgent as runGroqAgent,
} from "./groq.js";
import {
  runOpenAICompatibleAgent,
} from "./openaiCompatible.js";
import {
  runAnthropicAgent,
} from "./anthropic.js";
import type {
  DealContext,
} from "./tools.js";

export type VinssLlmProvider =
  | "groq"
  | "openai"
  | "anthropic"
  | "qwen";

export type VinssLlmSelection =
  | VinssLlmProvider
  | "auto";

const ALL_PROVIDERS:
  VinssLlmProvider[] = [
    "groq",
    "openai",
    "anthropic",
    "qwen",
  ];

function isProvider(
  value: string,
): value is VinssLlmProvider {
  return ALL_PROVIDERS.includes(
    value as VinssLlmProvider,
  );
}

export function isLlmSelection(
  value: unknown,
): value is VinssLlmSelection {
  return (
    value === "auto" ||
    (typeof value === "string" &&
      isProvider(value))
  );
}

export function configuredProviders():
  VinssLlmProvider[] {
  return ALL_PROVIDERS.filter(
    (provider) => {
      switch (provider) {
        case "groq":
          return Boolean(
            process.env.GROQ_API_KEY
              ?.trim(),
          );

        case "openai":
          return Boolean(
            process.env.OPENAI_API_KEY
              ?.trim() &&
            process.env.OPENAI_MODEL
              ?.trim(),
          );

        case "anthropic":
          return Boolean(
            process.env
              .ANTHROPIC_API_KEY
              ?.trim() &&
            process.env
              .ANTHROPIC_MODEL
              ?.trim(),
          );

        case "qwen":
          return Boolean(
            process.env.QWEN_API_KEY
              ?.trim() ||
            process.env
              .DASHSCOPE_API_KEY
              ?.trim(),
          );
      }
    },
  );
}

function parseFallbacks():
  VinssLlmProvider[] {
  const raw =
    process.env
      .VINSS_LLM_FALLBACKS
      ?.trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) =>
      value.trim().toLowerCase(),
    )
    .filter(isProvider);
}

function unique(
  values: VinssLlmProvider[],
): VinssLlmProvider[] {
  return [...new Set(values)];
}

export function resolveProviderOrder(
  requested?: VinssLlmSelection,
): VinssLlmProvider[] {
  const configured =
    configuredProviders();

  const envSelection =
    process.env
      .VINSS_LLM_PROVIDER
      ?.trim()
      .toLowerCase();

  const selection =
    requested ??
    (isLlmSelection(envSelection)
      ? envSelection
      : "groq");

  if (selection === "auto") {
    const preferred =
      parseFallbacks();

    const order =
      preferred.length > 0
        ? preferred
        : ALL_PROVIDERS;

    return unique(order).filter(
      (provider) =>
        configured.includes(provider),
    );
  }

  return unique([
    selection,
    ...parseFallbacks(),
  ]).filter((provider) =>
    configured.includes(provider),
  );
}

async function runProvider(
  provider: VinssLlmProvider,
  input: {
    message: string;
    context: DealContext;
    feeBps: number;
  },
) {
  switch (provider) {
    case "groq": {
      const result =
        await runGroqAgent(input);

      return {
        ...result,
        provider:
          "groq" as const,
        model:
          process.env.GROQ_MODEL ||
          "openai/gpt-oss-120b",
      };
    }

    case "openai":
    case "qwen":
      return runOpenAICompatibleAgent(
        provider,
        input,
      );

    case "anthropic":
      return runAnthropicAgent(
        input,
      );
  }
}

export async function runVinssAgent(
  input: {
    message: string;
    context: DealContext;
    feeBps: number;
    provider?:
      VinssLlmSelection;
  },
) {
  const order =
    resolveProviderOrder(
      input.provider,
    );

  if (order.length === 0) {
    throw new Error(
      "No configured VINSS LLM provider is available.",
    );
  }

  const failures: string[] = [];

  for (const provider of order) {
    try {
      return await runProvider(
        provider,
        input,
      );
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : String(err);

      failures.push(
        `${provider}: ${detail}`,
      );

      // Never log prompts or private context here.
      console.error(
        `[VINSS AGENT PROVIDER FAILED] ${provider}: ${detail}`,
      );
    }
  }

  throw new Error(
    `All VINSS LLM providers failed: ${failures.join(" | ")}`,
  );
}
