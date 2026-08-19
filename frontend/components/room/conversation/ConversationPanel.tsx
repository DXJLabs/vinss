"use client";

import type { MutableRefObject } from "react";
import { NETWORK } from "@/lib/starknet/constants";

export interface ConversationEntry {
  id: string;
  kind: "message" | "offer";
  summary: string;
  transactionHash: string;
  actionLocator: string;
  sentAt: string;
  senderAddress?: string;
}

interface ConversationParticipant {
  address: string;
}

interface ConversationPanelProps {
  entries: ConversationEntry[];
  walletAddress?: string;
  connected: boolean;
  channelReady: boolean;
  busy: boolean;
  draft: string;
  messageTarget: string;
  participants: ConversationParticipant[];
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  onDraftChange: (value: string) => void;
  onMessageTargetChange: (value: string) => void;
  onSendMessage: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}

function explorerUrl(transactionHash: string): string {
  return NETWORK === "mainnet"
    ? `https://voyager.online/tx/${transactionHash}`
    : `https://sepolia.voyager.online/tx/${transactionHash}`;
}

function messageTime(sentAt: string): string {
  return new Date(sentAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConversationPanel({
  entries,
  walletAddress,
  connected,
  channelReady,
  busy,
  draft,
  messageTarget,
  participants,
  chatEndRef,
  onDraftChange,
  onMessageTargetChange,
  onSendMessage,
  onRefresh,
}: ConversationPanelProps) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between border border-wire bg-vault/30 px-4 py-3.5">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
              Private conversation
            </p>

            <span className="flex items-center gap-1.5 font-display text-[8px] uppercase tracking-[0.14em] text-signal/65">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
              Live
            </span>
          </div>

          <p className="mt-1.5 text-[11px] text-paper/35">
            End-to-end encrypted · auto-sync
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

      <div className="min-h-[420px] max-h-[58vh] overflow-y-auto border-x border-b border-wire bg-black/10">
        {entries.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
              <span className="text-lg text-signal">✦</span>
            </div>

            <h3 className="font-display text-sm text-paper/70">
              Start the conversation
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
              Private messages appear here automatically once they are recorded
              and decrypted on your device.
            </p>

            <div className="mt-5 flex items-center gap-2 font-display text-[8px] uppercase tracking-[0.16em] text-paper/25">
              <span className="h-1.5 w-1.5 rounded-full bg-signal/70" />
              Live encrypted channel
            </div>
          </div>
        ) : (
          <div className="flex min-h-[420px] flex-col justify-end">
            <ul className="space-y-5 p-4 sm:p-5">
              {[...entries]
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
                                    title="Recording on Starknet"
                                    aria-label="Recording on Starknet"
                                  >
                                    <span className="h-2.5 w-2.5 animate-spin rounded-full border border-paper/15 border-t-signal/70" />
                                  </span>
                                ) : (
                                  <span
                                    className="text-signal/55"
                                    title="Recorded on Starknet"
                                    aria-label="Recorded on Starknet"
                                  >
                                    ✓
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-[92%] rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                          <div className="mb-1 flex items-center justify-between gap-4">
                            <span className="font-display text-[9px] uppercase tracking-[0.16em] text-amber-400/70">
                              Deal update
                            </span>

                            <span className="text-[9px] text-paper/25">
                              {messageTime(entry.sentAt)}
                            </span>
                          </div>

                          <p className="text-sm text-paper/70">
                            {entry.summary}
                          </p>
                        </div>
                      )}

                      <details
                        className={
                          !entry.transactionHash
                            ? "hidden"
                            : entry.kind === "message"
                              ? isPeerMessage
                                ? "mt-2 max-w-[82%]"
                                : "ml-auto mt-2 max-w-[82%]"
                              : "mx-auto mt-2 max-w-[92%]"
                        }
                      >
                        <summary
                          className={
                            entry.kind === "message" && !isPeerMessage
                              ? "cursor-pointer list-none text-right font-display text-[8px] uppercase tracking-[0.14em] text-paper/20 transition hover:text-signal/70"
                              : "cursor-pointer list-none text-left font-display text-[8px] uppercase tracking-[0.14em] text-paper/20 transition hover:text-signal/70"
                          }
                        >
                          Proof on-chain ↓
                        </summary>

                        <div className="mt-2 border border-wire bg-vault/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-display text-[8px] uppercase tracking-[0.16em] text-signal/60">
                              Starknet proof
                            </p>

                            <span className="font-display text-[8px] uppercase tracking-[0.12em] text-signal/45">
                              ✓ Recorded
                            </span>
                          </div>

                          <div className="mt-3 space-y-2 font-mono text-[9px] text-paper/35">
                            <div>
                              <p className="mb-1 font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                                Transaction
                              </p>
                              <p className="break-all">
                                {entry.transactionHash}
                              </p>
                            </div>

                            <div>
                              <p className="mb-1 font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                                Action locator
                              </p>
                              <p className="break-all">0x{entry.actionLocator}</p>
                            </div>
                          </div>

                          <p className="mt-3 text-[9px] leading-relaxed text-paper/25">
                            The transaction proves this encrypted action was
                            recorded on Starknet. Message plaintext is not
                            exposed on-chain.
                          </p>

                          <a
                            href={explorerUrl(entry.transactionHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 flex h-9 items-center justify-center border border-signal/25 font-display text-[8px] uppercase tracking-[0.15em] text-signal/65 transition hover:border-signal hover:bg-signal hover:text-ink"
                          >
                            Open in Voyager ↗
                          </a>
                        </div>
                      </details>
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
        <div className="mb-2 flex items-center gap-2 border-b border-wire/60 px-2 pb-2">
          <span className="font-display text-[9px] uppercase tracking-widest text-paper/30">
            To
          </span>

          <select
            value={messageTarget}
            onChange={(event) => onMessageTargetChange(event.target.value)}
            disabled={!connected || busy}
            className="min-w-0 flex-1 bg-transparent text-xs text-paper/65 outline-none"
          >
            <option value="group">Group · everyone in this room</option>

            {participants.map((participant) => (
              <option key={participant.address} value={participant.address}>
                Direct · {participant.address.slice(0, 8)}…
                {participant.address.slice(-6)}
              </option>
            ))}
          </select>
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
    </section>
  );
}
