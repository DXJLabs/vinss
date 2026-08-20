import type {
  AgentProposal,
  DealContext,
  DealStage,
} from "../tools.js";
import type {
  AgentSkill,
} from "../skills/types.js";

export type VinssLlmProvider =
  | "groq"
  | "openai"
  | "anthropic"
  | "qwen";

export type VinssLlmSelection =
  | VinssLlmProvider
  | "auto";

export interface AgentProviderInput {
  message: string;
  context: DealContext;
  feeBps: number;
  skill: AgentSkill;
}

export interface AgentProviderResult {
  answer: string;
  dealStage: DealStage;
  proposal: AgentProposal | null;
  provider: VinssLlmProvider;
  model: string;
}

export interface AgentProvider {
  id: VinssLlmProvider;
  isConfigured(): boolean;
  run(
    input: AgentProviderInput,
  ): Promise<AgentProviderResult>;
}
