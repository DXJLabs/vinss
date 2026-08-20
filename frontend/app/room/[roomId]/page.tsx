"use client";

import { useParams, useSearchParams } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { StatusBadge } from "@/components/StatusBadge";
import { useWallet } from "@/components/providers/WalletProvider";
import { BACKEND_URL } from "@/lib/starknet/constants";
import {
  AgentPanel,
  type AgentContextKind,
} from "@/components/agent/AgentPanel";
import { useRoomAgent } from "@/hooks/room/useRoomAgent";
import { humanizeError } from "@/lib/errors/uiError";
import {
  ConversationPanel,
  type ConversationEntry,
} from "@/components/room/conversation/ConversationPanel";
import { OfferPanel } from "@/components/room/offer/OfferPanel";
import { EscrowPanel } from "@/components/room/escrow/EscrowPanel";
import { InvitationPanel } from "@/components/room/invitation/InvitationPanel";
import { RoomHeader } from "@/components/room/RoomHeader";
import { RoomTabs, type RoomTab } from "@/components/room/RoomTabs";
import { LoyaltyPanel } from "@/components/room/loyalty/LoyaltyPanel";
import { useRoom } from "@/hooks/room/useRoom";
import { useRoomConversation } from "@/hooks/room/useRoomConversation";
import { useRoomInvitation } from "@/hooks/room/useRoomInvitation";
import { useRoomOffers } from "@/hooks/room/useRoomOffers";
import {
  isGroupAdmin,
} from "@/lib/groups/localGroups";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";
import {
  shortAddress,
} from "@/components/room/conversation/chatFormat";

type TimelineEntry = ConversationEntry;


