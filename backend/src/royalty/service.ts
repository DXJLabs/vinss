export const BASE_SETTLEMENT_POINTS = 200;

const MULTIPLIER_TIERS = [
  {
    minCertificates: 10,
    multiplier: 2,
  },
  {
    minCertificates: 5,
    multiplier: 1.75,
  },
  {
    minCertificates: 3,
    multiplier: 1.5,
  },
  {
    minCertificates: 1,
    multiplier: 1.25,
  },
  {
    minCertificates: 0,
    multiplier: 1,
  },
] as const;

export function getCertificateMultiplier(
  certificateCount: number,
): number {
  return (
    MULTIPLIER_TIERS.find(
      (tier) =>
        certificateCount >=
        tier.minCertificates,
    )?.multiplier ?? 1
  );
}

export function getNextCertificateTier(
  certificateCount: number,
): {
  certificateTarget: number;
  multiplier: number;
} | null {
  if (certificateCount < 1) {
    return {
      certificateTarget: 1,
      multiplier: 1.25,
    };
  }

  if (certificateCount < 3) {
    return {
      certificateTarget: 3,
      multiplier: 1.5,
    };
  }

  if (certificateCount < 5) {
    return {
      certificateTarget: 5,
      multiplier: 1.75,
    };
  }

  if (certificateCount < 10) {
    return {
      certificateTarget: 10,
      multiplier: 2,
    };
  }

  return null;
}

export function calculateRoyalty(input: {
  certificateCount: number;
  successfulSettlements: number;
}) {
  const certificateCount = Math.max(
    0,
    Math.floor(input.certificateCount),
  );

  const successfulSettlements = Math.max(
    0,
    Math.floor(input.successfulSettlements),
  );

  const multiplier =
    getCertificateMultiplier(
      certificateCount,
    );

  const basePoints =
    successfulSettlements *
    BASE_SETTLEMENT_POINTS;

  const points = Math.round(
    basePoints * multiplier,
  );

  const next =
    getNextCertificateTier(
      certificateCount,
    );

  return {
    points,
    basePoints,
    certificateCount,
    successfulSettlements,
    multiplier,
    nextCertificateTarget:
      next?.certificateTarget ?? null,
    nextMultiplier:
      next?.multiplier ?? null,
  };
}
