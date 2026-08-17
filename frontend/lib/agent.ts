import { BACKEND_URL } from "./starknet/constants";

export interface AgentTimelineItem {
  kind: string;
  summary: string;
  sentAt?: string;
  actionLocator?: string;
}

export type DealStage =
  | "discussion"
  | "negotiating"
  | "offer_pending"
  | "agreed"
  | "escrow_pending"
  | "funded"
  | "settlement_pending"
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
      type: "review_settlement";
      title: string;
      description: string;
      requiresApproval: true;
      payload: {
        reason: string;
      };
    };

export async function askVinssAgent(input: {
  message: string;
  context: {
    roomLabel?: string;
    latestOffer?: unknown;
    timeline: AgentTimelineItem[];
  };
}) {
  const response = await fetch(`${BACKEND_URL}/agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Agent request failed.",
    );
  }

  return data as {
    answer: string;
    contextShared: boolean;
    dealStage: DealStage;
    proposal: AgentProposal | null;
  };
}

export function quoteVinssFee(
  amount: string,
  feeBps = Number(
    process.env.NEXT_PUBLIC_VINSS_FEE_BPS ?? "25",
  ),
) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  const fee = (value * feeBps) / 10_000;

  return {
    amount: value,
    feeBps,
    fee,
    total: value + fee,
  };
}