export default function DealRoomPage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const invitedChatTarget = searchParams.get("chat");
  const invitedMessageMode = searchParams.get("message");
  const invitedGroupId = searchParams.get("group");
  const accessMode = searchParams.get("access");

  // Chat and Group invitations are separate capabilities and never share
  // one mixed invitation screen. access=1 remains a compatibility fallback.
  const inviteScope =
    accessMode === "chat"
      ? "direct"
      : accessMode === "group"
        ? "group"
        : accessMode === "1"
          ? invitedGroupId
            ? "group"
            : "direct"
          : null;

  const showAccessDetails =
    inviteScope !== null;
  const { session } = useWallet();
  const [tab, setTab] = useState<RoomTab>("timeline");
  const { room, channelKey } = useRoom(params.roomId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counter mode points to one immutable Offer action selected from direct chat.
  const [counterSource, setCounterSource] =
    useState<ConversationEntry | null>(null);

  // Accepted Offer handoff stays local and only pre-fills the Escrow workflow.
  const [escrowOfferSource, setEscrowOfferSource] =
    useState<ConversationEntry | null>(null);

  const {
    entries,
    setEntries,
    draft,
    setDraft,
    chatEndRef,
    participants,
    selfRoutingIdentities,
    groups,
    selectedGroup,
    selectedGroupKey,
    createGroup,
    messageTarget,
    setMessageTarget,
    peerTyping,
    handleSendMessage,
    handleRefresh,
  } = useRoomConversation({
    roomId: room?.id ?? null,
    session,
    channelKey,
    active: tab === "timeline",
    setBusy,
    setError,
  });

  // Offer lifecycle state is separate from messages and merges only in direct chat UI.
  const {
    offerEntries,
    createDirectOffer,
    counterDirectOffer,
    acceptDirectOffer,
    rejectDirectOffer,
    markOfferRead,
    handleOfferRefresh,
  } = useRoomOffers({
    roomId: room?.id ?? null,
    session,
    channelKey,
    participants,
    selfRoutingIdentities,
    active: tab === "timeline" || tab === "offer",
    setBusy,
    setError,
  });

  const {
    agentOfferDraft,
    agentEscrowDraft,
    handleAgentProposal,
  } = useRoomAgent({
    setDraft,
    setTab,
  });

  const accessGroup =
    invitedGroupId
      ? groups.find(
          (group) =>
            group.id ===
            invitedGroupId,
        ) ?? null
      : null;

  const {
    directInvite,
    groupInvite,
    joinedNoticeScope,
    groupDuration,
    setGroupDuration,
    createInviteLink,
    copyInviteLink,
    shareInviteLink,
  } = useRoomInvitation({
    room,
    group: accessGroup,
    session,
    setError,
  });

  useEffect(() => {
    if (!room) return;

    // New V3 invites land in the intended conversation without changing the
    // underlying room route or exposing private invite metadata to the backend.
    if (invitedChatTarget) {
      setMessageTarget(
        invitedChatTarget,
      );
      return;
    }

    if (invitedGroupId) {
      setMessageTarget(
        `group:${invitedGroupId}`,
      );
      return;
    }

    if (
      invitedMessageMode === "group"
    ) {
      setMessageTarget("groups");
      return;
    }

    if (
      invitedMessageMode === "chat"
    ) {
      setMessageTarget("chat");
    }
  }, [
    room?.id,
    invitedChatTarget,
    invitedMessageMode,
    invitedGroupId,
  ]);

  const directAgentPeer =
    messageTarget !== "chat" &&
    messageTarget !== "groups" &&
    !messageTarget.startsWith("group:")
      ? messageTarget
      : null;

  const agentContextKind: AgentContextKind =
    tab === "offer"
      ? "deal"
      : tab === "escrow"
        ? "escrow"
        : selectedGroup
          ? "group"
          : directAgentPeer
            ? "chat"
            : "messages";

  const agentContextLabel =
    tab === "offer"
      ? directAgentPeer
        ? `Deal · ${shortAddress(directAgentPeer)}`
        : "Deal"
      : tab === "escrow"
        ? "Escrow"
        : selectedGroup
          ? `Group · ${selectedGroup.name}`
          : directAgentPeer
            ? `Private chat · ${shortAddress(directAgentPeer)}`
            : messageTarget === "groups"
              ? "Groups"
              : "Private chats";

  const isCurrentDirectEntry = (
    entry: ConversationEntry,
  ) => {
    if (!directAgentPeer) {
      return false;
    }

    return (
      sameStarknetAddress(
        entry.senderAddress,
        directAgentPeer,
      ) ||
      sameStarknetAddress(
        entry.recipientAddress,
        directAgentPeer,
      ) ||
      (entry.scope === "direct" &&
        entry.kind === "message")
    );
  };

  const agentContextEntries = [
    ...entries,
    ...offerEntries,
  ]
    .filter((entry) => {
      if (tab === "offer") {
        return (
          entry.kind === "offer" &&
          (!directAgentPeer ||
            isCurrentDirectEntry(entry))
        );
      }

      if (tab === "escrow") {
        if (selectedGroup) {
          return (
            entry.groupId ===
            selectedGroup.id
          );
        }

        if (directAgentPeer) {
          return isCurrentDirectEntry(
            entry,
          );
        }

        return entry.kind === "offer";
      }

      if (selectedGroup) {
        return (
          entry.groupId ===
          selectedGroup.id
        );
      }

      if (directAgentPeer) {
        return isCurrentDirectEntry(
          entry,
        );
      }

      // Never aggregate unrelated private chats while the user is only
      // looking at a directory. The Agent receives no timeline in that state.
      return false;
    })
    .sort(
      (left, right) =>
        new Date(
          left.sentAt,
        ).getTime() -
        new Date(
          right.sentAt,
        ).getTime(),
    );

  const latestAgentOffer =
    [...offerEntries]
      .filter(
        (entry) =>
          entry.offerAction &&
          (!directAgentPeer ||
            isCurrentDirectEntry(entry)),
      )
      .sort(
        (left, right) =>
          new Date(
            left.sentAt,
          ).getTime() -
          new Date(
            right.sentAt,
          ).getTime(),
      )
      .at(-1);

  const latestOfferContext =
    latestAgentOffer?.offerAction
      ? {
          asset:
            latestAgentOffer
              .offerAction.asset,
          amount:
            latestAgentOffer
              .offerAction.amount,
          paymentTerms:
            latestAgentOffer
              .offerAction
              .paymentTerms,
          conditions:
            latestAgentOffer
              .offerAction
              .conditions,
          actionLocator:
            latestAgentOffer
              .actionLocator,
        }
      : undefined;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <RoomHeader
        label={room?.label ?? "Deal Room"}
        roomId={params.roomId}
      />

      {!room && (
        <p className="mb-6 border border-danger/40 px-4 py-3 text-xs text-danger">
          This room is not available on this device. Create or join the room
          from the Rooms page first.
        </p>
      )}

      {!session && room && (
        <p className="mb-6 border border-wire px-4 py-3 text-xs text-paper/50">
          Connect your wallet to start messaging, making offers, or funding
          escrow in this room.
        </p>
      )}

      {!showAccessDetails && (
        <RoomTabs
          value={tab}
          onChange={setTab}
        />
      )}

      {error && (
        <p className="mb-4 border border-danger/40 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {showAccessDetails &&
        room &&
        inviteScope && (
          <InvitationPanel
            scope={inviteScope}
            roomId={room.id}
            group={accessGroup}
            canInviteDirect={
              Boolean(
                room.roomSecret,
              )
            }
            canInviteGroup={
              Boolean(
                accessGroup &&
                  session &&
                  isGroupAdmin(
                    accessGroup,
                    session.account.address,
                  ),
              )
            }
            directInvite={
              directInvite
            }
            groupInvite={
              groupInvite
            }
            joinedNoticeScope={
              joinedNoticeScope
            }
            groupDuration={
              groupDuration
            }
            onGroupDurationChange={
              setGroupDuration
            }
            onCreate={
              createInviteLink
            }
            onCopy={
              copyInviteLink
            }
            onShare={
              shareInviteLink
            }
          />
        )}

      {tab !== "loyalty" &&
        !showAccessDetails && (
          <AgentPanel
            roomLabel={room?.label}
            contextKind={
              agentContextKind
            }
            contextLabel={
              agentContextLabel
            }
            timeline={agentContextEntries.map(
              (entry) => ({
                kind: entry.kind,
                summary:
                  entry.summary,
                sentAt:
                  entry.sentAt,
                actionLocator:
                  entry.actionLocator,
              }),
            )}
            latestOffer={
              latestOfferContext
            }
            onApproveProposal={
              handleAgentProposal
            }
          />
        )}

      {!showAccessDetails &&
        tab === "timeline" && (
        <ConversationPanel
          roomId={room?.id ?? params.roomId}
          entries={entries}
          offerEntries={offerEntries}
          walletAddress={session?.account.address}
          connected={Boolean(session)}
          channelReady={Boolean(channelKey)}
          groupReady={Boolean(selectedGroupKey)}
          busy={busy}
          draft={draft}
          messageTarget={messageTarget}
          participants={participants}
          groups={groups}
          selectedGroup={selectedGroup}
          peerTyping={peerTyping}
          chatEndRef={chatEndRef}
          onCreateGroup={createGroup}
          onDraftChange={setDraft}
          onMessageTargetChange={(value) => {
            // A new chat selection exits any stale counter flow.
            setMessageTarget(value);
            setCounterSource(null);
            setEscrowOfferSource(null);
          }}
          onSendMessage={handleSendMessage}
          onCreateOffer={() => {
            // Offer editing starts from the active private chat and keeps
            // that exact peer as the encrypted Offer counterparty.
            setCounterSource(null);
            setEscrowOfferSource(null);
            setTab("offer");
          }}
          onRefresh={async () => {
            // Manual Sync refreshes chat first, then private Offer cards.
            await handleRefresh(false);
            await handleOfferRefresh(true);
          }}
          onAcceptOffer={acceptDirectOffer}
          onRejectOffer={rejectDirectOffer}
          onOfferRead={markOfferRead}
          onCounterOffer={(entry) => {
            // Counter editing happens in the Offer tab, but stays bound to this parent.
            setCounterSource(entry);
            setTab("offer");
          }}
          onOpenEscrow={(entry) => {
            // The encrypted acceptance contains the final terms and accepted parent locator.
            setEscrowOfferSource(entry);
            setTab("escrow");
          }}
        />
      )}

      {!showAccessDetails &&
        tab === "offer" && (
        <OfferPanel
          session={session}
          channelKey={channelKey}
          messageTarget={messageTarget}
          participants={participants}
          counterSource={counterSource}
          busy={busy}
          agentDraft={agentOfferDraft}
          onCreate={createDirectOffer}
          onCounter={counterDirectOffer}
          onCancelCounter={() => setCounterSource(null)}
          onSubmitted={() => {
            // Return to the same direct chat after the wallet-backed action.
            setCounterSource(null);
            setTab("timeline");
          }}
        />
      )}

      {!showAccessDetails &&
        tab === "escrow" && (
        <EscrowPanel
          session={session}
          channelKey={channelKey}
          onSent={(entry) => setEntries((prev) => [entry, ...prev])}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
          agentDraft={agentEscrowDraft}
          acceptedOffer={escrowOfferSource}
        />
      )}

      {!showAccessDetails &&
        tab === "loyalty" && (
          <LoyaltyPanel />
        )}
    </main>
  );
}
