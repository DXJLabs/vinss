"use client";

import {
  useRef,
  useState,
} from "react";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { EncryptedAttachmentPreview } from "@/components/room/conversation/EncryptedAttachmentPreview";
import type { AttachmentRef } from "@/types/deal-room";
import {
  messageTime,
} from "@/components/room/conversation/chatFormat";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";
import { useStarkIdentity } from "@/hooks/useStarkIdentity";

const MESSAGE_LONG_PRESS_MS = 550;

function hiddenMessageStorageKey(
  walletAddress: string | undefined,
  actionLocator: string,
): string | null {
  if (!walletAddress || !actionLocator) {
    return null;
  }

  let wallet = walletAddress.toLowerCase();

  try {
    wallet = `0x${BigInt(walletAddress).toString(16)}`;
  } catch {
    // Keep the original normalized string if an address is malformed.
  }

  const locator = actionLocator
    .replace(/^0x/, "")
    .toLowerCase();

  return (
    `vinss:hidden-message:v1:${wallet}:` +
    locator
  );
}

interface MessageBubbleProps {
  entry: ConversationEntry;
  walletAddress?: string;
  mode: "group" | "direct";
  onViewProof: (
    entry: ConversationEntry,
  ) => void;
  onLoadAttachment?: (
    attachment: AttachmentRef,
  ) => Promise<Blob>;
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
  onLoadAttachment,
}: MessageBubbleProps) {
  const own = sameStarknetAddress(
    entry.senderAddress,
    walletAddress,
  );

  const hiddenStorageKey =
    hiddenMessageStorageKey(
      walletAddress,
      entry.actionLocator,
    );

  const [hidden, setHidden] =
    useState(() => {
      if (
        typeof window === "undefined" ||
        !hiddenStorageKey
      ) {
        return false;
      }

      return (
        window.localStorage.getItem(
          hiddenStorageKey,
        ) === "1"
      );
    });

  const [
    deleteMenuOpen,
    setDeleteMenuOpen,
  ] = useState(false);

  const longPressTimerRef =
    useRef<number | null>(null);

  const pressStartRef =
    useRef<{
      x: number;
      y: number;
    } | null>(null);

  const longPressTriggeredRef =
    useRef(false);

  function cancelLongPress() {
    if (
      longPressTimerRef.current !== null
    ) {
      window.clearTimeout(
        longPressTimerRef.current,
      );
      longPressTimerRef.current = null;
    }

    pressStartRef.current = null;
  }

  function startLongPress(
    event: React.PointerEvent,
  ) {
    cancelLongPress();

    longPressTriggeredRef.current = false;
    pressStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };

    longPressTimerRef.current =
      window.setTimeout(() => {
        longPressTriggeredRef.current =
          true;
        setDeleteMenuOpen(true);
        longPressTimerRef.current = null;
      }, MESSAGE_LONG_PRESS_MS);
  }

  function moveLongPress(
    event: React.PointerEvent,
  ) {
    const start = pressStartRef.current;

    if (!start) return;

    const moved =
      Math.abs(event.clientX - start.x) >
        10 ||
      Math.abs(event.clientY - start.y) >
        10;

    if (moved) {
      cancelLongPress();
    }
  }

  function deleteLocally() {
    if (hiddenStorageKey) {
      window.localStorage.setItem(
        hiddenStorageKey,
        "1",
      );
    }

    setDeleteMenuOpen(false);
    setHidden(true);
  }

  const {
    label: resolvedSenderLabel,
  } = useStarkIdentity(
    entry.senderAddress,
  );

  const senderLabel = own
    ? "You"
    : resolvedSenderLabel;

  const showSender = mode === "group";

  /*
   * Outgoing messages appear immediately after preparation.
   *
   * An empty transactionHash means the exact locator is still waiting for
   * blockchain confirmation. The existing spinner represents that state.
   * Failed prepared messages are removed by useDirectConversation after
   * blockchain reconciliation; presentation must not hide pending state.
   */
  if (hidden) {
    return null;
  }

  return (
    <li
      onPointerDown={startLongPress}
      onPointerMove={moveLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onContextMenu={(event) => {
        event.preventDefault();
        cancelLongPress();
        setDeleteMenuOpen(true);
      }}
      onClickCapture={(event) => {
        if (
          longPressTriggeredRef.current
        ) {
          event.preventDefault();
          event.stopPropagation();
          longPressTriggeredRef.current =
            false;
        }
      }}
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
          {entry.attachment && onLoadAttachment && (
            <EncryptedAttachmentPreview
              attachment={entry.attachment}
              onLoad={onLoadAttachment}
            />
          )}

          {(!entry.attachment ||
            entry.summary !== entry.attachment.fileName) && (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-paper/88">
              {entry.summary}
            </p>
          )}

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

        {deleteMenuOpen && (
          <div
            className={
              own
                ? "mt-2 flex justify-end"
                : "mt-2 flex justify-start"
            }
          >
            <div className="overflow-hidden rounded-xl border border-wire/70 bg-ink/95 shadow-xl">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteLocally();
                }}
                className="block w-full px-4 py-3 text-left text-[11px] font-medium text-danger transition hover:bg-danger/[0.08]"
              >
                Delete from this device
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteMenuOpen(false);
                }}
                className="block w-full border-t border-wire/50 px-4 py-3 text-left text-[10px] text-paper/45 transition hover:bg-paper/[0.04]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
