export interface DealContext {
  roomLabel?: string;
  latestOffer?: {
    asset: string;
    amount: string;
    paymentTerms: string;
    conditions?: string;
  };
  timeline?: Array<{ kind: string; summary: string; sentAt?: string }>;
}

export function calculateFee(amount: string, feeBps = 25) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid amount");
  const fee = (value * feeBps) / 10_000;
  return { amount: value, feeBps, fee, total: value + fee };
}

export function analyzeOffer(context: DealContext) {
  const offer = context.latestOffer;
  if (!offer) return { riskLevel: "unknown", findings: ["No offer context was provided."] };
  const findings: string[] = [];
  if (!offer.paymentTerms.trim()) findings.push("Payment timing is not specified.");
  if (!offer.conditions?.trim()) findings.push("No explicit conditions were provided.");
  const numericAmount = Number(offer.amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) findings.push("Offer amount is missing or invalid.");
  return {
    riskLevel: findings.length >= 2 ? "review" : findings.length === 1 ? "watch" : "clear",
    findings,
    offer,
  };
}

export function draftCounterOffer(context: DealContext, amount?: string, terms?: string) {
  const offer = context.latestOffer;
  if (!offer) throw new Error("An offer is required to draft a counter-offer.");
  return {
    asset: offer.asset,
    amount: amount?.trim() || offer.amount,
    paymentTerms: terms?.trim() || offer.paymentTerms,
    conditions: offer.conditions || "Confirm settlement deadline before signing.",
    basedOn: offer.amount,
  };
}

export function getToolDefinitions() {
  return [
    {
      type: "function" as const,
      function: {
        name: "analyze_offer",
        description: "Analyze only the deal context explicitly shared by the user.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "draft_counter_offer",
        description: "Prepare a counter-offer draft. Never signs or sends a transaction.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "string" },
            terms: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "calculate_fee",
        description: "Calculate an illustrative VINSS service fee from a user-provided amount.",
        parameters: {
          type: "object",
          properties: { amount: { type: "string" } },
          required: ["amount"],
          additionalProperties: false,
        },
      },
    },
  ];
}

export function executeTool(name: string, args: Record<string, unknown>, context: DealContext, feeBps: number) {
  switch (name) {
    case "analyze_offer":
      return analyzeOffer(context);
    case "draft_counter_offer":
      return draftCounterOffer(context, String(args.amount ?? ""), String(args.terms ?? ""));
    case "calculate_fee":
      return calculateFee(String(args.amount ?? ""), feeBps);
    default:
      throw new Error(`Tool not allowed: ${name}`);
  }
}
