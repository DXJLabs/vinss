"use client";

import {
  useState,
  type MutableRefObject,
} from "react";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { MessageBubble } from "@/components/room/conversation/MessageBubble";
import { OfferCard } from "@/components/room/conversation/OfferCard";
import { ProofModal } from "@/components/room/conversation/ProofModal";
import {
  explorerUrl,
  shortAddress,
} from "@/components/room/conversation/chatFormat";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";

interface DirectConversationPanelProps {
  entries: ConversationEntry[];
  offerEntries: ConversationEntry[];
  walletAddress?: string;
  peerAddress: string;
  connected: boolean;
  channelReady: boolean;
  busy: boolean;
  draft: string;
  peerTyping: boolean;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void | Promise<void>;
  onCreateOffer: () => void;
  onAcceptOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onRejectOffer: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onCounterOffer: (
    entry: ConversationEntry,
  ) => void;
  onOpenEscrow: (
    entry: ConversationEntry,
  ) => void;
}

export function DirectConversationPanel({
  entries,
  offerEntries,
  walletAddress,
  peerAddress,
  connected,
  channelReady,
  busy,
  draft,
  peerTyping,
  chatEndRef,
  onBack,
  onDraftChange,
  onSendMessage,
  onCreateOffer,
  onAcceptOffer,
  onRejectOffer,
  onCounterOffer,
  onOpenEscrow,
}: DirectConversationPanelProps) {
  const [proofEntry, setProofEntry] =
    useState<ConversationEntry | null>(null);

  const pairEntries = [
    ...entries,
    ...offerEntries,
  ]
    .filter((entry) => {
      if (
        (entry.scope ?? "group") !==
        "direct"
      ) {
        return false;
      }

      const incoming =
        sameStarknetAddress(
          entry.senderAddress,
          peerAddress,
        ) &&
        sameStarknetAddress(
          entry.recipientAddress,
          walletAddress,
        );

      const outgoing =
        sameStarknetAddress(
          entry.senderAddress,
          walletAddress,
        ) &&
        sameStarknetAddress(
          entry.recipientAddress,
          peerAddress,
        );

      return incoming || outgoing;
    })
    .sort(
      (left, right) =>
        new Date(left.sentAt).getTime() -
        new Date(right.sentAt).getTime(),
    );

  const supersededOfferLocators =
    new Set(
      pairEntries
        .filter(
          (entry) =>
            entry.kind === "offer" &&
            Boolean(
              entry.offerAction
                ?.parentOfferLocator,
            ),
        )
        .map((entry) =>
          entry.offerAction!
            .parentOfferLocator!
            .replace(/^0x/, "")
            .toLowerCase(),
        ),
    );

  const peerLabel =
    shortAddress(peerAddress);

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-x border-b border-wire bg-vault/20 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/35 transition hover:text-signal"
        >
          ← Chats
        </button>

        <div className="min-w-0 text-right">
          <p className="truncate text-xs text-paper/60">
            {peerLabel}
          </p>
          <p className="truncate font-mono text-[8px] text-paper/20">
            {peerAddress}
          </p>
        </div>
      </div>

      <div className="min-h-[360px] max-h-[58vh] overflow-y-auto border-x border-b border-wire bg-black/10">
        {pairEntries.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
              <span className="text-base text-signal">
                ✦
              </span>
            </div>

            <h3 className="font-display text-sm text-paper/70">
              Private chat
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
              Only you and {peerLabel} can read messages and offers here.
            </p>
          </div>
        ) : (
          <ul className="space-y-4 p-4 sm:p-5">
            {pairEntries.map((entry) => {
              if (entry.kind === "message") {
                return (
                  <MessageBubble
                    key={`direct:${entry.actionLocator}`}
                    entry={entry}
                    walletAddress={
                      walletAddress
                    }
                    mode="direct"
                    onViewProof={
                      setProofEntry
                    }
                  />
                );
              }

              const actionable =
                Boolean(
                  entry.offerAction &&
                    (entry.offerAction
                      .kind === "create" ||
                      entry.offerAction
                        .kind ===
                        "counter") &&
                    sameStarknetAddress(
                      entry.offerAction
                        .recipientAddress,
                      walletAddress,
                    ) &&
                    !supersededOfferLocators.has(
                      entry.actionLocator
                        .replace(/^0x/, "")
                        .toLowerCase(),
                    ),
                );

              return (
                <li
                  key={`offer:${entry.actionLocator}`}
                >
                  <OfferCard
                    entry={entry}
                    walletAddress={
                      walletAddress
                    }
                    busy={busy}
                    actionable={
                      actionable
                    }
                    onAccept={
                      onAcceptOffer
                    }
                    onReject={
                      onRejectOffer
                    }
                    onCounter={
                      onCounterOffer
                    }
                    onOpenEscrow={
                      onOpenEscrow
                    }
                  />

                  {entry.transactionHash && (
                    <div
                      className={
                        sameStarknetAddress(
                          entry.senderAddress,
                          walletAddress,
                        )
                          ? "mt-1.5 text-right"
                          : "mt-1.5 text-left"
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setProofEntry(
                            entry,
                          )
                        }
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
        )}
      </div>

      <div className="border border-wire bg-vault/20 p-2">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-wire/60 px-2 pb-2">
          <span className="font-display text-[9px] uppercase tracking-widest text-paper/30">
            {peerLabel}
          </span>

          <div className="flex items-center gap-3">
            <span
              className={
                peerTyping
                  ? "text-[9px] text-signal/70"
                  : "text-[9px] text-paper/25"
              }
            >
              {peerTyping
                ? "Typing…"
                : "Private"}
            </span>

            <button
              type="button"
              onClick={onCreateOffer}
              disabled={
                !connected ||
                !channelReady ||
                busy
              }
              className="border border-amber-400/30 px-2.5 py-1.5 font-display text-[8px] uppercase tracking-[0.12em] text-amber-300/75 transition hover:bg-amber-400/10 disabled:opacity-30"
            >
              + Create Offer
            </button>
          </div>
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
            placeholder={`Message ${peerLabel}…`}
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
          kind={proofEntry.kind}
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
