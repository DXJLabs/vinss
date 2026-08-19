"use client";

import type { ConversationEntry } from "@/components/room/conversation/types";
import {
  messageTime,
  shortAddress,
} from "@/components/room/conversation/chatFormat";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";

interface MessageBubbleProps {
  entry: ConversationEntry;
  walletAddress?: string;
  mode: "group" | "direct";
  onViewProof: (
    entry: ConversationEntry,
  ) => void;
}

export function MessageBubble({
  entry,
  walletAddress,
  mode,
  onViewProof,
}: MessageBubbleProps) {
  const own = sameStarknetAddress(
    entry.senderAddress,
    walletAddress,
  );

  const senderLabel = own
    ? "You"
    : mode === "direct"
      ? "Counterparty"
      : entry.senderAddress
        ? shortAddress(entry.senderAddress)
        : "Participant";

  return (
    <li
      className={
        own
          ? "flex justify-end"
          : "flex justify-start"
      }
    >
      <div className="max-w-[82%]">
        <div
          className={
            own
              ? "mb-1 text-right font-display text-[8px] uppercase tracking-[0.14em] text-signal/55"
              : "mb-1 text-left font-display text-[8px] uppercase tracking-[0.14em] text-paper/30"
          }
        >
          {senderLabel}
        </div>

        <div
          className={
            own
              ? "rounded-lg rounded-br-sm border border-signal/30 bg-signal/[0.07] px-4 py-3"
              : "rounded-lg rounded-bl-sm border border-wire bg-vault/45 px-4 py-3"
          }
        >
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-paper/85">
            {entry.summary}
          </p>
        </div>

        <div
          className={
            own
              ? "mt-1.5 flex items-center justify-end gap-2"
              : "mt-1.5 flex items-center justify-start gap-2"
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
                  mode === "direct" &&
                  own &&
                  entry.readAt
                    ? "Read"
                    : "Sent"
                }
                aria-label={
                  mode === "direct" &&
                  own &&
                  entry.readAt
                    ? "Read"
                    : "Sent"
                }
              >
                {mode === "direct" &&
                own &&
                entry.readAt
                  ? "✓✓"
                  : "✓"}
              </span>
            )}
          </span>
        </div>

        {entry.transactionHash && (
          <div
            className={
              own
                ? "mt-1 text-right"
                : "mt-1 text-left"
            }
          >
            <button
              type="button"
              onClick={() =>
                onViewProof(entry)
              }
              className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/20 transition hover:text-signal/70"
            >
              View proof
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
