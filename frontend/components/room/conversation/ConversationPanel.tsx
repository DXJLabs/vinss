"use client";

import type { MutableRefObject } from "react";
import { GroupConversationPanel } from "@/components/room/conversation/GroupConversationPanel";
import { DirectConversationPanel } from "@/components/room/conversation/DirectConversationPanel";
import { DirectConversationList } from "@/components/room/conversation/DirectConversationList";
import { shortAddress } from "@/components/room/conversation/chatFormat";
import type {
  ConversationEntry,
  ConversationParticipant,
} from "@/components/room/conversation/types";

export type {
  ConversationEntry,
  ConversationParticipant,
} from "@/components/room/conversation/types";

interface ConversationPanelProps {
  entries: ConversationEntry[];
  offerEntries: ConversationEntry[];
  walletAddress?: string;
  connected: boolean;
  channelReady: boolean;
  busy: boolean;
  draft: string;
  messageTarget: string;
  participants: ConversationParticipant[];
  peerTyping: boolean;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  onDraftChange: (value: string) => void;
  onMessageTargetChange: (value: string) => void;
  onSendMessage: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onAcceptOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onRejectOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onCounterOffer: (
    entry: ConversationEntry,
  ) => void;
}

export function ConversationPanel({
  entries,
  offerEntries,
  walletAddress,
  connected,
  channelReady,
  busy,
  draft,
  messageTarget,
  participants,
  peerTyping,
  chatEndRef,
  onDraftChange,
  onMessageTargetChange,
  onSendMessage,
  onRefresh,
  onAcceptOffer,
  onRejectOffer,
  onCounterOffer,
}: ConversationPanelProps) {
  const directMode =
    messageTarget !== "group";

  const activeLabel =
    messageTarget === "group"
      ? "Group"
      : messageTarget === "chat"
        ? "Chat"
        : shortAddress(messageTarget);

  return (
    <section className="space-y-0">
      <div className="border border-wire bg-vault/30">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
                Messages
              </p>

              <span className="flex items-center gap-1.5 font-display text-[8px] uppercase tracking-[0.14em] text-signal/65">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
                Live
              </span>
            </div>

            <p className="mt-1.5 text-[11px] text-paper/35">
              {activeLabel} · encrypted
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={!channelReady || busy}
            className="border border-wire px-3 py-2 font-display text-[9px] uppercase tracking-[0.14em] text-paper/35 transition hover:border-signal/50 hover:text-signal disabled:opacity-30"
          >
            {busy ? "Syncing…" : "Sync"}
          </button>
        </div>

        {/* Messages has two clear modes. Individual addresses live inside Chat. */}
        <div className="grid grid-cols-2 border-t border-wire">
          <button
            type="button"
            onClick={() =>
              onMessageTargetChange("chat")
            }
            className={
              directMode
                ? "border-r border-wire bg-signal px-3 py-2.5 font-display text-[9px] uppercase tracking-widest text-ink"
                : "border-r border-wire px-3 py-2.5 font-display text-[9px] uppercase tracking-widest text-paper/40 transition hover:text-signal"
            }
          >
            Chat
          </button>

          <button
            type="button"
            onClick={() =>
              onMessageTargetChange("group")
            }
            className={
              messageTarget === "group"
                ? "bg-signal px-3 py-2.5 font-display text-[9px] uppercase tracking-widest text-ink"
                : "px-3 py-2.5 font-display text-[9px] uppercase tracking-widest text-paper/40 transition hover:text-signal"
            }
          >
            Group
          </button>
        </div>
      </div>

      {messageTarget === "group" ? (
        <GroupConversationPanel
          entries={entries}
          participants={participants}
          walletAddress={walletAddress}
          connected={connected}
          channelReady={channelReady}
          busy={busy}
          draft={draft}
          chatEndRef={chatEndRef}
          onDraftChange={onDraftChange}
          onSendMessage={onSendMessage}
        />
      ) : messageTarget === "chat" ? (
        <DirectConversationList
          participants={participants}
          onOpenChat={
            onMessageTargetChange
          }
        />
      ) : (
        <DirectConversationPanel
          entries={entries}
          offerEntries={offerEntries}
          walletAddress={walletAddress}
          peerAddress={messageTarget}
          connected={connected}
          channelReady={channelReady}
          busy={busy}
          draft={draft}
          peerTyping={peerTyping}
          chatEndRef={chatEndRef}
          onBack={() =>
            onMessageTargetChange("chat")
          }
          onDraftChange={onDraftChange}
          onSendMessage={onSendMessage}
          onAcceptOffer={onAcceptOffer}
          onRejectOffer={onRejectOffer}
          onCounterOffer={onCounterOffer}
        />
      )}
    </section>
  );
}
