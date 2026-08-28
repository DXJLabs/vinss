import type { StarknetNetwork } from "../config.js";
import type { LoyaltyBaseAction } from "./rules.js";

export type LoyaltyLevel =
  | "STARTER"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND";

export type LoyaltyAction = LoyaltyBaseAction;

export interface LoyaltyAccount {
  network: StarknetNetwork;
  subject: string;
  points: number;
  level: LoyaltyLevel;
  multiplier: number;
}

export interface LoyaltyEvent {
  network: StarknetNetwork;
  eventId: string;
  subject: string;
  action: LoyaltyAction;
  points: number;
  createdAt: string;
}
