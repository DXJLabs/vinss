import { Router, type Request, type Response } from "express";
import { awardAction, getLoyalty, getLoyaltyRules } from "./service.js";
import type { LoyaltyAction } from "./types.js";

export const loyaltyRouter = Router();

const ACTIONS: LoyaltyAction[] = [
  "message_sent",
  "offer_created",
  "offer_accepted",
  "escrow_created",
  "escrow_funded",
  "deal_completed",
  "invite_user",
  "successful_referral",
];

loyaltyRouter.get("/loyalty/config", (_req: Request, res: Response) => {
  return res.json(getLoyaltyRules());
});

loyaltyRouter.get("/loyalty/:subject", (req: Request, res: Response) => {
  return res.json(getLoyalty(req.params.subject));
});

loyaltyRouter.post("/loyalty/events", (req: Request, res: Response) => {
  const { subject, action, eventId } = req.body ?? {};

  if (
    typeof subject !== "string" ||
    typeof action !== "string" ||
    typeof eventId !== "string"
  ) {
    return res.status(400).json({
      error: "subject, action and eventId are required",
    });
  }

  if (!ACTIONS.includes(action as LoyaltyAction)) {
    return res.status(400).json({
      error: `invalid loyalty action: ${action}`,
    });
  }

  try {
    return res.json(awardAction(subject, action as LoyaltyAction, eventId));
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid loyalty event",
    });
  }
});
