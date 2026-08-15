export type LoyaltyEvent =
  | "message_sent"
  | "offer_created"
  | "offer_accepted"
  | "escrow_created"
  | "escrow_funded"
  | "deal_completed"
  | "referral_created"
  | "referral_activated";

export type LoyaltyEntry = {
  id: string;
  event: LoyaltyEvent;
  points: number;
  createdAt: string;
  label: string;
};

export const LOYALTY_REWARDS: Record<LoyaltyEvent, number> = {
  message_sent: 1,
  offer_created: 25,
  offer_accepted: 50,
  escrow_created: 50,
  escrow_funded: 100,
  deal_completed: 250,
  referral_created: 100,
  referral_activated: 500,
};

export const LOYALTY_LABELS: Record<LoyaltyEvent, string> = {
  message_sent: "Message sent",
  offer_created: "Offer created",
  offer_accepted: "Offer accepted",
  escrow_created: "Escrow created",
  escrow_funded: "Escrow funded",
  deal_completed: "Deal completed",
  referral_created: "Invite created",
  referral_activated: "Referral activated",
};

export const LOYALTY_LEVELS = [
  { name: "STARTER", min: 0, multiplier: 1 },
  { name: "BRONZE", min: 500, multiplier: 1.05 },
  { name: "SILVER", min: 2500, multiplier: 1.1 },
  { name: "GOLD", min: 10000, multiplier: 1.25 },
  { name: "PLATINUM", min: 50000, multiplier: 1.5 },
  { name: "DIAMOND", min: 250000, multiplier: 2 },
] as const;

export function getLoyaltyLevel(points: number) {
  const current =
    [...LOYALTY_LEVELS]
      .reverse()
      .find((level) => points >= level.min) ?? LOYALTY_LEVELS[0];

  const index = LOYALTY_LEVELS.findIndex(
    (level) => level.name === current.name,
  );

  const next = LOYALTY_LEVELS[index + 1] ?? null;

  return { current, next };
}

export function createLoyaltyEntry(event: LoyaltyEvent): LoyaltyEntry {
  return {
    id: crypto.randomUUID(),
    event,
    points: LOYALTY_REWARDS[event],
    createdAt: new Date().toISOString(),
    label: LOYALTY_LABELS[event],
  };
}
