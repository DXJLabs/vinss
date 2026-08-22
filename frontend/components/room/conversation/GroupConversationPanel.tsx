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
  ConversationActions,
} from "@/components/room/conversation/ConversationActions";
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

  const [membersOpen, setMembersOpen] =
    useState(false);

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
      <div className="flex items-center gap-3 border-x border-b border-wire bg-vault/20 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to groups"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base text-paper/45 ring-1 ring-wire/60 transition hover:text-signal hover:ring-signal/25"
        >
          ←
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-paper/78">
            {group.name}
          </p>

          <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-paper/30">
            <span>
              {group.members.length}{" "}
              {group.members.length === 1
                ? "member"
                : "members"}
            </span>

            <span
              className="text-paper/15"
              aria-hidden="true"
            >
              ·
            </span>

            <span className="inline-flex items-center gap-1 text-signal/55">
              <span
                className="h-1.5 w-1.5 rounded-full bg-signal/70"
                aria-hidden="true"
              />
              Encrypted
            </span>
          </div>
        </div>
      </div>

      <div className="border-x border-b border-wire/60 bg-vault/[0.08]">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() =>
              setMembersOpen(
                (value) => !value,
              )
            }
            aria-expanded={membersOpen}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="text-[10px] font-medium text-paper/45">
              Members
            </span>

            <span className="rounded-full bg-vault/60 px-2 py-0.5 text-[9px] text-paper/35">
              {group.members.length}
            </span>

            <span
              className="text-[10px] text-paper/25"
              aria-hidden="true"
            >
              {membersOpen
                ? "⌃"
                : "⌄"}
            </span>
          </button>

          {admin && connected && (
            <Link
              href={`/room/${roomId}?access=group&group=${encodeURIComponent(
                group.id,
              )}`}
              className="rounded-lg border border-signal/20 px-2.5 py-1.5 text-[9px] font-medium text-signal/65 transition hover:bg-signal/[0.06] hover:text-signal"
            >
              + Invite
            </Link>
          )}
        </div>

        {membersOpen && (
          <div className="space-y-1 border-t border-wire/50 px-3 py-2">
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
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-vault/25"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-wire/70 bg-vault/45 text-[9px] text-signal/55">
                        {member.address
                          .slice(2, 4)
                          .toUpperCase()}
                      </div>

                      <p className="truncate text-[11px] text-paper/55">
                        {own
                          ? "You"
                          : shortAddress(
                              member.address,
                            )}
                      </p>
                    </div>

                    <span
                      className={
                        member.role ===
                        "admin"
                          ? "shrink-0 text-[7px] uppercase tracking-[0.12em] text-signal/55"
                          : "shrink-0 text-[7px] uppercase tracking-[0.12em] text-paper/25"
                      }
                    >
                      {member.role}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>

      <div className="min-h-[320px] max-h-[55vh] overflow-y-auto border-x border-wire/60 bg-black/10">
        {visibleEntries.length ===
        0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/15 bg-signal/[0.04]">
              <span className="text-base text-signal/75">
                ✦
              </span>
            </div>

            <h3 className="text-sm font-medium text-paper/65">
              Start the conversation
            </h3>

            <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-paper/30">
              Messages are encrypted for
              members of {group.name}.
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

      <ConversationActions
        connected={
          connected &&
          channelReady
        }
        busy={busy}
      />

      <div className="border-x border-b border-wire/60 bg-vault/12 p-2">
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
            placeholder={
              connected
                ? `Message ${group.name}…`
                : "Connect wallet to message…"
            }
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
            className="h-11 rounded-lg border border-signal/30 px-4 text-[9px] font-medium uppercase tracking-[0.12em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
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
