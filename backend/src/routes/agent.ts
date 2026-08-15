import { Router, type Request, type Response } from "express";
import { runVinssAgent } from "../agent/groq.js";

export const agentRouter = Router();

agentRouter.post("/agent", async (req: Request, res: Response) => {
  const body = req.body as { message?: unknown; context?: unknown };
  if (typeof body.message !== "string" || !body.message.trim()) {
    return res.status(400).json({ error: "message is required." });
  }
  if (!body.context || typeof body.context !== "object") {
    return res.status(400).json({ error: "context must be explicitly shared by the user." });
  }

  try {
    const feeBps = Number(process.env.VINSS_FEE_BPS ?? "25");
    const result = await runVinssAgent({ message: body.message.trim(), context: body.context as any, feeBps });
    return res.json({ ...result, contextShared: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Agent failed." });
  }
});
