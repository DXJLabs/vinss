import {
  executeTool,
  getToolDefinitions,
  inferDealStage,
  isAgentProposal,
  type AgentProposal,
  type DealContext,
} from "./tools.js";
import { SYSTEM_PROMPT } from "./groq.js";

export type OpenAICompatibleProvider =
  | "openai"
  | "qwen";

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function trimTrailingSlash(
  value: string,
): string {
  return value.replace(/\/+$/, "");
}

function configFor(
  provider: OpenAICompatibleProvider,
): ProviderConfig {
  if (provider === "openai") {
    const apiKey =
      process.env.OPENAI_API_KEY?.trim();
    const model =
      process.env.OPENAI_MODEL?.trim();

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured on the server.",
      );
    }

    if (!model) {
      throw new Error(
        "OPENAI_MODEL is not configured on the server.",
      );
    }

    return {
      apiKey,
      baseUrl: trimTrailingSlash(
        process.env.OPENAI_BASE_URL?.trim() ||
          "https://api.openai.com/v1",
      ),
      model,
    };
  }

  const apiKey =
    process.env.QWEN_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "QWEN_API_KEY or DASHSCOPE_API_KEY is not configured on the server.",
    );
  }

  return {
    apiKey,
    baseUrl: trimTrailingSlash(
      process.env.QWEN_BASE_URL?.trim() ||
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    ),
    model:
      process.env.QWEN_MODEL?.trim() ||
      "qwen-plus",
  };
}

async function parseJsonResponse(
  response: Response,
  provider: string,
): Promise<any> {
  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `${provider} returned a non-JSON response (${response.status}).`,
    );
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(
      `${provider} request failed: ${detail}`,
    );
  }

  return data;
}

export async function runOpenAICompatibleAgent(
  provider: OpenAICompatibleProvider,
  input: {
    message: string;
    context: DealContext;
    feeBps: number;
  },
) {
  const config = configFor(provider);
  const dealStage =
    inferDealStage(input.context);

  const messages: any[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        request: input.message,
        currentDealStage: dealStage,
        sharedDealContext: input.context,
      }),
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
    const response = await fetch(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${config.apiKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools: getToolDefinitions(),
          tool_choice: "auto",
        }),
      },
    );

    const data =
      await parseJsonResponse(
        response,
        provider,
      );

    const message =
      data?.choices?.[0]?.message;

    if (!message) {
      throw new Error(
        `${provider} returned an empty response.`,
      );
    }

    const toolCalls =
      Array.isArray(
        message.tool_calls,
      )
        ? message.tool_calls
        : [];

    if (toolCalls.length === 0) {
      return {
        answer:
          typeof message.content ===
            "string" &&
          message.content.trim()
            ? message.content
            : "No recommendation available.",
        dealStage,
        proposal,
        provider,
        model: config.model,
      };
    }

    messages.push({
      role: "assistant",
      content:
        message.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const name =
        call?.function?.name;

      if (
        typeof name !== "string"
      ) {
        throw new Error(
          `${provider} returned an invalid tool call.`,
        );
      }

      let args: Record<string, unknown> = {};

      try {
        args = JSON.parse(
          call?.function?.arguments ||
            "{}",
        );
      } catch {
        throw new Error(
          `${provider} returned invalid JSON tool arguments.`,
        );
      }

      const result = executeTool(
        name,
        args,
        input.context,
        input.feeBps,
      );

      if (
        isAgentProposal(result)
      ) {
        proposal = result;
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name,
        content:
          JSON.stringify(result),
      });
    }
  }

  throw new Error(
    `${provider} reached its maximum tool iterations.`,
  );
}
