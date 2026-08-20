import {
  Router,
  type Request,
  type Response,
} from "express";
import {
  configuredProviders,
  isLlmSelection,
  runVinssAgent,
} from "../agent/router.js";

export const agentRouter =
  Router();

agentRouter.get(
  "/agent/providers",
  (
    _req: Request,
    res: Response,
  ) => {
    return res.json({
      defaultProvider:
        process.env
          .VINSS_LLM_PROVIDER ||
        "groq",
      configuredProviders:
        configuredProviders(),
    });
  },
);

agentRouter.post(
  "/agent",
  async (
    req: Request,
    res: Response,
  ) => {
    const body = req.body as {
      message?: unknown;
      context?: unknown;
      provider?: unknown;
    };

    if (
      typeof body.message !==
        "string" ||
      !body.message.trim()
    ) {
      return res.status(400).json({
        error:
          "message is required.",
      });
    }

    if (
      !body.context ||
      typeof body.context !==
        "object"
    ) {
      return res.status(400).json({
        error:
          "context must be explicitly shared by the user.",
      });
    }

    if (
      body.provider !== undefined &&
      !isLlmSelection(
        body.provider,
      )
    ) {
      return res.status(400).json({
        error:
          "provider must be auto, groq, openai, anthropic, or qwen.",
      });
    }

    try {
      const feeBps = Number(
        process.env
          .VINSS_FEE_BPS ??
          "25",
      );

      const result =
        await runVinssAgent({
          message:
            body.message.trim(),
          context:
            body.context as any,
          feeBps,
          provider:
            body.provider as any,
        });

      return res.json({
        ...result,
        contextShared: true,
      });
    } catch (err) {
      return res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : "Agent failed.",
      });
    }
  },
);
