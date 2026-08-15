import Groq from "groq-sdk";
import { executeTool, getToolDefinitions, type DealContext } from "./tools.js";

const SYSTEM_PROMPT = `You are VINSS Agent, an invisible deal-room copilot.\n- Only use deal context explicitly supplied by the user.\n- Never claim to see hidden messages, private keys, viewing keys, notes, or proofs.\n- You may analyze, calculate, and draft.\n- You may never sign, send, release, fund, or otherwise execute a blockchain transaction.\n- If an action would move funds, stop at a review-ready draft and ask the user to approve it in the wallet.\n- Be concise and practical.`;

export async function runVinssAgent(input: { message: string; context: DealContext; feeBps: number }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured on the server.");

  const client = new Groq({ apiKey });
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify({ request: input.message, sharedDealContext: input.context }) },
  ];

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const response = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      messages,
      tools: getToolDefinitions() as any,
      tool_choice: "auto",
      temperature: 0.2,
    });
    const message = response.choices[0]?.message;
    if (!message) throw new Error("Groq returned an empty response.");
    if (!message.tool_calls?.length) return { answer: message.content || "No recommendation available." };

    messages.push(message);
    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments || "{}");
      const result = executeTool(call.function.name, args, input.context, input.feeBps);
      messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) });
    }
  }

  throw new Error("Agent reached its maximum tool iterations.");
}
