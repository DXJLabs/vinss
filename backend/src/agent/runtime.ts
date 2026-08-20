import {
  executeTool,
  getToolDefinitions,
  inferDealStage,
  type DealContext,
} from "./tools.js";
import type { AgentSkill } from "./skills/types.js";

export function systemPromptForSkill(skill: AgentSkill): string {
  return [
    "VINSS scoped agent.",
    skill.instructions.trim(),
    `Allowed tools: ${skill.allowedTools.join(", ")}.`,
    "Any other tool is forbidden.",
  ].join("\n\n");
}

export function toolDefinitionsForSkill(skill: AgentSkill) {
  const allowed = new Set(skill.allowedTools);

  return getToolDefinitions().filter((tool) => allowed.has(tool.function.name));
}

// Security boundary: tool scope is enforced in code, not only in the prompt.
export function executeSkillTool(
  skill: AgentSkill,
  name: string,
  args: Record<string, unknown>,
  context: DealContext,
  feeBps: number,
) {
  if (!skill.allowedTools.includes(name)) {
    throw new Error(`Tool not allowed for ${skill.id} skill: ${name}`);
  }

  return executeTool(name, args, context, feeBps);
}

export function buildAgentInput(message: string, context: DealContext) {
  return {
    request: message,
    currentDealStage: inferDealStage(context),
    privacySafeContext: context,
  };
}
