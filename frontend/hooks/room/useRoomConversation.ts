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
 * "chat" is the private conversation directory, "group" is the room-wide
 * conversation, and a Starknet address selects one private pair.
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
  ] = useState("chat");

  const [
    activityEntries,
    setActivityEntries,
  ] = useState<ConversationEntry[]>([]);

  const participantState =
    useRoomParticipants({
      roomId,
      session,
      channelKey,
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

  const hasDirectPeer =
    messageTarget !== "group" &&
    messageTarget !== "chat";

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
        hasDirectPeer
          ? messageTarget
          : null,
      active:
        active &&
        hasDirectPeer,
      setBusy,
      setError,
    });

  const entries = [
    ...group.entries,
    ...direct.entries,
    ...activityEntries,
  ];

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

    if (hasDirectPeer) {
      await direct.sendDirectMessage();
    }
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
        return;
      }

      if (hasDirectPeer) {
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
