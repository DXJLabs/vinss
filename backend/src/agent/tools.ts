export interface AgentTimelineItem {
  kind: string;
  summary: string;
  sentAt?: string;
  actionLocator?: string;
}

export interface DealContext {
  roomLabel?: string;

  latestOffer?: {
    asset?: string;
    amount?: string;
    paymentTerms?: string;
    conditions?: string;
    actionLocator?: string;
  };

  timeline?: AgentTimelineItem[];
}

export type DealStage =
  | "discussion"
  | "negotiating"
  | "offer_pending"
  | "agreed"
  | "escrow_pending"
  | "funded"
  | "rekber_pending"
  | "completed";

export type AgentProposal =
  | {
      type: "draft_message";
      title: string;
      description: string;
      requiresApproval: true;
      payload: {
        body: string;
      };
    }
  | {
      type: "draft_offer" | "draft_counter_offer";
      title: string;
      description: string;
      requiresApproval: true;
      payload: {
        asset: string;
        amount: string;
        paymentTerms: string;
        conditions?: string;
      };
    }
  | {
      type: "prepare_escrow";
      title: string;
      description: string;
      requiresApproval: true;
      payload: {
        dealOfferLocator?: string;
        amount?: string;
        token?: string;
        refundHours?: string;
      };
    }
  | {
      type: "review_rekber";
      title: string;
      description: string;
      requiresApproval: true;
      payload: {
        reason: string;
      };
    };

export function calculateFee(amount: string, feeBps = 25) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid amount");
  }

  const fee = (value * feeBps) / 10_000;

  return {
    amount: value,
    feeBps,
    fee,
    total: value + fee,
  };
}

export function inferDealStage(context: DealContext): DealStage {
  const timeline = context.timeline ?? [];

  const text = timeline
    .map((item) => item.summary.toLowerCase())
    .join("\n");

  if (
    text.includes("complete deal") ||
    text.includes("rekber complete") ||
    text.includes("released")
  ) {
    return "completed";
  }

  if (
    text.includes("rekber") ||
    text.includes("release escrow")
  ) {
    return "rekber_pending";
  }

  if (
    text.includes("escrow deposit") ||
    text.includes("fund_confirm") ||
    text.includes("funded")
  ) {
    return "funded";
  }

  if (
    text.includes("escrow ready") ||
    text.includes("prepare_escrow")
  ) {
    return "escrow_pending";
  }

  if (
    text.includes("accept offer") ||
    text.includes("accept —")
  ) {
    return "agreed";
  }

  if (context.latestOffer) {
    return "offer_pending";
  }

  if (timeline.length > 0) {
    return "negotiating";
  }

  return "discussion";
}

export function analyzeOffer(context: DealContext) {
  const offer = context.latestOffer;

  if (!offer) {
    return {
      riskLevel: "unknown",
      findings: ["No offer context was provided."],
    };
  }

  const findings: string[] = [];

  if (!offer.paymentTerms?.trim()) {
    findings.push(
      "Payment timing is not available in the shared context.",
    );
  }

  if (!offer.conditions?.trim()) {
    findings.push(
      "Conditions are not available in the shared context.",
    );
  }

  const numericAmount = Number(
    offer.amount,
  );

  if (
    !offer.amount ||
    !Number.isFinite(
      numericAmount,
    ) ||
    numericAmount <= 0
  ) {
    findings.push(
      "Offer amount is not available or invalid.",
    );
  }

  return {
    riskLevel:
      findings.length >= 2
        ? "review"
        : findings.length === 1
          ? "watch"
          : "clear",
    findings,
    offer,
  };
}

export function draftMessage(body: string): AgentProposal {
  if (!body.trim()) {
    throw new Error("Message body is required.");
  }

  return {
    type: "draft_message",
    title: "Draft private message",
    description: "Prepare this message in the encrypted room composer.",
    requiresApproval: true,
    payload: {
      body: body.trim(),
    },
  };
}

export function draftOffer(
  asset: string,
  amount: string,
  paymentTerms: string,
  conditions?: string,
): AgentProposal {
  if (!asset.trim() || !amount.trim()) {
    throw new Error("Asset and amount are required.");
  }

  return {
    type: "draft_offer",
    title: "Create offer",
    description: `Prepare an offer for ${amount.trim()} ${asset.trim()}.`,
    requiresApproval: true,
    payload: {
      asset: asset.trim(),
      amount: amount.trim(),
      paymentTerms: paymentTerms.trim() || "Not specified",
      conditions: conditions?.trim() || undefined,
    },
  };
}

export function draftCounterOffer(
  context: DealContext,
  amount?: string,
  terms?: string,
): AgentProposal {
  const offer = context.latestOffer;

  if (!offer) {
    throw new Error("An offer is required to draft a counter-offer.");
  }

  if (
    !offer.asset ||
    !offer.amount ||
    !offer.paymentTerms
  ) {
    throw new Error(
      "Private Offer terms are not available to the remote Agent. Supply the intended counter terms explicitly.",
    );
  }

  const nextAmount =
    amount?.trim() ||
    offer.amount;
  const nextTerms =
    terms?.trim() ||
    offer.paymentTerms;

  return {
    type: "draft_counter_offer",
    title: "Counter offer",
    description: `Prepare a counter offer for ${nextAmount} ${offer.asset}.`,
    requiresApproval: true,
    payload: {
      asset: offer.asset,
      amount: nextAmount,
      paymentTerms: nextTerms,
      conditions:
        offer.conditions ||
        "Confirm rekber deadline before signing.",
    },
  };
}

