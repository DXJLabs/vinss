/** Display only the on-chain VINSS service quote, never transfer principal. */
export type FlatVinssAction = "roomActivation" | "message" | "offer";

const ACTION_LABELS: Record<FlatVinssAction, string> = {
  roomActivation: "Room activation",
  message: "Message",
  offer: "Offer",
};

export function formatLiveFeeStrk(wei: bigint): string {
  if (wei < 0n) throw new Error("Invalid negative on-chain fee");
  const scale = 10n ** 18n;
  const whole = wei / scale;
  const fraction = (wei % scale).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? "." + fraction : ""} STRK`;
}

export function createLiveFeeRow(
  id: FlatVinssAction,
  fee: bigint,
): { id: FlatVinssAction; label: string; serviceFee: string } {
  return {
    id,
    label: ACTION_LABELS[id],
    serviceFee: formatLiveFeeStrk(fee),
  };
}
