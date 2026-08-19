"use client";

import {
  useState,
  type MutableRefObject,
} from "react";
import type {
  ConversationEntry,
  ConversationParticipant,
} from "@/components/room/conversation/types";
import { MessageBubble } from "@/components/room/conversation/MessageBubble";
import { ProofModal } from "@/components/room/conversation/ProofModal";
import {
  explorerUrl,
  shortAddress,
} from "@/components/room/conversation/chatFormat";

interface GroupConversationPanelProps {
  entries: ConversationEntry[];
  participants: ConversationParticipant[];
  walletAddress?: string;
  connected: boolean;
  channelReady: boolean;
  busy: boolean;
  draft: string;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void | Promise<void>;
}

export function GroupConversationPanel({
  entries,
  participants,
  walletAddress,
  connected,
  channelReady,
  busy,
  draft,
  chatEndRef,
  onDraftChange,
  onSendMessage,
}: GroupConversationPanelProps) {
  const [proofEntry, setProofEntry] =
    useState<ConversationEntry | null>(null);

  const visibleEntries = entries
    .filter(
      (entry) =>
        entry.kind === "message" &&
        (entry.scope ?? "group") === "group",
    )
    .sort(
      (left, right) =>
        new Date(left.sentAt).getTime() -
        new Date(right.sentAt).getTime(),
    );

  const memberCount =
    participants.length +
    (walletAddress ? 1 : 0);

  return (
    <>
      <div className="border-x border-b border-wire bg-vault/20 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/35">
              Group members
            </p>

            <p className="mt-1 text-[10px] text-paper/25">
              {memberCount} member
              {memberCount === 1 ? "" : "s"}
            </p>
          </div>

          <span className="font-display text-[8px] uppercase tracking-[0.14em] text-signal/50">
            Room-wide
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {walletAddress && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-signal/15 bg-signal/[0.025] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs text-paper/65">
                  You
                </p>

                <p className="mt-0.5 truncate font-mono text-[9px] text-paper/25">
                  {walletAddress}
                </p>
              </div>

              <span className="shrink-0 text-[9px] text-signal/60">
                {shortAddress(walletAddress)}
              </span>
            </div>
          )}

          {participants.map((participant) => (
            <div
              key={participant.address}
              className="flex items-center justify-between gap-3 rounded-lg border border-wire/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs text-paper/60">
                  {shortAddress(participant.address)}
                </p>

                <p className="mt-0.5 truncate font-mono text-[9px] text-paper/25">
                  {participant.address}
                </p>
              </div>

              <span className="shrink-0 font-display text-[8px] uppercase tracking-[0.12em] text-paper/25">
                Member
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[320px] max-h-[52vh] overflow-y-auto border-x border-b border-wire bg-black/10">
        {visibleEntries.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
              <span className="text-base text-signal">
                ✦
              </span>
            </div>

            <h3 className="font-display text-sm text-paper/70">
              Start the group
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
              Messages here are shared with everyone in this room.
            </p>
          </div>
        ) : (
          <ul className="space-y-5 p-4 sm:p-5">
            {visibleEntries.map((entry) => (
              <MessageBubble
                key={`group:${entry.actionLocator}`}
                entry={entry}
                walletAddress={walletAddress}
                mode="group"
                onViewProof={setProofEntry}
              />
            ))}

            <div
              ref={(node) => {
                chatEndRef.current = node;
              }}
              className="h-px"
              aria-hidden="true"
            />
          </ul>
        )}
      </div>

      <div className="border border-wire bg-vault/20 p-2">
        <div className="mb-2 flex items-center justify-between border-b border-wire/60 px-2 pb-2">
          <span className="font-display text-[9px] uppercase tracking-widest text-paper/30">
            Group
          </span>

          <span className="text-[9px] text-paper/25">
            Everyone in room
          </span>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) =>
              onDraftChange(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                void onSendMessage();
              }
            }}
            placeholder="Write to the group…"
            rows={1}
            disabled={
              !connected ||
              !channelReady ||
              busy
            }
            className="min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
          />

          <button
            type="button"
            onClick={() =>
              void onSendMessage()
            }
            disabled={
              !connected ||
              !channelReady ||
              busy ||
              !draft.trim()
            }
            className="h-11 border border-signal/35 px-4 font-display text-[9px] uppercase tracking-[0.14em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>

      {proofEntry?.transactionHash && (
        <ProofModal
          kind="message"
          transactionHash={
            proofEntry.transactionHash
          }
          recordId={
            proofEntry.actionLocator
          }
          explorerUrl={explorerUrl(
            proofEntry.transactionHash,
          )}
          onClose={() =>
            setProofEntry(null)
          }
        />
      )}
    </>
  );
}
