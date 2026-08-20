import { resolveProviders } from "./providers/registry.js";
import type { VinssLlmSelection } from "./providers/types.js";
import { getAgentSkill } from "./skills/registry.js";
import type { AgentSkillId } from "./skills/types.js";
import type { DealContext } from "./tools.js";

interface RunVinssAgentInput {
  message: string;
  context: DealContext;
  feeBps: number;
  skill: AgentSkillId;
  provider?: VinssLlmSelection;
}

export async function runVinssAgent(input: RunVinssAgentInput) {
  const skill = getAgentSkill(input.skill);
  const providers = resolveProviders(input.provider);

  if (providers.length === 0) {
    throw new Error("No configured VINSS LLM provider is available.");
  }

  for (const provider of providers) {
    try {
      const result = await provider.run({
        message: input.message,
        context: input.context,
        feeBps: input.feeBps,
        skill,
      });

      return {
        ...result,
        skill: skill.id,
      };
    } catch {
      // Provider errors may echo request content. Log identity only.
      console.error(`[VINSS AGENT PROVIDER FAILED] ${provider.id}`);
    }
  }

  throw new Error("All configured VINSS LLM providers failed.");
}
