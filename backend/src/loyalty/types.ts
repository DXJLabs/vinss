export type LoyaltyLevel =
  "STARTER" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

export type LoyaltyAction =
  | "message_sent"
  | "offer_created"
  | "offer_accepted"
  | "escrow_created"
  | "escrow_funded"
  | "deal_completed"
  | "invite_user"
  | "successful_referral";

export interface LoyaltyAccount {
  subject: string;
  points: number;
  level: LoyaltyLevel;
  multiplier: number;
}

export interface LoyaltyEvent {
  eventId: string;
  subject: string;
  action: LoyaltyAction;
  points: number;
  createdAt: string;
}
