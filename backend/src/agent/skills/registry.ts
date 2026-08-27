import { chatSkill } from "./chat.js";
import { offerSkill } from "./offer.js";
import { escrowSkill } from "./escrow.js";
import { disputeSkill } from "./dispute.js";
import type {
  AgentSkill,
  AgentSkillId,
  PublicAgentSkillId,
} from "./types.js";

const SKILLS: Record<AgentSkillId, AgentSkill> = {
  chat: chatSkill,
  offer: offerSkill,
  escrow: escrowSkill,
  dispute: disputeSkill,
};

export function isAgentSkillId(
  value: unknown,
): value is AgentSkillId {
  return (
    value === "chat" ||
    value === "offer" ||
    value === "escrow" ||
    value === "dispute"
  );
}

/*
 * /agent remains privacy-safe and dispute-plaintext-free.
 * Dedicated dispute evaluation never enters through this public skill list.
 */
export function isPublicAgentSkillId(
  value: unknown,
): value is PublicAgentSkillId {
  return (
    value === "chat" ||
    value === "offer" ||
    value === "escrow"
  );
}

export function getAgentSkill(id: AgentSkillId): AgentSkill {
  return SKILLS[id];
}

export function listAgentSkills(): AgentSkillId[] {
  return Object.keys(SKILLS) as AgentSkillId[];
}
