"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AgentProposal } from "@/lib/agent";
import type { RoomTab } from "@/components/room/RoomTabs";

interface UseRoomAgentOptions {
  setDraft: Dispatch<SetStateAction<string>>;
  setTab: Dispatch<SetStateAction<RoomTab>>;
}

export function useRoomAgent({
  setDraft,
  setTab,
}: UseRoomAgentOptions) {
  const [agentOfferDraft, setAgentOfferDraft] = useState<
    Extract<
      AgentProposal,
      { type: "draft_offer" | "draft_counter_offer" }
    > | null
  >(null);

  const [agentEscrowDraft, setAgentEscrowDraft] = useState<
    Extract<AgentProposal, { type: "prepare_escrow" }> | null
  >(null);

  function handleAgentProposal(proposal: AgentProposal) {
    // Route each approved agent proposal to the matching room workflow.
    switch (proposal.type) {
      case "draft_message":
        // Copy the proposed message into the composer without sending it automatically.
        setDraft(proposal.payload.body);
        // Show the conversation so the user can review the draft before sending.
        setTab("timeline");
        return;

      case "draft_offer":
      case "draft_counter_offer":
        // Store the proposed offer locally so the Offer panel can review it.
        setAgentOfferDraft(proposal);
        // Open the Deal tab without executing any wallet action.
        setTab("offer");
        return;

      case "prepare_escrow":
        // Store the proposed escrow preparation locally for explicit user review.
        setAgentEscrowDraft(proposal);
        // Open the Escrow tab while leaving execution under user control.
        setTab("escrow");
        return;

      case "review_rekber":
        setTab("escrow");
        return;
    }
  }

  return {
    agentOfferDraft,
    agentEscrowDraft,
    handleAgentProposal,
  };
}
