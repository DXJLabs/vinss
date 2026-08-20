import {
  getAgentSkill,
} from "./skills/registry.js";
import type {
  AgentSkillId,
} from "./skills/types.js";
import {
  resolveProviders,
} from "./providers/registry.js";
import type {
  VinssLlmSelection,
} from "./providers/types.js";
import type {
  DealContext,
} from "./tools.js";

export async function runVinssAgent(
  input: {
    message: string;
    context: DealContext;
    feeBps: number;
    skill: AgentSkillId;
    provider?:
      VinssLlmSelection;
  },
) {
  const skill =
    getAgentSkill(
      input.skill,
    );

  const providers =
    resolveProviders(
      input.provider,
    );

  if (
    providers.length === 0
  ) {
    throw new Error(
      "No configured VINSS LLM provider is available.",
    );
  }

  const failures:
    string[] = [];

  for (
    const provider of
    providers
  ) {
    try {
      const result =
        await provider.run({
          message:
            input.message,
          context:
            input.context,
          feeBps:
            input.feeBps,
          skill,
        });

      return {
        ...result,
        skill:
          skill.id,
      };
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : String(err);

      failures.push(
        `${provider.id}: ${detail}`,
      );

      console.error(
        `[VINSS AGENT PROVIDER FAILED] ${provider.id}: ${detail}`,
      );
    }
  }

  throw new Error(
    `All VINSS LLM providers failed: ${failures.join(" | ")}`,
  );
}
