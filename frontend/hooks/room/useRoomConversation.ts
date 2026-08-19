"use client";

import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { useRoomParticipants } from "@/hooks/room/useRoomParticipants";
import { useGroupConversation } from "@/hooks/room/useGroupConversation";
import { useDirectConversation } from "@/hooks/room/useDirectConversation";

interface UseRoomConversationOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  active: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

/**
 * Thin conversation coordinator.
 *
 * Group, participant discovery, and direct chat now own independent state and
 * effects. This wrapper only selects which panel is active and preserves the
 * existing room-page API while the rest of the frontend is migrated.
 */
export function useRoomConversation({
  roomId,
  session,
  channelKey,
  active,
  setBusy,
  setError,
}: UseRoomConversationOptions) {
  const [
    messageTarget,
    setMessageTarget,
  ] = useState("group");

  // Non-chat room activity remains separate so Escrow cannot mutate either
  // Group or Direct message state.
  const [
    activityEntries,
    setActivityEntries,
  ] = useState<ConversationEntry[]>([]);

  const participantState =
    useRoomParticipants({
      roomId,
      session,
      channelKey,
      // Participant/public-key discovery remains available in Offer/Invite
      // workflows even when the Chat tab itself is not currently visible.
      active: Boolean(
        roomId &&
          session &&
          channelKey,
      ),
    });

  const group =
    useGroupConversation({
      roomId,
      session,
      channelKey,
      messagingIdentity:
        participantState.messagingIdentity,
      active:
        active &&
        messageTarget === "group",
      setBusy,
      setError,
    });

  const direct =
    useDirectConversation({
      roomId,
      session,
      channelKey,
      messagingIdentity:
        participantState.messagingIdentity,
      participants:
        participantState.participants,
      selfRoutingIdentities:
        participantState.selfRoutingIdentities,
      peerAddress:
        messageTarget === "group"
          ? null
          : messageTarget,
      active:
        active &&
        messageTarget !== "group",
      setBusy,
      setError,
    });

  const entries = [
    ...group.entries,
    ...direct.entries,
    ...activityEntries,
  ];

  // Keep the old setter name only for non-chat room activity such as Escrow.
  // Message hooks never share a mutable entries array again.
  const setEntries: Dispatch<
    SetStateAction<ConversationEntry[]>
  > = setActivityEntries;

  const setDraft: Dispatch<
    SetStateAction<string>
  > =
    messageTarget === "group"
      ? group.setDraft
      : direct.setDraft;

  async function handleSendMessage():
    Promise<void> {
    if (messageTarget === "group") {
      await group.sendGroupMessage();
      return;
    }

    await direct.sendDirectMessage();
  }

  async function handleRefresh(
    silent = false,
  ): Promise<void> {
    try {
      await participantState.refreshParticipants(
        true,
      );

      if (messageTarget === "group") {
        await group.refreshGroup(silent);
      } else {
        await direct.refreshDirect(silent);
      }
    } catch (err) {
      console.error(
        "[VINSS CONVERSATION REFRESH ERROR]",
        err,
      );
    }
  }

  return {
    entries,
    setEntries,
    draft:
      messageTarget === "group"
        ? group.draft
        : direct.draft,
    setDraft,
    chatEndRef:
      messageTarget === "group"
        ? group.chatEndRef
        : direct.chatEndRef,
    participants:
      participantState.participants,
    setParticipants:
      participantState.setParticipants,
    messageTarget,
    setMessageTarget,
    peerTyping: direct.peerTyping,
    handleSendMessage,
    handleRefresh,
  };
}
