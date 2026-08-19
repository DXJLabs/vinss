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
import { AgentPanel } from "@/components/agent/AgentPanel";
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

type TimelineEntry = ConversationEntry;


export default function DealRoomPage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const showAccessDetails = searchParams.get("access") === "1";
  const invitedChatTarget = searchParams.get("chat");
  const invitedMessageMode = searchParams.get("message");
  const { session } = useWallet();
  const [tab, setTab] = useState<RoomTab>("timeline");
  const { room, channelKey } = useRoom(params.roomId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counter mode points to one immutable Offer action selected from direct chat.
  const [counterSource, setCounterSource] =
    useState<ConversationEntry | null>(null);

  const {
    entries,
    setEntries,
    draft,
    setDraft,
    chatEndRef,
    participants,
    setParticipants,
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
    handleOfferRefresh,
  } = useRoomOffers({
    roomId: room?.id ?? null,
    session,
    channelKey,
    participants,
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

    if (
      invitedMessageMode === "group"
    ) {
      setMessageTarget("group");
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
  ]);



  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <RoomHeader
        label={room?.label ?? "Deal Room"}
        roomId={params.roomId}
      />

      {!room && (
        <p className="mb-6 border border-danger/40 px-4 py-3 text-xs text-danger">
          Room ini tidak ditemukan di perangkat Anda. Buat atau gabung room
          dulu dari halaman Rooms.
        </p>
      )}

      {!session && room && (
        <p className="mb-6 border border-wire px-4 py-3 text-xs text-paper/50">
          Connect your wallet to start messaging, making offers, or funding
          escrow in this room.
        </p>
      )}

      <RoomTabs
        value={tab}
        onChange={setTab}
      />

      {error && (
        <p className="mb-4 border border-danger/40 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <InvitationPanel
        visible={
          showAccessDetails &&
          Boolean(room)
        }
        roomId={room?.id ?? ""}
        directInvite={directInvite}
        groupInvite={groupInvite}
        joinedNoticeScope={
          joinedNoticeScope
        }
        groupDuration={
          groupDuration
        }
        onGroupDurationChange={
          setGroupDuration
        }
        onCreate={createInviteLink}
        onCopy={copyInviteLink}
        onShare={shareInviteLink}
      />

      <div className="mb-6">
        <AgentPanel
          roomLabel={room?.label}
          timeline={[...entries, ...offerEntries]
            .sort(
              (left, right) =>
                new Date(left.sentAt).getTime() -
                new Date(right.sentAt).getTime(),
            )
            .map((entry) => ({
              kind: entry.kind,
              summary: entry.summary,
              sentAt: entry.sentAt,
              actionLocator: entry.actionLocator,
            }))}
          onApproveProposal={handleAgentProposal}
        />
      </div>

      {tab === "timeline" && (
        <ConversationPanel
          entries={entries}
          offerEntries={offerEntries}
          walletAddress={session?.account.address}
          connected={Boolean(session)}
          channelReady={Boolean(channelKey)}
          busy={busy}
          draft={draft}
          messageTarget={messageTarget}
          participants={participants}
          peerTyping={peerTyping}
          chatEndRef={chatEndRef}
          onDraftChange={setDraft}
          onMessageTargetChange={(value) => {
            // A new chat selection exits any stale counter flow.
            setMessageTarget(value);
            setCounterSource(null);
          }}
          onSendMessage={handleSendMessage}
          onRefresh={async () => {
            // Manual Sync refreshes chat first, then private Offer cards.
            await handleRefresh(false);
            await handleOfferRefresh(true);
          }}
          onAcceptOffer={acceptDirectOffer}
          onRejectOffer={rejectDirectOffer}
          onCounterOffer={(entry) => {
            // Counter editing happens in the Offer tab, but stays bound to this parent.
            setCounterSource(entry);
            setTab("offer");
          }}
        />
      )}

      {tab === "offer" && (
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

      {tab === "escrow" && (
        <EscrowPanel
          session={session}
          channelKey={channelKey}
          onSent={(entry) => setEntries((prev) => [entry, ...prev])}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
          agentDraft={agentEscrowDraft}
        />
      )}

      {tab === "loyalty" && <LoyaltyPanel />}
    </main>
  );
}
