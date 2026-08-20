import {
  inferDealStage,
  isAgentProposal,
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
  VinssLlmProvider,
} from "./types.js";

interface CompatibleConfig {
  id: Extract<
    VinssLlmProvider,
    "openai" | "qwen"
  >;
  apiKey(): string | undefined;
  baseUrl(): string;
  model(): string | undefined;
}

function stripSlash(
  value: string,
): string {
  return value.replace(
    /\/+$/,
    "",
  );
}

function createCompatibleProvider(
  config: CompatibleConfig,
): AgentProvider {
  return {
    id: config.id,

    isConfigured() {
      return Boolean(
        config.apiKey()?.trim() &&
        config.model()?.trim(),
      );
    },

    async run(input) {
      const apiKey =
        config.apiKey()?.trim();
      const model =
        config.model()?.trim();

      if (
        !apiKey ||
        !model
      ) {
        throw new Error(
          `${config.id} is not configured.`,
        );
      }

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
          await fetch(
            `${stripSlash(
              config.baseUrl(),
            )}/chat/completions`,
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${apiKey}`,
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  model,
                  messages,
                  tools:
                    toolDefinitionsForSkill(
                      input.skill,
                    ),
                  tool_choice:
                    "auto",
                }),
            },
          );

        const data: any =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error
              ?.message ||
            `${config.id} HTTP ${response.status}`,
          );
        }

        const message =
          data?.choices?.[0]
            ?.message;

        if (!message) {
          throw new Error(
            `${config.id} returned an empty response.`,
          );
        }

        const toolCalls =
          Array.isArray(
            message.tool_calls,
          )
            ? message.tool_calls
            : [];

        if (
          toolCalls.length ===
          0
        ) {
          return {
            answer:
              typeof message
                .content ===
                "string" &&
              message.content
                .trim()
                ? message.content
                : "No recommendation available.",
            dealStage,
            proposal,
            provider:
              config.id,
            model,
          };
        }

        messages.push({
          role: "assistant",
          content:
            message.content ??
            null,
          tool_calls:
            toolCalls,
        });

        for (
          const call of
          toolCalls
        ) {
          const name =
            call?.function
              ?.name;

          if (
            typeof name !==
            "string"
          ) {
            throw new Error(
              `${config.id} returned an invalid tool call.`,
            );
          }

          const parsed =
            JSON.parse(
              call?.function
                ?.arguments ||
                "{}",
            );

          const args =
            parsed &&
            typeof parsed ===
              "object" &&
            !Array.isArray(
              parsed,
            )
              ? parsed as Record<
                  string,
                  unknown
                >
              : {};

          const result =
            executeSkillTool(
              input.skill,
              name,
              args,
              input.context,
              input.feeBps,
            );

          if (
            isAgentProposal(
              result,
            )
          ) {
            proposal =
              result;
          }

          messages.push({
            role: "tool",
            tool_call_id:
              call.id,
            name,
            content:
              JSON.stringify(
                result,
              ),
          });
        }
      }

      throw new Error(
        `${config.id} reached maximum tool iterations.`,
      );
    },
  };
}

export const openaiProvider =
  createCompatibleProvider({
    id: "openai",
    apiKey: () =>
      process.env
        .OPENAI_API_KEY,
    baseUrl: () =>
      process.env
        .OPENAI_BASE_URL ||
      "https://api.openai.com/v1",
    model: () =>
      process.env.OPENAI_MODEL,
  });

export const qwenProvider =
  createCompatibleProvider({
    id: "qwen",
    apiKey: () =>
      process.env.QWEN_API_KEY ||
      process.env
        .DASHSCOPE_API_KEY,
    baseUrl: () =>
      process.env
        .QWEN_BASE_URL ||
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    model: () =>
      process.env.QWEN_MODEL ||
      "qwen-plus",
  });
