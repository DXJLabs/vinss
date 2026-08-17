import Groq from "groq-sdk";

import {
  executeTool,
  getToolDefinitions,
  inferDealStage,
  isAgentProposal,
  type AgentProposal,
  type DealContext,
} from "./tools.js";

const SYSTEM_PROMPT = `
You are VINSS Agent, a private deal-room agent.

You operate across the complete deal lifecycle:

Private Messages
→ Negotiation
→ Offer / Counter Offer
→ Agreement
→ Escrow
→ Settlement
→ Completed

Rules:
- Only use deal context explicitly supplied by the user.
- Never claim to see hidden messages, private keys, viewing keys, notes, or proofs.
- Observe the shared context and determine the current deal state.
- Reason about missing terms, risks, and the logical next step.
- When useful, call a proposal tool instead of only writing advice.
- Proposals must remain review-ready drafts.
- Never sign, send, fund, release, refund, or execute blockchain transactions.
- Every financial action requires explicit user approval and wallet confirmation.
- Ready/wallet remains the final transaction authority.
- Be concise and practical.
`;

export async function runVinssAgent(input: {
  message: string;
  context: DealContext;
  feeBps: number;
}) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured on the server.",
    );
  }

  const client = new Groq({ apiKey });

  const dealStage = inferDealStage(input.context);

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

  let proposal: AgentProposal | null = null;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const response = await client.chat.completions.create({
      model:
        process.env.GROQ_MODEL ||
        "openai/gpt-oss-120b",
      messages,
      tools: getToolDefinitions() as any,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const message = response.choices[0]?.message;

    if (!message) {
      throw new Error(
        "Groq returned an empty response.",
      );
    }

    if (!message.tool_calls?.length) {
      return {
        answer:
          message.content ||
          "No recommendation available.",
        dealStage,
        proposal,
      };
    }

    messages.push(message);

    for (const call of message.tool_calls) {
      const args = JSON.parse(
        call.function.arguments || "{}",
      );

      const result = executeTool(
        call.function.name,
        args,
        input.context,
        input.feeBps,
      );

      if (isAgentProposal(result)) {
        proposal = result;
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error(
    "Agent reached its maximum tool iterations.",
  );
}
