import Groq from "groq-sdk";

import {
  isAgentProposal,
  inferDealStage,
  type AgentProposal,
} from "../tools.js";
import {
  BASE_SYSTEM_PROMPT,
} from "../prompts.js";
import {
  buildAgentInput,
  executeSkillTool,
  systemPromptForSkill,
  toolDefinitionsForSkill,
} from "../runtime.js";
import type {
  AgentProvider,
} from "./types.js";

export const groqProvider:
  AgentProvider = {
  id: "groq",

  isConfigured() {
    return Boolean(
      process.env.GROQ_API_KEY
        ?.trim(),
    );
  },

  async run(input) {
    const apiKey =
      process.env.GROQ_API_KEY
        ?.trim();

    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not configured.",
      );
    }

    const model =
      process.env.GROQ_MODEL ||
      "openai/gpt-oss-120b";

    const client =
      new Groq({ apiKey });

    const dealStage =
      inferDealStage(
        input.context,
      );

    const messages: any[] = [
      {
        role: "system",
        content: [
          BASE_SYSTEM_PROMPT,
          systemPromptForSkill(
            input.skill,
          ),
        ].join("\n\n"),
      },
      {
        role: "user",
        content: JSON.stringify(
          buildAgentInput(
            input.message,
            input.context,
          ),
        ),
      },
    ];

    let proposal:
      | AgentProposal
      | null = null;

    for (
      let iteration = 0;
      iteration < 4;
      iteration += 1
    ) {
      const response =
        await client.chat.completions.create(
          {
            model,
            messages,
            tools:
              toolDefinitionsForSkill(
                input.skill,
              ) as any,
            tool_choice: "auto",
            temperature: 0.2,
          },
        );

      const message =
        response.choices[0]
          ?.message;

      if (!message) {
        throw new Error(
          "Groq returned an empty response.",
        );
      }

      if (
        !message.tool_calls
          ?.length
      ) {
        return {
          answer:
            message.content ||
            "No recommendation available.",
          dealStage,
          proposal,
          provider: "groq",
          model,
        };
      }

      messages.push(message);

      for (
        const call of
        message.tool_calls
      ) {
        const args =
          JSON.parse(
            call.function
              .arguments ||
              "{}",
          ) as Record<
            string,
            unknown
          >;

        const result =
          executeSkillTool(
            input.skill,
            call.function.name,
            args,
            input.context,
            input.feeBps,
          );

        if (
          isAgentProposal(
            result,
          )
        ) {
          proposal = result;
        }

        messages.push({
          role: "tool",
          tool_call_id:
            call.id,
          name:
            call.function.name,
          content:
            JSON.stringify(
              result,
            ),
        });
      }
    }

    throw new Error(
      "Groq reached maximum tool iterations.",
    );
  },
};
