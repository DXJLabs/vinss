import { quoteVinssFee } from "@/lib/agent";

export function FeeBreakdown({
  amount,
  label = "Estimated service fee",
  feeBps,
}: {
  amount: string;
  label?: string;
  feeBps?: number;
}) {
  const quote = quoteVinssFee(amount, feeBps);
  if (!quote) return null;
  return (
    <div className="border border-wire bg-vault/50 px-3 py-3 text-xs" data-testid="fee-breakdown">
      <div className="flex justify-between text-paper/50"><span>Deal value</span><span>{quote.amount.toLocaleString("en-US")}</span></div>
      <div className="mt-1 flex justify-between text-paper/50"><span>{label} · {quote.feeBps / 100}%</span><span>{quote.fee.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span></div>
      <div className="mt-2 flex justify-between border-t border-wire pt-2 font-display text-paper"><span>Review total</span><span>{quote.total.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span></div>
    </div>
  );
}
