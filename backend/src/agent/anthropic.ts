import {
  executeTool,
  getToolDefinitions,
  inferDealStage,
  isAgentProposal,
  type AgentProposal,
  type DealContext,
} from "./tools.js";
import { SYSTEM_PROMPT } from "./groq.js";

function anthropicTools(): any[] {
  return (
    getToolDefinitions() as any[]
  ).map((tool) => ({
    name: tool.function.name,
    description:
      tool.function.description,
    input_schema:
      tool.function.parameters,
  }));
}

async function parseAnthropicResponse(
  response: Response,
): Promise<any> {
  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `anthropic returned a non-JSON response (${response.status}).`,
    );
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(
      `anthropic request failed: ${detail}`,
    );
  }

  return data;
}

export async function runAnthropicAgent(
  input: {
    message: string;
    context: DealContext;
    feeBps: number;
  },
) {
  const apiKey =
    process.env.ANTHROPIC_API_KEY?.trim();
  const model =
    process.env.ANTHROPIC_MODEL?.trim();

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured on the server.",
    );
  }

  if (!model) {
    throw new Error(
      "ANTHROPIC_MODEL is not configured on the server.",
    );
  }

  const baseUrl = (
    process.env.ANTHROPIC_BASE_URL?.trim() ||
    "https://api.anthropic.com/v1"
  ).replace(/\/+$/, "");

  const dealStage =
    inferDealStage(input.context);

  const messages: any[] = [
    {
      role: "user",
      content: JSON.stringify({
        request: input.message,
        currentDealStage: dealStage,
        sharedDealContext:
          input.context,
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
      `${baseUrl}/messages`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version":
            process.env
              .ANTHROPIC_VERSION
              ?.trim() ||
            "2023-06-01",
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: Number(
            process.env
              .ANTHROPIC_MAX_TOKENS ||
              "2048",
          ),
          system: SYSTEM_PROMPT,
          messages,
          tools:
            anthropicTools(),
        }),
      },
    );

    const data =
      await parseAnthropicResponse(
        response,
      );

    const content =
      Array.isArray(data?.content)
        ? data.content
        : [];

    const toolUses =
      content.filter(
        (block: any) =>
          block?.type ===
          "tool_use",
      );

    if (toolUses.length === 0) {
      const answer = content
        .filter(
          (block: any) =>
            block?.type ===
              "text" &&
            typeof block.text ===
              "string",
        )
        .map(
          (block: any) =>
            block.text,
        )
        .join("\n")
        .trim();

      return {
        answer:
          answer ||
          "No recommendation available.",
        dealStage,
        proposal,
        provider:
          "anthropic" as const,
        model,
      };
    }

    messages.push({
      role: "assistant",
      content,
    });

    const results: any[] = [];

    for (const call of toolUses) {
      if (
        typeof call.name !==
          "string" ||
        typeof call.id !==
          "string"
      ) {
        throw new Error(
          "anthropic returned an invalid tool call.",
        );
      }

      const result = executeTool(
        call.name,
        call.input ?? {},
        input.context,
        input.feeBps,
      );

      if (
        isAgentProposal(result)
      ) {
        proposal = result;
      }

      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content:
          JSON.stringify(result),
      });
    }

    messages.push({
      role: "user",
      content: results,
    });
  }

  throw new Error(
    "anthropic reached its maximum tool iterations.",
  );
}
