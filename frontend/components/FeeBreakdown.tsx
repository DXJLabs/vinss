import { quoteVinssFee } from "@/lib/agent";

function formatAmount(
  value: number,
  unit?: string,
) {
  const formatted = value.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 4,
    },
  );

  return unit
    ? `${formatted} ${unit}`
    : formatted;
}

export function FeeBreakdown({
  amount,
  label = "Estimated service fee",
  feeBps,
  unit,
}: {
  amount: string;
  label?: string;
  feeBps?: number;
  unit?: string;
}) {
  const quote = quoteVinssFee(
    amount,
    feeBps,
  );

  if (!quote) return null;

  return (
    <div
      className="border border-wire bg-vault/50 px-3 py-3 text-xs"
      data-testid="fee-breakdown"
    >
      <div className="flex justify-between gap-3 text-paper/50">
        <span>Deal value</span>
        <span className="text-right">
          {formatAmount(
            quote.amount,
            unit,
          )}
        </span>
      </div>

      <div className="mt-1 flex justify-between gap-3 text-paper/50">
        <span>
          {label} ·{" "}
          {quote.feeBps / 100}%
        </span>
        <span className="text-right">
          {formatAmount(
            quote.fee,
            unit,
          )}
        </span>
      </div>

      <div className="mt-2 flex justify-between gap-3 border-t border-wire pt-2 font-display text-paper">
        <span>Review total</span>
        <span className="text-right">
          {formatAmount(
            quote.total,
            unit,
          )}
        </span>
      </div>
    </div>
  );
}
