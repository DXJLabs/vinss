export type AgentSkillId =
  | "chat"
  | "offer"
  | "escrow"
  | "dispute";

export type PublicAgentSkillId =
  Exclude<
    AgentSkillId,
    "dispute"
  >;

export interface AgentSkill {
  id: AgentSkillId;
  description: string;
  instructions: string;
  allowedTools: readonly string[];
}
