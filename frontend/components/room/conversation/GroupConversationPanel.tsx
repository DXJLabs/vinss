"use client";

import Link from "next/link";
import {
  useState,
  type MutableRefObject,
} from "react";
import type {
  ConversationEntry,
} from "@/components/room/conversation/types";
import {
  MessageBubble,
} from "@/components/room/conversation/MessageBubble";
import {
  ProofModal,
} from "@/components/room/conversation/ProofModal";
import {
  explorerUrl,
  shortAddress,
} from "@/components/room/conversation/chatFormat";
import {
  isGroupAdmin,
  type LocalRoomGroup,
} from "@/lib/groups/localGroups";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";

interface GroupConversationPanelProps {
  roomId: string;
  group: LocalRoomGroup;
  entries: ConversationEntry[];
  walletAddress?: string;
  connected: boolean;
  channelReady: boolean;
  busy: boolean;
  draft: string;
  chatEndRef: MutableRefObject<
    HTMLDivElement | null
  >;
  onBack: () => void;
  onDraftChange: (
    value: string,
  ) => void;
  onSendMessage:
    () => void | Promise<void>;
}

export function GroupConversationPanel({
  roomId,
  group,
  entries,
  walletAddress,
  connected,
  channelReady,
  busy,
  draft,
  chatEndRef,
  onBack,
  onDraftChange,
  onSendMessage,
}: GroupConversationPanelProps) {
  const [
    proofEntry,
    setProofEntry,
  ] =
    useState<ConversationEntry | null>(
      null,
    );

  const visibleEntries =
    entries
      .filter(
        (entry) =>
          entry.kind ===
            "message" &&
          (entry.scope ??
            "group") ===
            "group" &&
          entry.groupId ===
            group.id,
      )
      .sort(
        (left, right) =>
          new Date(
            left.sentAt,
          ).getTime() -
          new Date(
            right.sentAt,
          ).getTime(),
      );

  const admin =
    isGroupAdmin(
      group,
      walletAddress,
    );

  return (
    <>
      <div className="border-x border-b border-wire bg-vault/20 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/35 transition hover:text-signal"
          >
            ← Groups
          </button>

          <div className="min-w-0 text-right">
            <p className="truncate text-sm text-paper/70">
              {group.name}
            </p>

            <p className="mt-0.5 font-display text-[8px] uppercase tracking-[0.12em] text-paper/25">
              {admin
                ? "You are admin"
                : "Member"}
            </p>
          </div>
        </div>
      </div>

      <div className="border-x border-b border-wire bg-vault/15 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/35">
              Members
            </p>

            <p className="mt-1 text-[10px] text-paper/25">
              {group.members.length} member
              {group.members.length === 1
                ? ""
                : "s"}
            </p>
          </div>

          {admin && (
            <Link
              href={`/room/${roomId}?access=group&group=${encodeURIComponent(
                group.id,
              )}`}
              className="border border-signal/25 px-3 py-2 font-display text-[8px] uppercase tracking-[0.13em] text-signal/70 transition hover:bg-signal hover:text-ink"
            >
              + Invite member
            </Link>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {group.members.map(
            (member) => {
              const own =
                sameStarknetAddress(
                  member.address,
                  walletAddress,
                );

              return (
                <div
                  key={
                    member.address
                  }
                  className="flex items-center justify-between gap-3 rounded-lg border border-wire/70 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-paper/60">
                        {own
                          ? "You"
                          : shortAddress(
                              member.address,
                            )}
                      </p>

                      <span
                        className={
                          member.role ===
                          "admin"
                            ? "font-display text-[7px] uppercase tracking-[0.12em] text-signal/55"
                            : "font-display text-[7px] uppercase tracking-[0.12em] text-paper/25"
                        }
                      >
                        {member.role}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate font-mono text-[9px] text-paper/20">
                      {member.address}
                    </p>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>

      <div className="min-h-[320px] max-h-[52vh] overflow-y-auto border-x border-b border-wire bg-black/10">
        {visibleEntries.length ===
        0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
              <span className="text-base text-signal">
                ✦
              </span>
            </div>

            <h3 className="font-display text-sm text-paper/70">
              Start {group.name}
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
              Only members with this Group key can read new messages here.
            </p>
          </div>
        ) : (
          <ul className="space-y-5 p-4 sm:p-5">
            {visibleEntries.map(
              (entry) => (
                <MessageBubble
                  key={`group:${group.id}:${entry.actionLocator}`}
                  entry={entry}
                  walletAddress={
                    walletAddress
                  }
                  mode="group"
                  onViewProof={
                    setProofEntry
                  }
                />
              ),
            )}

            <div
              ref={(node) => {
                chatEndRef.current =
                  node;
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
            {group.name}
          </span>

          <span className="text-[9px] text-paper/25">
            Group encrypted
          </span>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) =>
              onDraftChange(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                void onSendMessage();
              }
            }}
            placeholder={`Write to ${group.name}…`}
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

      {proofEntry
        ?.transactionHash && (
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
