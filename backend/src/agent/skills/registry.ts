import {
  chatSkill,
} from "./chat.js";
import {
  offerSkill,
} from "./offer.js";
import {
  escrowSkill,
} from "./escrow.js";
import type {
  AgentSkill,
  AgentSkillId,
} from "./types.js";

const SKILLS: Record<
  AgentSkillId,
  AgentSkill
> = {
  chat: chatSkill,
  offer: offerSkill,
  escrow: escrowSkill,
};

export function isAgentSkillId(
  value: unknown,
): value is AgentSkillId {
  return (
    value === "chat" ||
    value === "offer" ||
    value === "escrow"
  );
}

export function getAgentSkill(
  id: AgentSkillId,
): AgentSkill {
  return SKILLS[id];
}

export function listAgentSkills():
  AgentSkillId[] {
  return Object.keys(
    SKILLS,
  ) as AgentSkillId[];
}
