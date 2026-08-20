import {
  BACKEND_URL,
} from "./starknet/constants";

export interface AgentTimelineItem {
  kind: string;
  summary: string;
  sentAt?: string;
  actionLocator?: string;
}

export type AgentSkillId =
  | "chat"
  | "offer"
  | "escrow";

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
      type:
        "draft_message";
      title: string;
      description: string;
      requiresApproval: true;
      payload: {
        body: string;
      };
    }
  | {
      type:
        | "draft_offer"
        | "draft_counter_offer";
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
      type:
        "prepare_escrow";
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
      type:
        "review_rekber";
      title: string;
      description: string;
      requiresApproval: true;
      payload: {
        reason: string;
      };
    };

function privacySafeTimeline(
  timeline: AgentTimelineItem[],
): AgentTimelineItem[] {
  return timeline.map(
    (item) => ({
      kind: item.kind,
      summary:
        item.kind ===
        "offer"
          ? "Encrypted Offer action"
          : item.kind ===
              "message"
            ? "Encrypted private message"
            : "Encrypted private activity",
      sentAt:
        item.sentAt,
      actionLocator:
        item.actionLocator,
    }),
  );
}

function offerLocatorOnly(
  latestOffer: unknown,
):
  | {
      actionLocator: string;
    }
  | undefined {
  if (
    !latestOffer ||
    typeof latestOffer !==
      "object" ||
    !(
      "actionLocator" in
      latestOffer
    )
  ) {
    return undefined;
  }

  const locator =
    (
      latestOffer as {
        actionLocator?: unknown;
      }
    ).actionLocator;

  return typeof locator ===
    "string"
    ? {
        actionLocator:
          locator,
      }
    : undefined;
}

export async function askVinssAgent(
  input: {
    message: string;
    skill: AgentSkillId;
    context: {
      roomLabel?: string;
      latestOffer?: unknown;
      timeline:
        AgentTimelineItem[];
    };
  },
) {
  const response =
    await fetch(
      `${BACKEND_URL}/agent`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            message:
              input.message,
            skill:
              input.skill,
            context: {
              timeline:
                privacySafeTimeline(
                  input.context
                    .timeline,
                ),
              latestOffer:
                offerLocatorOnly(
                  input.context
                    .latestOffer,
                ),
            },
          }),
      },
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
        "Agent request failed.",
    );
  }

  return data as {
    answer: string;
    contextShared: boolean;
    dealStage: DealStage;
    proposal:
      | AgentProposal
      | null;
    skill: AgentSkillId;
    provider:
      | "groq"
      | "openai"
      | "anthropic"
      | "qwen";
    model: string;
  };
}

export function quoteVinssFee(
  amount: string,
  feeBps = Number(
    process.env
      .NEXT_PUBLIC_VINSS_FEE_BPS ??
      "25",
  ),
) {
  const value =
    Number(amount);

  if (
    !Number.isFinite(
      value,
    ) ||
    value < 0
  ) {
    return null;
  }

  const fee =
    (value * feeBps) /
    10_000;

  return {
    amount: value,
    feeBps,
    fee,
    total:
      value + fee,
  };
}
