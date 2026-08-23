"use client";

import { useParams, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
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
import { ActivityPanel } from "@/components/room/activity/ActivityPanel";
import { useRoom } from "@/hooks/room/useRoom";
import { useRoomConversation } from "@/hooks/room/useRoomConversation";
import { useRoomInvitation } from "@/hooks/room/useRoomInvitation";
import { useRoomOffers } from "@/hooks/room/useRoomOffers";
import { useRoomEscrow } from "@/hooks/room/useRoomEscrow";
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
  const {
    room,
    channelKey,
    hydrated: roomHydrated,
  } = useRoom(params.roomId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerScrollRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tab !== "offer") return;

    requestAnimationFrame(() => {
      offerScrollRef.current?.scrollTo({
        top: 0,
        behavior: "auto",
      });
    });
  }, [tab]);

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
    sendDirectAttachment,
    loadDirectAttachment,
    sendDirectWorkSubmission,
    handleRefresh,
  } = useRoomConversation({
    roomId: room?.id ?? null,
    session,
    channelKey,
    active: tab !== "loyalty",
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
    active:
      tab === "timeline" ||
      tab === "offer" ||
      tab === "escrow",
    setBusy,
    setError,
  });

  const {
    escrowActions,
    sendDirectEscrowCoordination,
  } = useRoomEscrow({
    roomId: room?.id ?? null,
    session,
    channelKey,
    participants,
    active:
      tab === "timeline" ||
      tab === "escrow",
  });

  const {
    agentOfferDraft,
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

  const latestAcceptedDirectOffer =
    directAgentPeer
      ? [...offerEntries]
          .filter(
            (entry) =>
              entry.offerAction?.kind ===
                "accept" &&
              isCurrentDirectEntry(
                entry,
              ),
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
          .at(-1) ?? null
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      <RoomHeader
        label={room?.label ?? "Deal Room"}
        roomId={params.roomId}
      />

      {roomHydrated && !room && (
        <p className="mb-6 border border-danger/40 px-4 py-3 text-xs text-danger">
          This room is not available on this device. Create or join the room
          from the Rooms page first.
        </p>
      )}

      {!session && room && (
        <p className="mb-3 rounded-xl bg-vault/25 px-3.5 py-2.5 text-[11px] leading-relaxed text-paper/38 ring-1 ring-wire/50">
          Connect your wallet to message, make offers, and use escrow.
        </p>
      )}

      {!showAccessDetails && (
        <RoomTabs
          value={tab}
          onChange={setTab}
          messageMode={
            messageTarget === "groups" ||
            messageTarget.startsWith("group:")
              ? "group"
              : "chat"
          }
          onMessageModeChange={(mode) => {
            setCounterSource(null);
            setEscrowOfferSource(null);
            setMessageTarget(
              mode === "group"
                ? "groups"
                : "chat",
            );
          }}
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
        tab !== "loyalty" && (
        <ConversationPanel
          roomId={room?.id ?? params.roomId}
          entries={entries}
          offerEntries={offerEntries}
          escrowActions={escrowActions}
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
          onSendAttachment={sendDirectAttachment}
          onLoadAttachment={loadDirectAttachment}
          onSubmitWork={sendDirectWorkSubmission}
          onCreateOffer={() => {
            // Offer editing starts from the active private chat and keeps
            // that exact peer as the encrypted Offer counterparty.
            setCounterSource(null);
            setEscrowOfferSource(null);
            setTab("offer");
          }}
          onAddEscrow={() => {
            setCounterSource(null);
            setEscrowOfferSource(
              latestAcceptedDirectOffer,
            );
            setTab("escrow");
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
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Add Offer"
              className="absolute -left-px -right-px top-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl border border-wire bg-ink shadow-2xl sm:left-auto sm:right-5 sm:top-auto sm:bottom-5 sm:h-auto sm:max-h-[88vh] sm:w-full sm:max-w-lg sm:rounded-2xl"
            >
              <header className="flex items-center justify-between border-b border-wire/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-paper/75">
                    Add Offer
                  </p>
                  <p className="mt-0.5 text-[9px] text-paper/28">
                    Add deal terms to this private conversation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCounterSource(null);
                    setTab("timeline");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-paper/35 ring-1 ring-wire/60"
                  aria-label="Close Offer"
                >
                  ×
                </button>
              </header>

              <div
                ref={offerScrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
              >
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
                  onCancelCounter={() =>
                    setCounterSource(null)
                  }
                  onSubmitted={() => {
                    setCounterSource(null);
                    setTab("timeline");
                  }}
                />
              </div>
            </section>
          </div>
      )}

      {!showAccessDetails &&
        tab === "escrow" && (
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Add Escrow"
              className="absolute -left-px -right-px top-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl border border-wire bg-ink shadow-2xl sm:left-auto sm:right-5 sm:top-auto sm:bottom-5 sm:h-auto sm:max-h-[88vh] sm:w-full sm:max-w-lg sm:rounded-2xl"
            >
              <header className="flex items-center justify-between border-b border-wire/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-paper/75">
                    Add Escrow
                  </p>
                  <p className="mt-0.5 text-[9px] text-paper/28">
                    Secure an accepted Offer with VINSS Escrow.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEscrowOfferSource(null);
                    setTab("timeline");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-paper/35 ring-1 ring-wire/60"
                  aria-label="Close Escrow"
                >
                  ×
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
                <EscrowPanel
                  roomId={
                    room?.id ?? params.roomId
                  }
                  session={session}
                  channelKey={channelKey}
                  onSent={(entry) =>
                    setEntries((prev) => [
                      entry,
                      ...prev,
                    ])
                  }
                  setBusy={setBusy}
                  setError={setError}
                  busy={busy}
                  acceptedOffer={escrowOfferSource}
                  offerEntries={offerEntries}
                  escrowActions={escrowActions}
                  onSendCoordination={
                    sendDirectEscrowCoordination
                  }
                />
              </div>
            </section>
          </div>
      )}

      {!showAccessDetails &&
        tab === "loyalty" && (
          <ActivityPanel
            entries={[
              ...entries,
              ...offerEntries,
            ]}
          />
        )}
    </main>
  );
}
