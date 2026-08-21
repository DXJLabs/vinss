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

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9.3 12 1.8 1.8 3.7-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProofIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M10.5 13.5 13.5 10.5"
        strokeLinecap="round"
      />
      <path
        d="M7.2 15.8 5.6 17.4a3.4 3.4 0 0 1-4.8-4.8l3.4-3.4A3.4 3.4 0 0 1 9 9"
        strokeLinecap="round"
      />
      <path
        d="m16.8 8.2 1.6-1.6a3.4 3.4 0 0 1 4.8 4.8l-3.4 3.4A3.4 3.4 0 0 1 15 15"
        strokeLinecap="round"
      />
    </svg>
  );
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
    : entry.senderAddress
      ? shortAddress(entry.senderAddress)
      : "Participant";

  const showSender = mode === "group";

  return (
    <li
      className={
        own
          ? "flex justify-end"
          : "flex justify-start"
      }
    >
      <div className="max-w-[88%] sm:max-w-[78%]">
        {showSender && (
          <div
            className={
              own
                ? "mb-1.5 text-right text-[10px] font-medium text-signal/60"
                : "mb-1.5 text-left text-[10px] font-medium text-paper/35"
            }
          >
            {senderLabel}
          </div>
        )}

        <div
          className={
            own
              ? "rounded-2xl rounded-br-md bg-signal/[0.075] px-3.5 py-2.5 ring-1 ring-signal/22"
              : "rounded-2xl rounded-bl-md bg-vault/45 px-3.5 py-2.5 ring-1 ring-wire/55"
          }
        >
          <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-paper/88">
            {entry.summary}
          </p>

          <div
            className={
              own
                ? "mt-1.5 flex items-center justify-end gap-1.5 text-[9px] text-paper/28"
                : "mt-1.5 flex items-center justify-start gap-1.5 text-[9px] text-paper/28"
            }
          >
            <span>{messageTime(entry.sentAt)}</span>
            <span aria-hidden="true">·</span>

            <span
              className="inline-flex text-signal/55"
              title="End-to-end encrypted"
              aria-label="End-to-end encrypted"
            >
              <ShieldIcon />
            </span>

            {entry.transactionHash ? (
              <>
                <button
                  type="button"
                  onClick={() => onViewProof(entry)}
                  className="inline-flex rounded-md p-0.5 text-signal/65 transition hover:bg-signal/10 hover:text-signal"
                  title="View on-chain proof"
                  aria-label="View on-chain proof"
                >
                  <ProofIcon />
                </button>

                {own && (
                  <span
                    className="ml-0.5 text-signal/70"
                    title={
                      mode === "direct" && entry.readAt
                        ? "Read"
                        : "Sent"
                    }
                    aria-label={
                      mode === "direct" && entry.readAt
                        ? "Read"
                        : "Sent"
                    }
                  >
                    {mode === "direct" && entry.readAt
                      ? "✓✓"
                      : "✓"}
                  </span>
                )}
              </>
            ) : (
              <span
                className="inline-flex h-3.5 w-3.5 items-center justify-center"
                title="Anchoring on-chain"
                aria-label="Anchoring on-chain"
              >
                <span className="h-3 w-3 animate-spin rounded-full border border-paper/15 border-t-signal/70" />
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
