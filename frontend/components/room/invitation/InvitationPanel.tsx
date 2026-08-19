"use client";

import Link from "next/link";
import type {
  GroupInviteDuration,
  InviteScope,
} from "@/lib/deal-room/invitation";
import type { InviteUiState } from "@/hooks/room/useRoomInvitation";

interface InviteCardProps {
  scope: InviteScope;
  title: string;
  description: string;
  lifetime: string;
  state: InviteUiState;
  joined: boolean;
  groupDuration?: GroupInviteDuration;
  onGroupDurationChange?: (
    value: GroupInviteDuration,
  ) => void;
  onCreate: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
}

function InviteCard({
  scope,
  title,
  description,
  lifetime,
  state,
  joined,
  groupDuration,
  onGroupDurationChange,
  onCreate,
  onCopy,
  onShare,
}: InviteCardProps) {
  const label =
    scope === "direct"
      ? "Private Chat"
      : "Group";

  return (
    <article className="border border-wire bg-vault/20 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-[9px] uppercase tracking-[0.18em] text-signal/70">
            {label}
          </p>

          <h3 className="mt-2 text-base text-paper/85">
            {title}
          </h3>

          <p className="mt-2 max-w-md text-xs leading-relaxed text-paper/35">
            {description}
          </p>
        </div>

        <span className="shrink-0 border border-wire px-2 py-1 font-display text-[8px] uppercase tracking-widest text-paper/30">
          {lifetime}
        </span>
      </div>

      {scope === "group" &&
        groupDuration &&
        onGroupDurationChange && (
          <div className="mt-4">
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
                  disabled={Boolean(
                    state.link,
                  )}
                  className={
                    groupDuration ===
                    duration
                      ? "bg-signal px-3 py-2 font-display text-[8px] uppercase tracking-widest text-ink disabled:opacity-60"
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
        <div className="mt-4 flex items-center gap-2 border border-signal/20 bg-signal/[0.035] px-3 py-2.5 text-xs text-signal/70">
          <span>✓</span>
          <span>
            {scope === "direct"
              ? "Chat invite accepted."
              : "Group member joined."}
          </span>
        </div>
      )}

      {!state.link ? (
        <button
          type="button"
          onClick={() =>
            void onCreate()
          }
          className="mt-5 flex h-10 w-full items-center justify-center border border-signal/35 px-4 font-display text-[9px] uppercase tracking-[0.15em] text-signal transition hover:bg-signal hover:text-ink"
        >
          {scope === "direct"
            ? "Create Chat invite →"
            : "Create Group invite →"}
        </button>
      ) : (
        <div className="mt-5">
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

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                void onCopy()
              }
              disabled={
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
                void onShare()
              }
              disabled={
                state.pending ||
                state.expired
              }
              className="h-10 border border-wire px-3 font-display text-[9px] uppercase tracking-[0.14em] text-paper/50 transition hover:border-signal/40 hover:text-signal disabled:opacity-30"
            >
              Share
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-wire/60 pt-3">
            <span className="text-[10px] text-paper/25">
              {state.expired
                ? "Invite expired"
                : `Expires in ${state.countdown}`}
            </span>

            <button
              type="button"
              onClick={() =>
                void onCreate()
              }
              className="font-display text-[8px] uppercase tracking-[0.12em] text-paper/30 transition hover:text-signal"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

interface InvitationPanelProps {
  visible: boolean;
  roomId: string;
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
}

export function InvitationPanel({
  visible,
  roomId,
  directInvite,
  groupInvite,
  joinedNoticeScope,
  groupDuration,
  onGroupDurationChange,
  onCreate,
  onCopy,
  onShare,
}: InvitationPanelProps) {
  if (!visible) return null;

  return (
    <section
      className="mb-6 border border-signal/25 bg-signal/[0.02] p-5 sm:p-6"
      data-testid="access-details"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
            Invitations
          </p>

          <h2 className="mt-2 text-lg text-paper">
            Chat or Group
          </h2>

          <p className="mt-2 max-w-xl text-xs leading-relaxed text-paper/40">
            Create the link for the conversation you want to start. Chat links are short-lived; Group links can stay active longer.
          </p>
        </div>

        <Link
          href={`/room/${roomId}`}
          className="shrink-0 text-xs text-paper/35 transition hover:text-signal"
        >
          Close
        </Link>
      </div>

      <div className="mt-6 grid gap-3">
        <InviteCard
          scope="direct"
          title="Start a private 1-to-1"
          description="For one person you want to message, negotiate and exchange Offers with directly."
          lifetime="1 hour"
          state={directInvite}
          joined={
            joinedNoticeScope ===
            "direct"
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
        />

        <InviteCard
          scope="group"
          title="Invite a Group member"
          description="For someone joining the room-wide Group. Each link is still one-time, but it can remain valid much longer."
          lifetime={
            groupDuration === "24h"
              ? "24 hours"
              : "7 days"
          }
          state={groupInvite}
          joined={
            joinedNoticeScope ===
            "group"
          }
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
        />
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-paper/20">
        Both invitation types remain one-time and are validated on Starknet before entry.
      </p>
    </section>
  );
}
