"use client";

import Link from "next/link";
import { shortAddress } from "@/components/room/conversation/chatFormat";
import type { ConversationParticipant } from "@/components/room/conversation/types";

interface DirectConversationListProps {
  roomId: string;
  canInvite: boolean;
  participants: ConversationParticipant[];
  onOpenChat: (address: string) => void;
}

export function DirectConversationList({
  roomId,
  canInvite,
  participants,
  onOpenChat,
}: DirectConversationListProps) {
  return (
    <div className="min-h-[360px] border-x border-b border-wire bg-black/10">
      <div className="flex items-center justify-between gap-4 border-b border-wire/70 px-4 py-3">
        <div>
          <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/30">
            Private chats
          </p>

          <p className="mt-1 text-[11px] text-paper/25">
            Choose someone for an encrypted 1-to-1.
          </p>
        </div>

        {canInvite && (
          <Link
            href={`/room/${roomId}?access=chat`}
            className="shrink-0 border border-signal/25 px-3 py-2 font-display text-[8px] uppercase tracking-[0.13em] text-signal/70 transition hover:bg-signal hover:text-ink"
          >
            + Invite person
          </Link>
        )}
      </div>

      {participants.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
            <span className="text-base text-signal">
              ✦
            </span>
          </div>

          <h3 className="font-display text-sm text-paper/70">
            No private chats yet
          </h3>

          <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
            Invite one person to private Chat, or wait for an encrypted participant identity to appear.
          </p>

          {canInvite && (
            <Link
              href={`/room/${roomId}?access=chat`}
              className="mt-5 border border-signal/30 px-4 py-2.5 font-display text-[8px] uppercase tracking-[0.13em] text-signal transition hover:bg-signal hover:text-ink"
            >
              Create Chat invite →
            </Link>
          )}
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
                  {shortAddress(
                    participant.address,
                  )}
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
