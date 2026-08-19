"use client";

import Link from "next/link";
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
}: InviteCardProps) {
  const groupMode =
    scope === "group";

  return (
    <article className="border border-wire bg-vault/20 p-4 sm:p-5">
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
          className={`${groupMode || joined ? "mt-5" : ""} flex h-11 w-full items-center justify-center border border-signal/35 px-4 font-display text-[9px] uppercase tracking-[0.15em] text-signal transition hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30`}
        >
          {groupMode
            ? "Create member invite →"
            : "Create private Chat invite →"}
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

          <div className="mt-2 grid grid-cols-2 gap-2">
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
                void onShare()
              }
              disabled={
                disabled ||
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
              disabled={disabled}
              className="font-display text-[8px] uppercase tracking-[0.12em] text-paper/30 transition hover:text-signal disabled:opacity-30"
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
      className="mb-6 border border-signal/25 bg-signal/[0.02]"
      data-testid={
        groupMode
          ? "group-invite"
          : "chat-invite"
      }
    >
      <header className="border-b border-wire px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
              {groupMode
                ? "Group member invite"
                : "Private Chat invite"}
            </p>

            <h2 className="mt-2 text-lg text-paper">
              {groupMode
                ? group
                  ? `Invite to ${group.name}`
                  : "Group unavailable"
                : "Invite someone to private Chat"}
            </h2>

            <p className="mt-2 max-w-xl text-xs leading-relaxed text-paper/40">
              {groupMode
                ? group
                  ? `This one-time link grants access only to ${group.name}. It does not grant private Chat access.`
                  : "This Group is not available on this device."
                : "This one-time link grants private Chat access to one person. Group access is managed separately inside each Group."}
            </p>
          </div>

          <Link
            href={backHref}
            className="shrink-0 font-display text-[8px] uppercase tracking-[0.13em] text-paper/35 transition hover:text-signal"
          >
            {groupMode
              ? "← Back to Group"
              : "← Back to Chat"}
          </Link>
        </div>
      </header>

      <div className="p-5 sm:p-6">
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
          />
        )}

        <div className="mt-4 border-t border-wire/60 pt-4">
          <p className="text-[10px] leading-relaxed text-paper/25">
            {groupMode
              ? "Member invitations are one-time and scoped to this Group key."
              : "Private Chat invitations expire after 1 hour and are separate from Group membership."}
          </p>
        </div>
      </div>
    </section>
  );
}
