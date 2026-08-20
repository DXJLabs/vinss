import type {
  AgentSkill,
} from "./types.js";

export const chatSkill: AgentSkill = {
  id: "chat",
  description:
    "Private messaging and conversation assistance.",
  instructions: `
Chat skill:
- Help with private-message workflow only.
- You may draft a message, but never send it.
- Do not create/counter offers or prepare escrow.
- If private plaintext was not explicitly submitted in the user's instruction, do not pretend to know it.
`,
  allowedTools: [
    "inspect_deal_state",
    "draft_message",
  ],
};
