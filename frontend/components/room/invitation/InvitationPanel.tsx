"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import type {
  GroupInviteDuration,
  InviteScope,
} from "@/lib/deal-room/invitation";
import type {
  InviteUiState,
} from "@/hooks/room/useRoomInvitation";
import type {
  LocalRoomGroup,
} from "@/lib/groups/localGroups";

interface InviteCardProps {
  scope: InviteScope;
  state: InviteUiState;
  joined: boolean;
  disabled: boolean;
  groupDuration: GroupInviteDuration;
  onGroupDurationChange: (
    value: GroupInviteDuration,
  ) => void;
  onCreate: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
  onShareTo: (
    target: "whatsapp" | "telegram" | "x",
  ) => void | Promise<void>;
}

function InviteCard({
  scope,
  state,
  joined,
  disabled,
  groupDuration,
  onGroupDurationChange,
  onCreate,
  onCopy,
  onShare,
  onShareTo,
}: InviteCardProps) {
  const groupMode =
    scope === "group";

  const [
    shareOpen,
    setShareOpen,
  ] = useState(false);

  const [
    qrOpen,
    setQrOpen,
  ] = useState(false);

  const qrCanvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const [
    qrShareFile,
    setQrShareFile,
  ] = useState<File | null>(null);

  useEffect(() => {
    if (!qrOpen) {
      setQrShareFile(null);
      return;
    }

    const timer = window.setTimeout(() => {
      qrCanvasRef.current?.toBlob(
        (blob) => {
          if (!blob) return;

          setQrShareFile(
            new File(
              [blob],
              "vinss-private-invite.png",
              {
                type: "image/png",
              },
            ),
          );
        },
        "image/png",
      );
    }, 50);

    return () =>
      window.clearTimeout(timer);
  }, [qrOpen, state.link]);



  const [
    qrShareError,
    setQrShareError,
  ] = useState<string | null>(null);

  const shareQr = async () => {
    setQrShareError(null);

    if (!qrShareFile) {
      setQrShareError(
        "QR image is still preparing.",
      );
      return;
    }

    if (
      typeof navigator.share !== "function"
    ) {
      setQrShareError(
        "Native sharing is unavailable.",
      );
      return;
    }

    if (
      typeof navigator.canShare === "function" &&
      !navigator.canShare({
        files: [qrShareFile],
      })
    ) {
      setQrShareError(
        "This browser can share links, but not image files.",
      );
      return;
    }

    try {
      await navigator.share({
        files: [qrShareFile],
        title: "VINSS Invite",
        text: "VINSS Private Invite",
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);

      console.error(
        "[VINSS] QR image share failed",
        error,
      );

      setQrShareError(message);
    }
  };

  return (
    <article className="rounded-2xl border border-wire/55 bg-vault/15 p-3.5 sm:p-4">
      {groupMode && (
        <div>
          <p className="mb-2 font-display text-[8px] uppercase tracking-[0.14em] text-paper/25">
            Link duration
          </p>

          <div className="grid grid-cols-2 border border-wire">
            {(
              [
                "24h",
                "7d",
              ] as GroupInviteDuration[]
            ).map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() =>
                  onGroupDurationChange(
                    duration,
                  )
                }
                disabled={
                  disabled ||
                  Boolean(state.link)
                }
                className={
                  groupDuration ===
                  duration
                    ? "bg-signal px-3 py-2 font-display text-[8px] uppercase tracking-widest text-ink disabled:opacity-50"
                    : "px-3 py-2 font-display text-[8px] uppercase tracking-widest text-paper/35 transition hover:text-signal disabled:opacity-30"
                }
              >
                {duration === "24h"
                  ? "24 hours"
                  : "7 days"}
              </button>
            ))}
          </div>
        </div>
      )}

      {joined && (
        <div className={`${groupMode ? "mt-4" : ""} flex items-center gap-2 border border-signal/20 bg-signal/[0.035] px-3 py-2.5 text-xs text-signal/70`}>
          <span>✓</span>
          <span>
            {groupMode
              ? "Member joined this Group."
              : "Private Chat invite accepted."}
          </span>
        </div>
      )}

      {!state.link ? (
        <button
          type="button"
          onClick={() =>
            void onCreate()
          }
          disabled={disabled}
          className={`${groupMode || joined ? "mt-4" : ""} flex h-12 w-full items-center justify-center rounded-xl border border-signal/30 bg-signal/[0.045] px-4 font-display text-[9px] uppercase tracking-[0.15em] text-signal transition hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30`}
        >
          {groupMode
            ? "Create member invite →"
            : "Create invite →"}
        </button>
      ) : (
        <div className={groupMode ? "mt-5" : ""}>
          <div className="border border-signal/15 bg-signal/[0.025] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[8px] uppercase tracking-[0.15em] text-paper/30">
                One-time link
              </p>

              <span className="font-display text-[8px] uppercase tracking-widest text-signal/65">
                {state.pending
                  ? "Finalizing…"
                  : state.expired
                    ? "Expired"
                    : "✓ Ready"}
              </span>
            </div>

            <p
              className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-paper/45"
              title={state.link}
            >
              {state.link.length > 54
                ? `${state.link.slice(0, 34)}…${state.link.slice(-14)}`
                : state.link}
            </p>
          </div>

          <div className="relative mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                void onCopy()
              }
              disabled={
                disabled ||
                state.pending ||
                state.expired
              }
              className="h-10 border border-signal bg-signal px-3 font-display text-[9px] uppercase tracking-[0.14em] text-ink transition hover:bg-transparent hover:text-signal disabled:opacity-30"
            >
              {state.copied
                ? "✓ Copied"
                : "Copy link"}
            </button>

            <button
              type="button"
              onClick={() =>
                setShareOpen(
                  (value) => !value,
                )
              }
              disabled={
                disabled ||
                state.pending ||
                state.expired
              }
              aria-expanded={shareOpen}
              className="h-10 border border-wire px-3 font-display text-[9px] uppercase tracking-[0.14em] text-paper/50 transition hover:border-signal/40 hover:text-signal disabled:opacity-30"
            >
              Share
            </button>

            {shareOpen && (
              <div className="col-span-2 border border-wire bg-ink/95 p-2 shadow-xl backdrop-blur">
                <p className="px-2 pb-2 pt-1 font-display text-[8px] uppercase tracking-[0.14em] text-paper/25">
                  Share invite
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShareOpen(false);
                      void onShareTo(
                        "whatsapp",
                      );
                    }}
                    className="h-10 border border-wire px-3 font-display text-[8px] uppercase tracking-[0.12em] text-paper/55 transition hover:border-signal/40 hover:text-signal"
                  >
                    WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShareOpen(false);
                      void onShareTo(
                        "telegram",
                      );
                    }}
                    className="h-10 border border-wire px-3 font-display text-[8px] uppercase tracking-[0.12em] text-paper/55 transition hover:border-signal/40 hover:text-signal"
                  >
                    Telegram
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShareOpen(false);
                      void onShareTo("x");
                    }}
                    className="h-10 border border-wire px-3 font-display text-[8px] uppercase tracking-[0.12em] text-paper/55 transition hover:border-signal/40 hover:text-signal"
                  >
                    X
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShareOpen(false);
                      void onShare();
                    }}
                    className="h-10 border border-wire px-3 font-display text-[8px] uppercase tracking-[0.12em] text-paper/55 transition hover:border-signal/40 hover:text-signal"
                  >
                    More…
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShareOpen(false);
                      setQrOpen(true);
                    }}
                    className="col-span-2 h-10 border border-signal/30 px-3 font-display text-[8px] uppercase tracking-[0.12em] text-signal transition hover:bg-signal hover:text-ink"
                  >
                    Share QR
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-wire/60 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-paper/25">
                {state.expired
                  ? "Invite expired"
                  : `Expires in ${state.countdown}`}
              </span>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setQrOpen(true)
                  }
                  disabled={
                    disabled ||
                    state.pending ||
                    state.expired
                  }
                  aria-expanded={qrOpen}
                  className="font-display text-[8px] uppercase tracking-[0.12em] text-paper/30 transition hover:text-signal disabled:opacity-30"
                >
                  Show QR
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void onCreate()
                  }
                  disabled={disabled}
                  className="font-display text-[8px] uppercase tracking-[0.12em] text-paper/30 transition hover:text-signal disabled:opacity-30"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {qrOpen &&
              !state.pending &&
              !state.expired && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/85 px-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-label="VINSS invite QR code"
                  onClick={() =>
                    setQrOpen(false)
                  }
                >
                  <div
                    className="w-full max-w-sm rounded-2xl border border-wire bg-vault p-4 shadow-2xl"
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-display text-[9px] uppercase tracking-[0.16em] text-signal">
                          Invite QR
                        </p>

                        <p className="mt-1 text-[10px] text-paper/30">
                          Scan to open this one-time invite.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setQrOpen(false)
                        }
                        aria-label="Close QR"
                        className="flex h-9 w-9 items-center justify-center border border-wire text-lg text-paper/40 transition hover:border-signal/40 hover:text-signal"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-4 flex justify-center bg-paper p-5">
                      <QRCodeCanvas
                        value={state.link}
                        size={240}
                        level="M"
                        marginSize={1}
                        aria-label="VINSS invite QR code"
                      />

                      <QRCodeCanvas
                        ref={qrCanvasRef}
                        value={state.link}
                        size={768}
                        level="M"
                        marginSize={2}
                        aria-hidden="true"
                        className="fixed -left-[9999px] top-0"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void shareQr()
                        }
                        disabled={!qrShareFile}
                        className="col-span-2 h-11 border border-signal bg-signal px-3 font-display text-[9px] uppercase tracking-[0.14em] text-ink transition hover:bg-transparent hover:text-signal disabled:cursor-wait disabled:opacity-30"
                      >
                        {qrShareFile
                          ? "Share QR"
                          : "Preparing…"}
                      </button>

                      {qrShareError && (
                        <p className="col-span-2 px-2 text-center text-[9px] leading-relaxed text-paper/35">
                          {qrShareError}
                        </p>
                      )}
                    </div>

                    <p className="mt-3 text-center text-[9px] leading-relaxed text-paper/20">
                      One-time invite · expires in {state.countdown}
                    </p>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </article>
  );
}

