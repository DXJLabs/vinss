import {
  inferDealStage,
  isAgentProposal,
  type AgentProposal,
} from "../tools.js";
import { BASE_SYSTEM_PROMPT } from "../prompts.js";
import {
  buildAgentInput,
  executeSkillTool,
  systemPromptForSkill,
  toolDefinitionsForSkill,
} from "../runtime.js";
import type { AgentProvider } from "./types.js";

function anthropicTools(input: ReturnType<typeof toolDefinitionsForSkill>) {
  return input.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }));
}

export const anthropicProvider: AgentProvider = {
  id: "anthropic",

  isConfigured() {
    return Boolean(
      process.env.ANTHROPIC_API_KEY?.trim() &&
      process.env.ANTHROPIC_MODEL?.trim(),
    );
  },

  async run(input) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    const model = process.env.ANTHROPIC_MODEL?.trim();

    if (!apiKey || !model) {
      throw new Error("Anthropic is not configured.");
    }

    const baseUrl = (
      process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1"
    ).replace(/\/+$/, "");

    const dealStage = inferDealStage(input.context);

    const messages: any[] = [
      {
        role: "user",
        content: JSON.stringify(buildAgentInput(input.message, input.context)),
      },
    ];

    let proposal: AgentProposal | null = null;

    for (let iteration = 0; iteration < 4; iteration += 1) {
      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || "2048"),
          system: [BASE_SYSTEM_PROMPT, systemPromptForSkill(input.skill)].join(
            "\n\n",
          ),
          messages,
          tools: anthropicTools(toolDefinitionsForSkill(input.skill)),
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || `Anthropic HTTP ${response.status}`,
        );
      }

      const content = Array.isArray(data?.content) ? data.content : [];

      const toolUses = content.filter(
        (block: any) => block?.type === "tool_use",
      );

      if (toolUses.length === 0) {
        const answer = content
          .filter(
            (block: any) =>
              block?.type === "text" && typeof block.text === "string",
          )
          .map((block: any) => block.text)
          .join("\n")
          .trim();

        return {
          answer: answer || "No recommendation available.",
          dealStage,
          proposal,
          provider: "anthropic",
          model,
        };
      }

      messages.push({
        role: "assistant",
        content,
      });

      const results: any[] = [];

      for (const call of toolUses) {
        const args =
          call.input &&
          typeof call.input === "object" &&
          !Array.isArray(call.input)
            ? (call.input as Record<string, unknown>)
            : {};

        const result = executeSkillTool(
          input.skill,
          call.name,
          args,
          input.context,
          input.feeBps,
        );

        if (isAgentProposal(result)) {
          proposal = result;
        }

        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({
        role: "user",
        content: results,
      });
    }

    throw new Error("Anthropic reached maximum tool iterations.");
  },
};
