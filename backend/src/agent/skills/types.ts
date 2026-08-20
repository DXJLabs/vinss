export type AgentSkillId = "chat" | "offer" | "escrow";

export interface AgentSkill {
  id: AgentSkillId;
  description: string;
  instructions: string;
  allowedTools: readonly string[];
}
