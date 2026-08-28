export const BASE_POINTS = {
  message_sent: 1,
  offer_created: 5,
  offer_countered: 5,
  offer_accepted: 10,
  work_submitted: 10,
  work_reviewed: 10,
  referral_joined: 25,
  referral_activated: 25,
  referral_converted: 100,
  rekber_released: 100,
  rekber_refunded: 0,
} as const;

export type LoyaltyBaseAction =
  keyof typeof BASE_POINTS;

export interface CertificateTier {
  minCertificates: number;
  maxCertificates: number | null;
  multiplierBps: number;
}

export const CERTIFICATE_TIERS:
  readonly CertificateTier[] = [
  { minCertificates: 51, maxCertificates: null, multiplierBps: 20_000 },
  { minCertificates: 26, maxCertificates: 50, multiplierBps: 17_500 },
  { minCertificates: 11, maxCertificates: 25, multiplierBps: 15_000 },
  { minCertificates: 6, maxCertificates: 10, multiplierBps: 13_500 },
  { minCertificates: 3, maxCertificates: 5, multiplierBps: 12_000 },
  { minCertificates: 1, maxCertificates: 2, multiplierBps: 11_000 },
  { minCertificates: 0, maxCertificates: 0, multiplierBps: 10_000 },
];

export function certificateMultiplierBps(
  certificateCount: number,
): number {
  if (!Number.isSafeInteger(certificateCount) || certificateCount < 0) {
    throw new Error(
      "certificateCount must be a non-negative integer.",
    );
  }

  return (
    CERTIFICATE_TIERS.find(
      (tier) =>
        certificateCount >= tier.minCertificates &&
        (tier.maxCertificates === null ||
          certificateCount <= tier.maxCertificates),
    ) ?? CERTIFICATE_TIERS.at(-1)!
  ).multiplierBps;
}

export function basePointsForAction(
  action: LoyaltyBaseAction,
): number {
  return BASE_POINTS[action];
}

function assertBps(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${label} must be an integer from 0 to 10000.`);
  }
}

/**
 * Points use the resolver decision ratio BEFORE the VINSS dispute fee.
 * A 30:70 decision stays 30:70 for loyalty even if cash later becomes
 * 27% payer / 63% payee / 10% VINSS.
 */
export function calculateRekberReward(input: {
  outcome: "released" | "resolved" | "refunded";
  certificateCount: number;
  shareBps?: number;
}): number {
  if (input.outcome === "refunded") return 0;

  const shareBps =
    input.outcome === "released" ? 10_000 : input.shareBps;

  if (shareBps === undefined) {
    throw new Error("resolved Rekber reward requires shareBps.");
  }

  assertBps(shareBps, "shareBps");

  const multiplierBps =
    certificateMultiplierBps(input.certificateCount);

  // floor: deterministic integer points, no fractional inflation.
  return Number(
    (100n * BigInt(shareBps) * BigInt(multiplierBps)) /
      100_000_000n,
  );
}

export function resolutionShareBps(
  payerAmount: bigint,
  payeeAmount: bigint,
): { payerBps: number; payeeBps: number } {
  if (payerAmount < 0n || payeeAmount < 0n) {
    throw new Error("resolution amounts cannot be negative.");
  }

  const total = payerAmount + payeeAmount;
  if (total === 0n) {
    throw new Error("resolution allocation cannot be zero.");
  }

  const payerBps = Number((payerAmount * 10_000n) / total);
  return {
    payerBps,
    payeeBps: 10_000 - payerBps,
  };
}
