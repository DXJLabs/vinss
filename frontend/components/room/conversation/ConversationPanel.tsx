"use client";

import type {
  MutableRefObject,
} from "react";
import {
  GroupConversationPanel,
} from "@/components/room/conversation/GroupConversationPanel";
import {
  GroupConversationList,
} from "@/components/room/conversation/GroupConversationList";
import {
  DirectConversationPanel,
} from "@/components/room/conversation/DirectConversationPanel";
import {
  DirectConversationList,
} from "@/components/room/conversation/DirectConversationList";
import type {
  ConversationEntry,
  ConversationParticipant,
} from "@/components/room/conversation/types";
import type {
  LocalRoomGroup,
} from "@/lib/groups/localGroups";

export type {
  ConversationEntry,
  ConversationParticipant,
} from "@/components/room/conversation/types";

interface ConversationPanelProps {
  roomId: string;
  entries: ConversationEntry[];
  offerEntries: ConversationEntry[];
  walletAddress?: string;
  connected: boolean;
  channelReady: boolean;
  groupReady: boolean;
  busy: boolean;
  draft: string;
  messageTarget: string;
  participants: ConversationParticipant[];
  groups: LocalRoomGroup[];
  selectedGroup: LocalRoomGroup | null;
  peerTyping: boolean;
  chatEndRef: MutableRefObject<
    HTMLDivElement | null
  >;
  onCreateGroup: (
    name: string,
  ) => LocalRoomGroup | null;
  onDraftChange: (
    value: string,
  ) => void;
  onMessageTargetChange: (
    value: string,
  ) => void;
  onSendMessage:
    () => void | Promise<void>;
  onSubmitWork: (input: {
    custodyCommitment: string;
    note: string;
    file?: File | null;
  }) => Promise<boolean>;
  onCreateOffer: () => void;
  onAddEscrow: () => void;
  onRefresh:
    () => void | Promise<void>;
  onAcceptOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onRejectOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onCounterOffer: (
    entry: ConversationEntry,
  ) => void;
  onOpenEscrow: (
    entry: ConversationEntry,
  ) => void;
  onOfferRead: (
    entry: ConversationEntry,
  ) => void | Promise<void>;
}

export function ConversationPanel({
  roomId,
  entries,
  offerEntries,
  walletAddress,
  connected,
  channelReady,
  groupReady,
  busy,
  draft,
  messageTarget,
  participants,
  groups,
  selectedGroup,
  peerTyping,
  chatEndRef,
  onCreateGroup,
  onDraftChange,
  onMessageTargetChange,
  onSendMessage,
  onSubmitWork,
  onCreateOffer,
  onAddEscrow,
  onRefresh,
  onAcceptOffer,
  onRejectOffer,
  onCounterOffer,
  onOpenEscrow,
  onOfferRead,
}: ConversationPanelProps) {
  const showDirectoryHeader =
    messageTarget === "chat" ||
    messageTarget === "groups";

  const directoryLabel =
    messageTarget === "groups"
      ? "Groups"
      : "Private messages";

  return (
    <section className="space-y-0">
      {showDirectoryHeader && (
        <div className="rounded-t-2xl border border-b-0 border-wire/70 bg-vault/22">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-paper/72">
                {directoryLabel}
              </p>

              <p className="mt-1 text-[10px] text-paper/30">
                E2E protected
              </p>
            </div>

          </div>
        </div>
      )}

      {messageTarget ===
      "groups" ? (
        <GroupConversationList
          groups={groups}
          connected={connected}
          walletAddress={
            walletAddress
          }
          onCreateGroup={
            onCreateGroup
          }
          onOpenGroup={(
            groupId,
          ) =>
            onMessageTargetChange(
              `group:${groupId}`,
            )
          }
        />
      ) : selectedGroup ? (
        <GroupConversationPanel
          roomId={roomId}
          group={selectedGroup}
          entries={entries}
          walletAddress={
            walletAddress
          }
          connected={connected}
          channelReady={
            groupReady
          }
          busy={busy}
          draft={draft}
          chatEndRef={
            chatEndRef
          }
          onBack={() =>
            onMessageTargetChange(
              "groups",
            )
          }
          onDraftChange={
            onDraftChange
          }
          onSendMessage={
            onSendMessage
          }
        />
      ) : messageTarget.startsWith(
        "group:",
      ) ? (
        <div className="flex min-h-[320px] items-center justify-center border-x border-b border-wire bg-black/10 px-6 text-center">
          <p className="text-xs text-paper/35">
            Loading Group…
          </p>
        </div>
      ) : messageTarget ===
        "chat" ? (
        <DirectConversationList
          roomId={roomId}
          canInvite={
            channelReady
          }
          participants={
            participants
          }
          onOpenChat={
            onMessageTargetChange
          }
        />
      ) : (
        <DirectConversationPanel
          entries={entries}
          offerEntries={
            offerEntries
          }
          walletAddress={
            walletAddress
          }
          peerAddress={
            messageTarget
          }
          connected={connected}
          channelReady={
            channelReady
          }
          busy={busy}
          draft={draft}
          peerTyping={
            peerTyping
          }
          chatEndRef={
            chatEndRef
          }
          onBack={() =>
            onMessageTargetChange(
              "chat",
            )
          }
          onDraftChange={
            onDraftChange
          }
          onSendMessage={
            onSendMessage
          }
          onSubmitWork={
            onSubmitWork
          }
          onCreateOffer={
            onCreateOffer
          }
          onAddEscrow={
            onAddEscrow
          }
          onAcceptOffer={
            onAcceptOffer
          }
          onRejectOffer={
            onRejectOffer
          }
          onCounterOffer={
            onCounterOffer
          }
          onOpenEscrow={
            onOpenEscrow
          }
          onOfferRead={
            onOfferRead
          }
        />
      )}
    </section>
  );
}
