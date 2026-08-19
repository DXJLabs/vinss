"use client";

import { useState, type MutableRefObject } from "react";
import { NETWORK } from "@/lib/starknet/constants";
import type { OfferActionPayload } from "@/types/deal-room";
import { OfferCard } from "@/components/room/conversation/OfferCard";
import { ProofModal } from "@/components/room/conversation/ProofModal";

export interface ConversationEntry {
  id: string;
  kind: "message" | "offer";
  summary: string;
  transactionHash: string;
  actionLocator: string;
  sentAt: string;

  // Preserve the encrypted message scope after local decryption so the UI can
  // keep the Group conversation separate from pairwise chats.
  scope?: "group" | "direct";

  // Preserve the encrypted recipient only in local application state.
  recipientAddress?: string;

  // Preserve the decrypted sender only in local application state.
  senderAddress?: string;

  // Preserve locally decrypted immutable Offer lifecycle data for direct cards.
  offerAction?: OfferActionPayload;

  // Live read receipts are ephemeral UI state and are never written on-chain.
  readAt?: string;
}

interface ConversationParticipant {
  address: string;
}

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
  onAcceptOffer: (entry: ConversationEntry) => Promise<boolean>;
  onRejectOffer: (entry: ConversationEntry) => Promise<boolean>;
  onCounterOffer: (entry: ConversationEntry) => void;
}

function explorerUrl(transactionHash: string): string {
  return NETWORK === "mainnet"
    ? `https://voyager.online/tx/${transactionHash}`
    : `https://sepolia.voyager.online/tx/${transactionHash}`;
}

