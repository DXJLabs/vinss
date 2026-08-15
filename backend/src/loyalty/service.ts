import type {
  LoyaltyAccount,
  LoyaltyAction,
  LoyaltyEvent,
  LoyaltyLevel,
} from "./types.js";

const POINTS: Record<LoyaltyAction, number> = {
  message_sent: 1,
  offer_created: 25,
  offer_accepted: 50,
  escrow_created: 50,
  escrow_funded: 100,
  deal_completed: 250,
  invite_user: 100,
  successful_referral: 500,
};

const LEVELS: Array<{
  level: LoyaltyLevel;
  minPoints: number;
  multiplier: number;
}> = [
  { level: "DIAMOND", minPoints: 250_000, multiplier: 2.0 },
  { level: "PLATINUM", minPoints: 50_000, multiplier: 1.5 },
  { level: "GOLD", minPoints: 10_000, multiplier: 1.25 },
  { level: "SILVER", minPoints: 2_500, multiplier: 1.1 },
  { level: "BRONZE", minPoints: 500, multiplier: 1.05 },
  { level: "STARTER", minPoints: 0, multiplier: 1.0 },
];

const accounts = new Map<string, LoyaltyAccount>();
const events = new Map<string, LoyaltyEvent>();

export function pointsForAction(action: LoyaltyAction): number {
  return POINTS[action];
}

export function getLevel(points: number) {
  return LEVELS.find((entry) => points >= entry.minPoints) ?? LEVELS.at(-1)!;
}

export function getLoyalty(subject: string): LoyaltyAccount {
  const existing = accounts.get(subject);
  if (existing) return { ...existing };

  return {
    subject,
    points: 0,
    level: "STARTER",
    multiplier: 1.0,
  };
}

export function awardAction(
  subject: string,
  action: LoyaltyAction,
  eventId: string,
): LoyaltyAccount {
  if (!subject.trim()) throw new Error("subject is required");
  if (!eventId.trim()) throw new Error("eventId is required");

  const existingEvent = events.get(eventId);

  // Idempotent: the same blockchain/application event cannot award points twice.
  if (existingEvent) {
    return getLoyalty(existingEvent.subject);
  }

  const earned = pointsForAction(action);
  const current = getLoyalty(subject);
  const totalPoints = current.points + earned;
  const level = getLevel(totalPoints);

  const account: LoyaltyAccount = {
    subject,
    points: totalPoints,
    level: level.level,
    multiplier: level.multiplier,
  };

  accounts.set(subject, account);

  events.set(eventId, {
    eventId,
    subject,
    action,
    points: earned,
    createdAt: new Date().toISOString(),
  });

  return { ...account };
}

export function getLoyaltyRules() {
  return {
    points: { ...POINTS },
    levels: LEVELS.map((entry) => ({ ...entry })),
  };
}