export function prepareEscrow(
  context: DealContext,
  params: {
    dealOfferLocator?: string;
    amount?: string;
    token?: string;
    refundHours?: string;
  },
): AgentProposal {
  const locator =
    params.dealOfferLocator?.trim() ||
    context.latestOffer?.actionLocator;

  return {
    type: "prepare_escrow",
    title: "Prepare escrow",
    description:
      "Prepare the accepted deal for escrow. No funds will move until wallet approval.",
    requiresApproval: true,
    payload: {
      dealOfferLocator: locator,
      amount: params.amount?.trim() || context.latestOffer?.amount,
      token: params.token?.trim() || undefined,
      refundHours: params.refundHours?.trim() || "24",
    },
  };
}

export function reviewRekber(reason: string): AgentProposal {
  return {
    type: "review_rekber",
    title: "Review rekber",
    description:
      "Review whether the current deal is ready for rekber.",
    requiresApproval: true,
    payload: {
      reason:
        reason.trim() ||
        "Review the current deal state before rekber.",
    },
  };
}

export function isAgentProposal(value: unknown): value is AgentProposal {
  if (!value || typeof value !== "object") return false;

  return (
    "type" in value &&
    "requiresApproval" in value &&
    (value as { requiresApproval?: unknown }).requiresApproval === true
  );
}

export function getToolDefinitions() {
  return [
    {
      type: "function" as const,
      function: {
        name: "inspect_deal_state",
        description:
          "Inspect the current lifecycle stage of the private deal.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },

    {
      type: "function" as const,
      function: {
        name: "analyze_offer",
        description:
          "Analyze only the offer context explicitly shared by the user.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },

    {
      type: "function" as const,
      function: {
        name: "draft_message",
        description:
          "Prepare a private message draft. Never sends it automatically.",
        parameters: {
          type: "object",
          properties: {
            body: { type: "string" },
          },
          required: ["body"],
          additionalProperties: false,
        },
      },
    },

    {
      type: "function" as const,
      function: {
        name: "draft_offer",
        description:
          "Prepare a new offer for user review. Never creates it automatically.",
        parameters: {
          type: "object",
          properties: {
            asset: { type: "string" },
            amount: { type: "string" },
            paymentTerms: { type: "string" },
            conditions: { type: "string" },
          },
          required: ["asset", "amount", "paymentTerms"],
          additionalProperties: false,
        },
      },
    },

    {
      type: "function" as const,
      function: {
        name: "draft_counter_offer",
        description:
          "Prepare a counter-offer from the currently shared offer.",
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
        name: "prepare_escrow",
        description:
          "Prepare escrow coordination from the accepted deal. Never moves funds.",
        parameters: {
          type: "object",
          properties: {
            dealOfferLocator: { type: "string" },
            amount: { type: "string" },
            token: { type: "string" },
            refundHours: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },

    {
      type: "function" as const,
      function: {
        name: "review_rekber",
        description:
          "Prepare a rekber review. Never releases funds.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },

    {
      type: "function" as const,
      function: {
        name: "calculate_fee",
        description:
          "Calculate an illustrative VINSS service fee.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "string" },
          },
          required: ["amount"],
          additionalProperties: false,
        },
      },
    },
  ];
}

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: DealContext,
  feeBps: number,
) {
  switch (name) {
    case "inspect_deal_state":
      return {
        stage: inferDealStage(context),
      };

    case "analyze_offer":
      return analyzeOffer(context);

    case "draft_message":
      return draftMessage(String(args.body ?? ""));

    case "draft_offer":
      return draftOffer(
        String(args.asset ?? ""),
        String(args.amount ?? ""),
        String(args.paymentTerms ?? ""),
        args.conditions == null
          ? undefined
          : String(args.conditions),
      );

    case "draft_counter_offer":
      return draftCounterOffer(
        context,
        String(args.amount ?? ""),
        String(args.terms ?? ""),
      );

    case "prepare_escrow":
      return prepareEscrow(context, {
        dealOfferLocator:
          args.dealOfferLocator == null
            ? undefined
            : String(args.dealOfferLocator),
        amount:
          args.amount == null ? undefined : String(args.amount),
        token:
          args.token == null ? undefined : String(args.token),
        refundHours:
          args.refundHours == null
            ? undefined
            : String(args.refundHours),
      });

    case "review_rekber":
      return reviewRekber(String(args.reason ?? ""));

    case "calculate_fee":
      return calculateFee(
        String(args.amount ?? ""),
        feeBps,
      );

    default:
      throw new Error(`Tool not allowed: ${name}`);
  }
}
