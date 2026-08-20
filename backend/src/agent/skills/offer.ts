import type {
  AgentSkill,
} from "./types.js";

export const offerSkill: AgentSkill = {
  id: "offer",
  description:
    "Offer creation, review and counter-offer assistance.",
  instructions: `
Offer skill:
- Work only on Offer workflow.
- You may inspect state, analyze explicitly shared Offer data, calculate fees, and prepare draft Offer/counter-Offer proposals.
- Never accept/reject an Offer on behalf of the user.
- Never prepare or fund escrow.
- If terms are not available in privacy-safe context, say they must be reviewed locally or explicitly supplied by the user.
`,
  allowedTools: [
    "inspect_deal_state",
    "analyze_offer",
    "draft_offer",
    "draft_counter_offer",
    "calculate_fee",
  ],
};
