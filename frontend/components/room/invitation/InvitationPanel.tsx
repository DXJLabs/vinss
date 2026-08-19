"use client";

import Link from "next/link";

interface InvitationPanelProps {
  visible: boolean;
  roomId: string;
  joinedNotice: boolean;
  inviteLink: string | null;
  pending: boolean;
  copied: boolean;
  expired: boolean;
  countdown: string;
  onCreate: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
}

export function InvitationPanel({
  visible,
  roomId,
  joinedNotice,
  inviteLink,
  pending,
  copied,
  expired,
  countdown,
  onCreate,
  onCopy,
  onShare,
}: InvitationPanelProps) {
  if (!visible) return null;

  return (
    <section
      className="mb-6 border border-signal/25 bg-signal/[0.025] p-5 sm:p-6"
      data-testid="access-details"
    >
      {joinedNotice ? (
        <div className="flex min-h-[130px] flex-col items-center justify-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-signal/30 bg-signal/10 text-lg text-signal">
            ✓
          </div>

          <p className="mt-4 font-display text-[10px] uppercase tracking-[0.22em] text-signal">
            Counterparty joined
          </p>

          <h2 className="mt-2 text-lg text-paper">
            Private room is ready.
          </h2>

          <p className="mt-2 text-xs text-paper/35">
            Invitation completed successfully.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
                {inviteLink ? "Invitation ready" : "Private invitation"}
              </p>

              <h2 className="mt-2 text-lg text-paper">
                {inviteLink ? "Private link created" : "Invite your counterparty"}
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-relaxed text-paper/40">
                {inviteLink
                  ? "Share this private link with your counterparty. VINSS will detect when they join the room."
                  : "Create one private link. Your counterparty can open it and join this room without entering credentials manually."}
              </p>
            </div>

            <Link
              href={`/room/${roomId}`}
              className="shrink-0 text-xs text-paper/35 transition hover:text-signal"
            >
              Close
            </Link>
          </div>

          {!inviteLink ? (
            <button
              type="button"
              onClick={() => void onCreate()}
              className="mt-6 flex h-11 w-full items-center justify-center border border-signal bg-signal px-4 font-display text-xs uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal sm:w-auto"
            >
              Create invite link →
            </button>
          ) : (
            <div className="mt-6">
              <div className="border border-signal/20 bg-signal/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-[9px] uppercase tracking-[0.18em] text-signal">
                    Private invite link
                  </p>

                  <span className="font-display text-[9px] uppercase tracking-widest text-signal/70">
                    ✓ Ready
                  </span>
                </div>

                <p
                  className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-paper/55"
                  title={inviteLink}
                >
                  {inviteLink.length > 58
                    ? `${inviteLink.slice(0, 38)}…${inviteLink.slice(-16)}`
                    : inviteLink}
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  disabled={pending}
                  className="flex h-10 flex-1 items-center justify-center border border-signal bg-signal px-4 font-display text-[10px] uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal"
                >
                  {pending ? "Finalizing..." : copied ? "✓ Copied" : "Copy private link"}
                </button>

                <button
                  type="button"
                  onClick={() => void onShare()}
                  disabled={pending}
                  className="flex h-10 flex-1 items-center justify-center border border-wire px-4 font-display text-[10px] uppercase tracking-[0.16em] text-paper/60 transition hover:border-paper/40 hover:text-paper"
                >
                  Share
                </button>
              </div>

              <div className="mt-4 border-t border-wire/60 pt-4">
                {!expired && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
                    <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/45">
                      {pending
                        ? "Finalizing invitation..."
                        : "Waiting for counterparty..."}
                    </p>
                  </div>
                )}

                <p className="mt-3 text-[10px] uppercase tracking-widest text-paper/30">
                  {expired ? "Invite expired" : `Expires in ${countdown}`}
                </p>

                <button
                  type="button"
                  onClick={() => void onCreate()}
                  className="mt-3 text-[10px] text-paper/30 transition hover:text-signal"
                >
                  {expired
                    ? "Generate new private link →"
                    : "Regenerate invitation"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