interface InvitationPanelProps {
  scope: InviteScope;
  roomId: string;
  group: LocalRoomGroup | null;
  canInviteDirect: boolean;
  canInviteGroup: boolean;
  directInvite: InviteUiState;
  groupInvite: InviteUiState;
  joinedNoticeScope:
    | InviteScope
    | null;
  groupDuration: GroupInviteDuration;
  onGroupDurationChange: (
    value: GroupInviteDuration,
  ) => void;
  onCreate: (
    scope: InviteScope,
  ) => void | Promise<void>;
  onCopy: (
    scope: InviteScope,
  ) => void | Promise<void>;
  onShare: (
    scope: InviteScope,
  ) => void | Promise<void>;
  onShareTo: (
    scope: InviteScope,
    target: "whatsapp" | "telegram" | "x",
  ) => void | Promise<void>;
}

export function InvitationPanel({
  scope,
  roomId,
  group,
  canInviteDirect,
  canInviteGroup,
  directInvite,
  groupInvite,
  joinedNoticeScope,
  groupDuration,
  onGroupDurationChange,
  onCreate,
  onCopy,
  onShare,
  onShareTo,
}: InvitationPanelProps) {
  const groupMode =
    scope === "group";

  const backHref =
    groupMode && group
      ? `/room/${roomId}?group=${encodeURIComponent(
          group.id,
        )}`
      : `/room/${roomId}?message=chat`;

  return (
    <section
      className="mb-6"
      data-testid={
        groupMode
          ? "group-invite"
          : "chat-invite"
      }
    >
      <header className="pb-4">
        <div className="flex flex-col gap-3">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
              {groupMode
                ? "Group member invite"
                : "Private Chat invite"}
            </p>

            <h2 className="mt-2 text-xl leading-tight text-paper">
              {groupMode
                ? group
                  ? `Invite to ${group.name}`
                  : "Group unavailable"
                : "Invite to private chat"}
            </h2>

            <p className="mt-2 max-w-xl text-xs leading-relaxed text-paper/40">
              {groupMode
                ? group
                  ? `This one-time link grants access only to ${group.name}. It does not grant private Chat access.`
                  : "This Group is not available on this device."
                : "Create a one-time private link for one person. It expires after 1 hour."}
            </p>
          </div>

          <Link
            href={backHref}
            className="order-first w-fit font-display text-[8px] uppercase tracking-[0.13em] text-paper/30 transition hover:text-signal"
          >
            {groupMode
              ? "← Back to Group"
              : "← Back to Chat"}
          </Link>
        </div>
      </header>

      <div>
        {groupMode ? (
          group ? (
            <InviteCard
              scope="group"
              state={groupInvite}
              joined={
                joinedNoticeScope ===
                "group"
              }
              disabled={!canInviteGroup}
              groupDuration={
                groupDuration
              }
              onGroupDurationChange={
                onGroupDurationChange
              }
              onCreate={() =>
                onCreate("group")
              }
              onCopy={() =>
                onCopy("group")
              }
              onShare={() =>
                onShare("group")
              }
              onShareTo={(target) =>
                onShareTo(
                  "group",
                  target,
                )
              }
            />
          ) : (
            <div className="border border-dashed border-wire p-5">
              <p className="text-xs leading-relaxed text-paper/35">
                Return to Groups and open a Group before creating a member invitation.
              </p>
            </div>
          )
        ) : (
          <InviteCard
            scope="direct"
            state={directInvite}
            joined={
              joinedNoticeScope ===
              "direct"
            }
            disabled={!canInviteDirect}
            groupDuration={
              groupDuration
            }
            onGroupDurationChange={
              onGroupDurationChange
            }
            onCreate={() =>
              onCreate("direct")
            }
            onCopy={() =>
              onCopy("direct")
            }
            onShare={() =>
              onShare("direct")
            }
            onShareTo={(target) =>
              onShareTo(
                "direct",
                target,
              )
            }
          />
        )}

        <p className="mt-3 px-1 text-[9px] leading-relaxed text-paper/22">
          {groupMode
            ? "One-time access · scoped to this Group"
            : "One-time access · expires in 1 hour"}
        </p>
      </div>
    </section>
  );
}