// Render a compact wallet label until optional username resolution is added.
function shortAddress(address: string): string {
  // Keep very short values unchanged.
  if (address.length <= 14) return address;

  // Show enough prefix and suffix characters to distinguish participants.
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

// Format a message timestamp for the chat timeline.
function messageTime(sentAt: string): string {
  return new Date(sentAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  // Only one proof popup can be open at a time, keeping the timeline compact.
  const [proofEntry, setProofEntry] =
    useState<ConversationEntry | null>(null);

  // Normalize the currently connected wallet once for direct-chat filtering.
  const normalizedWallet = walletAddress?.toLowerCase() ?? "";

  // Normalize the selected chat target once for direct-chat filtering.
  const normalizedTarget = messageTarget.toLowerCase();

  // Merge separate domain states only at the UI boundary.
  const conversationEntries = [...entries, ...offerEntries];

  // Keep Group and pairwise conversations visually separate.
  const visibleEntries = conversationEntries.filter((entry) => {
    // Treat legacy messages without an explicit scope as Group messages.
    const scope = entry.scope ?? "group";

    // Group never receives Offer cards; it contains group messages only.
    if (messageTarget === "group") {
      return entry.kind === "message" && scope === "group";
    }

    // Ignore Group content while a participant chat is selected.
    if (scope !== "direct") return false;

    // Normalize locally decrypted participant addresses for pair filtering.
    const sender = entry.senderAddress?.toLowerCase() ?? "";
    const recipient = entry.recipientAddress?.toLowerCase() ?? "";

    // Show content sent by the selected participant to the current wallet.
    const incomingFromTarget =
      sender === normalizedTarget &&
      recipient === normalizedWallet;

    // Show content sent by the current wallet to the selected participant.
    const outgoingToTarget =
      sender === normalizedWallet &&
      recipient === normalizedTarget;

    // Messages and Offer cards now share the same pairwise conversation.
    return incomingFromTarget || outgoingToTarget;
  });

  // Any child action supersedes its immutable parent for Accept/Reject/Counter.
  const supersededOfferLocators = new Set(
    visibleEntries
      .filter(
        (entry) =>
          entry.kind === "offer" &&
          Boolean(entry.offerAction?.parentOfferLocator),
      )
      .map((entry) =>
        entry.offerAction!.parentOfferLocator!
          .replace(/^0x/, "")
          .toLowerCase(),
      ),
  );

  // Resolve the current chat label without introducing a username dependency yet.
  const activeChatLabel =
    messageTarget === "group"
      ? "Group"
      : shortAddress(messageTarget);

  return (
    <section className="space-y-5">
      <div className="border border-wire bg-vault/30">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
                Chat
              </p>

              <span className="flex items-center gap-1.5 font-display text-[8px] uppercase tracking-[0.14em] text-signal/65">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
                Live
              </span>
            </div>

            <p className="mt-1.5 text-[11px] text-paper/35">
              {activeChatLabel} · end-to-end encrypted
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={!channelReady || busy}
            className="border border-wire px-3 py-2 font-display text-[9px] uppercase tracking-[0.14em] text-paper/35 transition hover:border-signal/50 hover:text-signal disabled:opacity-30"
            title="Force room sync"
          >
            {busy ? "Syncing…" : "Sync"}
          </button>
        </div>

        {/* Keep chat selection simple: Group first, then one tab per participant. */}
        <div className="flex gap-2 overflow-x-auto border-t border-wire px-3 py-2">
          <button
            type="button"
            onClick={() => onMessageTargetChange("group")}
            className={
              messageTarget === "group"
                ? "shrink-0 border border-signal bg-signal px-3 py-2 font-display text-[9px] uppercase tracking-widest text-ink"
                : "shrink-0 border border-wire px-3 py-2 font-display text-[9px] uppercase tracking-widest text-paper/40 transition hover:border-signal/50 hover:text-signal"
            }
          >
            Group
          </button>

          {participants.map((participant) => (
            <button
              key={participant.address}
              type="button"
              onClick={() => onMessageTargetChange(participant.address)}
              className={
                messageTarget.toLowerCase() === participant.address.toLowerCase()
                  ? "shrink-0 border border-signal bg-signal px-3 py-2 font-display text-[9px] uppercase tracking-widest text-ink"
                  : "shrink-0 border border-wire px-3 py-2 font-display text-[9px] uppercase tracking-widest text-paper/40 transition hover:border-signal/50 hover:text-signal"
              }
              title={participant.address}
            >
              {shortAddress(participant.address)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[420px] max-h-[58vh] overflow-y-auto border-x border-b border-wire bg-black/10">
        {visibleEntries.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
              <span className="text-lg text-signal">✦</span>
            </div>

            <h3 className="font-display text-sm text-paper/70">
              {messageTarget === "group"
                ? "Start the group chat"
                : `Chat with ${activeChatLabel}`}
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
              {messageTarget === "group"
                ? "Messages here are shared with everyone in this room."
                : "Messages here use a pairwise key shared only with this participant."}
            </p>

            <div className="mt-5 flex items-center gap-2 font-display text-[8px] uppercase tracking-[0.16em] text-paper/25">
              <span className="h-1.5 w-1.5 rounded-full bg-signal/70" />
              Live encrypted channel
            </div>
          </div>
        ) : (
          <div className="flex min-h-[420px] flex-col justify-end">
            <ul className="space-y-5 p-4 sm:p-5">
              {[...visibleEntries]
                .sort(
                  (a, b) =>
                    new Date(a.sentAt).getTime() -
                    new Date(b.sentAt).getTime(),
                )
                .map((entry) => {
                  const isOwnMessage =
                    entry.kind === "message" &&
                    Boolean(
                      entry.senderAddress &&
                        walletAddress &&
                        entry.senderAddress.toLowerCase() ===
                          walletAddress.toLowerCase(),
                    );

                  const isPeerMessage =
                    entry.kind === "message" &&
                    Boolean(
                      entry.senderAddress &&
                        walletAddress &&
                        entry.senderAddress.toLowerCase() !==
                          walletAddress.toLowerCase(),
                    );

                  return (
                    <li
                      key={`${entry.kind}:${entry.actionLocator}`}
                      className="group"
                    >
                      {entry.kind === "message" ? (
                        <div
                          className={
                            isPeerMessage
                              ? "flex justify-start"
                              : "flex justify-end"
                          }
                        >
                          <div className="max-w-[82%]">
                            <div
                              className={
                                isOwnMessage
                                  ? "mb-1 text-right font-display text-[8px] uppercase tracking-[0.14em] text-signal/55"
                                  : "mb-1 text-left font-display text-[8px] uppercase tracking-[0.14em] text-paper/30"
                              }
                            >
                              {isOwnMessage ? "You" : "Counterparty"}
                            </div>

                            <div
                              className={
                                isOwnMessage
                                  ? "rounded-lg rounded-br-sm border border-signal/30 bg-signal/[0.07] px-4 py-3 shadow-[0_0_30px_rgba(45,212,191,0.025)]"
                                  : "rounded-lg rounded-bl-sm border border-wire bg-vault/45 px-4 py-3"
                              }
                            >
                              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-paper/85">
                                {entry.summary}
                              </p>
                            </div>

                            <div
                              className={
                                isOwnMessage
                                  ? "mt-1.5 flex justify-end"
                                  : "mt-1.5 flex justify-start"
                              }
                            >
                              <span className="text-[9px] text-paper/25">
                                {messageTime(entry.sentAt)}
                                {" · "}
                                Encrypted
                                {" · "}
                                {!entry.transactionHash ? (
                                  <span
                                    className="inline-flex h-3 w-3 items-center justify-center"
                                    title="Sending"
                                    aria-label="Sending"
                                  >
                                    <span className="h-2.5 w-2.5 animate-spin rounded-full border border-paper/15 border-t-signal/70" />
                                  </span>
                                ) : (
                                  <span
                                    className="text-signal/60"
                                    title={
                                      isOwnMessage &&
                                      entry.scope === "direct" &&
                                      entry.readAt
                                        ? "Read"
                                        : "Sent"
                                    }
                                    aria-label={
                                      isOwnMessage &&
                                      entry.scope === "direct" &&
                                      entry.readAt
                                        ? "Read"
                                        : "Sent"
                                    }
                                  >
                                    {isOwnMessage &&
                                    entry.scope === "direct" &&
                                    entry.readAt
                                      ? "✓✓"
                                      : "✓"}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <OfferCard
                          entry={entry}
                          walletAddress={walletAddress}
                          busy={busy}
                          actionable={Boolean(
                            entry.offerAction &&
                              (entry.offerAction.kind === "create" ||
                                entry.offerAction.kind === "counter") &&
                              walletAddress &&
                              entry.offerAction.recipientAddress?.toLowerCase() ===
                                walletAddress.toLowerCase() &&
                              !supersededOfferLocators.has(
                                entry.actionLocator
                                  .replace(/^0x/, "")
                                  .toLowerCase(),
                              ),
                          )}
                          onAccept={onAcceptOffer}
                          onReject={onRejectOffer}
                          onCounter={onCounterOffer}
                        />
                      )}

                      {entry.transactionHash && (
                        <div
                          className={
                            entry.kind === "message"
                              ? isPeerMessage
                                ? "mt-1.5 max-w-[82%]"
                                : "ml-auto mt-1.5 max-w-[82%] text-right"
                              : "mx-auto mt-2 max-w-[92%]"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setProofEntry(entry)}
                            className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/20 transition hover:text-signal/70"
                          >
                            View proof
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}

              <div
                ref={(node) => {
                  chatEndRef.current = node;
                }}
                className="h-px"
                aria-hidden="true"
              />
            </ul>
          </div>
        )}
      </div>

      <div className="border border-wire bg-vault/20 p-2">
        <div className="mb-2 flex items-center justify-between border-b border-wire/60 px-2 pb-2">
          <span className="font-display text-[9px] uppercase tracking-widest text-paper/30">
            {activeChatLabel}
          </span>

          <span
            className={
              peerTyping && messageTarget !== "group"
                ? "text-[9px] text-signal/70"
                : "text-[9px] text-paper/25"
            }
          >
            {peerTyping && messageTarget !== "group"
              ? "Typing…"
              : messageTarget === "group"
                ? "Group"
                : "Direct"}
          </span>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onSendMessage();
              }
            }}
            placeholder={
              connected
                ? "Write an encrypted message…"
                : "Connect your wallet to start chatting…"
            }
            disabled={!connected || !channelReady || busy}
            rows={1}
            className="min-h-[46px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 disabled:opacity-40"
          />

          <button
            onClick={() => void onSendMessage()}
            disabled={!connected || !channelReady || busy || !draft.trim()}
            className="flex h-[46px] min-w-[72px] items-center justify-center border border-signal bg-signal px-4 font-display text-[10px] uppercase tracking-widest text-ink transition hover:bg-transparent hover:text-signal disabled:border-wire disabled:bg-transparent disabled:text-paper/20"
          >
            {busy ? "…" : "Send →"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.16em] text-paper/25">
        <span className="text-signal/60">●</span>
        End-to-end encrypted
      </div>

      {proofEntry?.transactionHash && (
        <ProofModal
          kind={proofEntry.kind}
          transactionHash={proofEntry.transactionHash}
          recordId={proofEntry.actionLocator}
          explorerUrl={explorerUrl(proofEntry.transactionHash)}
          onClose={() => setProofEntry(null)}
        />
      )}
    </section>
  );
}
