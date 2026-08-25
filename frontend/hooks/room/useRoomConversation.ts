"use client";

import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import type {
  ConversationEntry,
} from "@/components/room/conversation/types";
import {
  useRoomParticipants,
} from "@/hooks/room/useRoomParticipants";
import {
  useGroupConversation,
} from "@/hooks/room/useGroupConversation";
import {
  useDirectConversation,
} from "@/hooks/room/useDirectConversation";
import {
  useRoomGroups,
} from "@/hooks/room/useRoomGroups";

interface UseRoomConversationOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  active: boolean;
  setBusy: (
    value: boolean,
  ) => void;
  setError: (
    value: string | null,
  ) => void;
}

/**
 * Conversation coordinator.
 *
 * "chat" opens the private-chat directory, "groups" opens the Group directory,
 * "group:<id>" selects one admin-created Group, and a Starknet address selects
 * one private pair.
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
  ] =
    useState<ConversationEntry[]>(
      [],
    );

  const selectedGroupId =
    messageTarget.startsWith(
      "group:",
    )
      ? messageTarget.slice(
          "group:".length,
        )
      : null;

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

  const groupState =
    useRoomGroups({
      roomId,
      session,
      selectedGroupId,
      active: Boolean(
        roomId && session,
      ),
      setError,
    });

  const group =
    useGroupConversation({
      roomId,
      session,
      group:
        groupState.selectedGroup,
      groupKey:
        groupState.selectedGroupKey,
      messagingIdentity:
        participantState.messagingIdentity,
      active:
        active &&
        Boolean(
          groupState.selectedGroup,
        ),
      setBusy,
      setError,
    });

  const hasDirectPeer =
    messageTarget !== "chat" &&
    messageTarget !== "groups" &&
    !selectedGroupId;

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
    SetStateAction<
      ConversationEntry[]
    >
  > = setActivityEntries;

  const usingGroup =
    Boolean(
      groupState.selectedGroup,
    );

  const setDraft: Dispatch<
    SetStateAction<string>
  > =
    usingGroup
      ? group.setDraft
      : direct.setDraft;

  async function handleSendMessage():
    Promise<void> {
    if (usingGroup) {
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

      if (usingGroup) {
        await group.refreshGroup(
          silent,
        );
        return;
      }

      if (hasDirectPeer) {
        await direct.refreshDirect(
          silent,
        );
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
      usingGroup
        ? group.draft
        : direct.draft,
    setDraft,
    chatEndRef:
      usingGroup
        ? group.chatEndRef
        : direct.chatEndRef,
    participants:
      participantState.participants,
    selfRoutingIdentities:
      participantState.selfRoutingIdentities,
    setParticipants:
      participantState.setParticipants,
    groups:
      groupState.groups,
    selectedGroup:
      groupState.selectedGroup,
    selectedGroupKey:
      groupState.selectedGroupKey,
    isSelectedGroupAdmin:
      groupState.isSelectedGroupAdmin,
    createGroup:
      groupState.createGroup,
    messageTarget,
    setMessageTarget,
    peerTyping:
      direct.peerTyping,
    handleSendMessage,
    sendDirectAttachment:
      direct.sendDirectAttachment,
    loadDirectAttachment:
      direct.loadDirectAttachment,
    sendDirectWorkSubmission:
      direct.sendDirectWorkSubmission,
    sendDirectWorkReview:
      direct.sendDirectWorkReview,
    handleRefresh,
  };
}
