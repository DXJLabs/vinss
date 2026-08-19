"use client";

import { shortAddress } from "@/components/room/conversation/chatFormat";
import type { ConversationParticipant } from "@/components/room/conversation/types";

interface DirectConversationListProps {
  participants: ConversationParticipant[];
  onOpenChat: (address: string) => void;
}

export function DirectConversationList({
  participants,
  onOpenChat,
}: DirectConversationListProps) {
  return (
    <div className="min-h-[360px] border-x border-b border-wire bg-black/10">
      <div className="border-b border-wire/70 px-4 py-3">
        <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/30">
          Private chats
        </p>
        <p className="mt-1 text-[11px] text-paper/25">
          Choose someone in this room.
        </p>
      </div>

      {participants.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
            <span className="text-base text-signal">✦</span>
          </div>

          <h3 className="font-display text-sm text-paper/70">
            No private chats yet
          </h3>

          <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
            Participants will appear here when their encrypted room identity is available.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-wire/60">
          {participants.map((participant) => (
            <button
              key={participant.address}
              type="button"
              onClick={() =>
                onOpenChat(participant.address)
              }
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-signal/[0.035]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-paper/75">
                  {shortAddress(participant.address)}
                </p>

                <p className="mt-1 truncate font-mono text-[9px] text-paper/25">
                  {participant.address}
                </p>
              </div>

              <span className="shrink-0 font-display text-[8px] uppercase tracking-[0.14em] text-signal/55">
                Open chat →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
