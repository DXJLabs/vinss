import { groqProvider } from "./groq.js";
import { openaiProvider, qwenProvider } from "./openai-compatible.js";
import { anthropicProvider } from "./anthropic.js";
import type {
  AgentProvider,
  VinssLlmProvider,
  VinssLlmSelection,
} from "./types.js";

const PROVIDERS: Record<VinssLlmProvider, AgentProvider> = {
  groq: groqProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  qwen: qwenProvider,
};

const ORDER: VinssLlmProvider[] = ["groq", "openai", "anthropic", "qwen"];

export function isLlmSelection(value: unknown): value is VinssLlmSelection {
  return (
    value === "auto" ||
    value === "groq" ||
    value === "openai" ||
    value === "anthropic" ||
    value === "qwen"
  );
}

export function configuredProviders(): VinssLlmProvider[] {
  return ORDER.filter((id) => PROVIDERS[id].isConfigured());
}

function fallbackOrder(): VinssLlmProvider[] {
  const raw = process.env.VINSS_LLM_FALLBACKS?.trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(
      (item): item is VinssLlmProvider =>
        item === "groq" ||
        item === "openai" ||
        item === "anthropic" ||
        item === "qwen",
    );
}

export function resolveProviders(
  requested?: VinssLlmSelection,
): AgentProvider[] {
  const configured = new Set(configuredProviders());

  const envValue = process.env.VINSS_LLM_PROVIDER?.trim().toLowerCase();

  const selected = requested ?? (isLlmSelection(envValue) ? envValue : "groq");

  const preferredFallbacks = fallbackOrder();

  const ids =
    selected === "auto"
      ? preferredFallbacks.length
        ? preferredFallbacks
        : ORDER
      : [selected, ...preferredFallbacks];

  const unique = [...new Set(ids)];

  return unique.filter((id) => configured.has(id)).map((id) => PROVIDERS[id]);
}
