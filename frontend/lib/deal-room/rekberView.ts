import type { EscrowActionPayload } from "@/types/deal-room";

/*
 * Pure Rekber presentation/normalization helpers.
 * These functions must remain side-effect free: no wallet calls, RPC,
 * storage access, or React state belongs in this module.
 */
export function canonicalLocator(
  value: string | undefined,
): string {
  if (!value) return "";
  return value
    .replace(/^0x/, "")
    .toLowerCase();
}

export function toBigInt(
  value: string | undefined,
): bigint | null {
  if (!value) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function formatDeadline(
  unixSeconds: number,
): string {
  if (!unixSeconds) return "—";

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(unixSeconds * 1000),
  );
}

export function formatRefundDuration(
  totalSeconds: number,
): string {
  if (totalSeconds <= 0) {
    return "Available now";
  }

  const days =
    Math.floor(
      totalSeconds / 86_400,
    );

  const hours =
    Math.floor(
      (totalSeconds % 86_400) /
        3_600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3_600) /
        60,
    );

  const seconds =
    totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function hasCustody(
  action: EscrowActionPayload,
  custody: bigint | null,
): boolean {
  if (!custody) return false;
  const parsed = toBigInt(
    action.custodyCommitment,
  );
  return parsed === custody;
}
