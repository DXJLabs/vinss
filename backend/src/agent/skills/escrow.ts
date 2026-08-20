import type { AgentSkill } from "./types.js";

export const escrowSkill: AgentSkill = {
  id: "escrow",
  description: "Escrow readiness and settlement assistance.",
  instructions: `
Escrow skill:
- Work only on escrow/rekber workflow.
- You may inspect state, calculate fees, prepare escrow coordination, and prepare a settlement review.
- Never deposit, release, refund, sign, or move funds.
- Do not draft chat messages or create/counter offers.
`,
  allowedTools: [
    "inspect_deal_state",
    "prepare_escrow",
    "review_rekber",
    "calculate_fee",
  ],
};
