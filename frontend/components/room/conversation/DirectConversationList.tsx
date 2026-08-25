"use client";

import Link from "next/link";
import { shortAddress } from "@/components/room/conversation/chatFormat";
import type { ConversationParticipant } from "@/components/room/conversation/types";
import { StarkIdentity } from "@/components/StarkIdentity";

interface DirectConversationListProps {
  roomId: string;
  canInvite: boolean;
  participants: ConversationParticipant[];
  onOpenChat: (address: string) => void;
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path
        d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DirectConversationList({
  roomId,
  canInvite,
  participants,
  onOpenChat,
}: DirectConversationListProps) {
  return (
    <div className="overflow-hidden rounded-b-2xl border border-t-0 border-wire/70 bg-black/[0.08]">
      {participants.length === 0 ? (
        <div className="flex min-h-[245px] flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal/[0.07] text-signal/80 ring-1 ring-signal/15">
            <ChatIcon />
          </div>

          <h3 className="mt-4 text-base font-medium text-paper/75">
            Start a private chat
          </h3>

          <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-paper/35">
            Invite one person to begin an encrypted 1-to-1 conversation.
          </p>

          {canInvite && (
            <Link
              href={`/room/${roomId}?access=chat`}
              className="mt-5 rounded-xl bg-signal px-4 py-2.5 text-[11px] font-semibold text-ink transition hover:brightness-105"
            >
              Invite person
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 border-b border-wire/50 px-4 py-2.5">
            <p className="text-[10px] text-paper/30">
              {participants.length} conversation{participants.length === 1 ? "" : "s"}
            </p>

            {canInvite && (
              <Link
                href={`/room/${roomId}?access=chat`}
                className="rounded-lg px-3 py-2 text-[10px] text-signal/70 ring-1 ring-signal/20 transition hover:bg-signal/[0.08]"
              >
                + Invite
              </Link>
            )}
          </div>

          <div className="divide-y divide-wire/45">
            {participants.map((participant) => (
              <button
                key={participant.address}
                type="button"
                onClick={() => onOpenChat(participant.address)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-signal/[0.035]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vault text-[11px] text-signal/65 ring-1 ring-wire/70">
                  {shortAddress(participant.address).slice(2, 4).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-paper/72">
                    <StarkIdentity
                      address={
                        participant.address
                      }
                    />
                  </p>
                </div>

                <span className="text-paper/25" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
