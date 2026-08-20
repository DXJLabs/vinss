import { Router, type Request, type Response } from "express";

import { sanitizeAgentContext } from "../agent/context.js";
import { runVinssAgent } from "../agent/index.js";
import {
  configuredProviders,
  isLlmSelection,
} from "../agent/providers/registry.js";
import { isAgentSkillId, listAgentSkills } from "../agent/skills/registry.js";

interface AgentRequestBody {
  message?: unknown;
  context?: unknown;
  skill?: unknown;
  provider?: unknown;
}

export const agentRouter = Router();

agentRouter.get("/agent/providers", (_req: Request, res: Response) => {
  return res.json({
    defaultProvider: process.env.VINSS_LLM_PROVIDER ?? "groq",
    configuredProviders: configuredProviders(),
    skills: listAgentSkills(),
  });
});

agentRouter.post("/agent", async (req: Request, res: Response) => {
  const body = req.body as AgentRequestBody;

  if (typeof body.message !== "string" || !body.message.trim()) {
    return res.status(400).json({
      error: "message is required.",
    });
  }

  if (!body.context || typeof body.context !== "object") {
    return res.status(400).json({
      error: "privacy-safe context is required.",
    });
  }

  if (!isAgentSkillId(body.skill)) {
    return res.status(400).json({
      error: "skill must be chat, offer, or escrow.",
    });
  }

  if (body.provider !== undefined && !isLlmSelection(body.provider)) {
    return res.status(400).json({
      error: "provider must be auto, groq, openai, anthropic, or qwen.",
    });
  }

  try {
    const result = await runVinssAgent({
      message: body.message.trim(),
      context: sanitizeAgentContext(body.context),
      feeBps: Number(process.env.VINSS_FEE_BPS ?? "25"),
      skill: body.skill,
      provider: body.provider,
    });

    return res.json({
      ...result,
      contextShared: true,
    });
  } catch {
    return res.status(500).json({
      error: "Agent failed.",
    });
  }
});
