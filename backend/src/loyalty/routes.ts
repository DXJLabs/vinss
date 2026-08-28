import {
  Router,
  type Request,
  type Response,
} from "express";

import { config } from "../config.js";
import {
  awardAction,
  getLoyalty,
  getLoyaltyRules,
} from "./service.js";
import type { LoyaltyAction } from "./types.js";

export const loyaltyRouter = Router();

const ACTIONS: LoyaltyAction[] = [
  "message_sent",
  "offer_created",
  "offer_countered",
  "offer_accepted",
  "work_submitted",
  "work_reviewed",
  "referral_joined",
  "referral_activated",
  "referral_converted",
  "rekber_released",
  "rekber_refunded",
];

loyaltyRouter.get(
  "/loyalty/config",
  (_req: Request, res: Response) => {
    return res.json({
      network: config.network,
      ...getLoyaltyRules(),
    });
  },
);

loyaltyRouter.get(
  "/loyalty/:subject",
  (req: Request, res: Response) => {
    return res.json(
      getLoyalty(config.network, req.params.subject),
    );
  },
);

loyaltyRouter.post(
  "/loyalty/events",
  (req: Request, res: Response) => {
    const { subject, action, eventId } = req.body ?? {};

    if (
      typeof subject !== "string" ||
      typeof action !== "string" ||
      typeof eventId !== "string"
    ) {
      return res.status(400).json({
        error:
          "subject, action and eventId are required",
      });
    }

    if (!ACTIONS.includes(action as LoyaltyAction)) {
      return res.status(400).json({
        error: `invalid loyalty action: ${action}`,
      });
    }

    try {
      return res.json(
        awardAction(
          config.network,
          subject,
          action as LoyaltyAction,
          eventId,
        ),
      );
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid loyalty event",
      });
    }
  },
);
