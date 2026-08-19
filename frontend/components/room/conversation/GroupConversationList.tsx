"use client";

import {
  useState,
} from "react";
import {
  isGroupAdmin,
  type LocalRoomGroup,
} from "@/lib/groups/localGroups";
import {
  shortAddress,
} from "@/components/room/conversation/chatFormat";

interface GroupConversationListProps {
  groups: LocalRoomGroup[];
  connected: boolean;
  walletAddress?: string;
  onCreateGroup: (
    name: string,
  ) => LocalRoomGroup | null;
  onOpenGroup: (
    groupId: string,
  ) => void;
}

export function GroupConversationList({
  groups,
  connected,
  walletAddress,
  onCreateGroup,
  onOpenGroup,
}: GroupConversationListProps) {
  const [name, setName] =
    useState("");

  function create() {
    const group =
      onCreateGroup(
        name.trim(),
      );

    if (!group) return;

    setName("");
    onOpenGroup(group.id);
  }

  return (
    <div className="border-x border-b border-wire bg-black/10">
      <div className="border-b border-wire bg-vault/20 p-4">
        <p className="font-display text-[9px] uppercase tracking-[0.16em] text-signal/70">
          Groups
        </p>

        <h3 className="mt-2 text-base text-paper/80">
          Create a Group
        </h3>

        <p className="mt-1.5 text-xs leading-relaxed text-paper/30">
          Groups are created by a user. The creator becomes the Group admin.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                create();
              }
            }}
            placeholder="Group name"
            disabled={!connected}
            className="h-10 min-w-0 flex-1 border border-wire bg-ink/40 px-3 text-sm text-paper outline-none placeholder:text-paper/20 focus:border-signal/50 disabled:opacity-35"
          />

          <button
            type="button"
            onClick={create}
            disabled={
              !connected ||
              !name.trim()
            }
            className="h-10 shrink-0 border border-signal/35 px-4 font-display text-[9px] uppercase tracking-[0.14em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
          >
            Create
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
            <span className="text-base text-signal">
              +
            </span>
          </div>

          <h3 className="font-display text-sm text-paper/70">
            No Groups yet
          </h3>

          <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
            Create one here, then invite members from inside that Group.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-wire/60">
          {groups.map((group) => {
            const admin =
              isGroupAdmin(
                group,
                walletAddress,
              );

            return (
              <button
                key={group.id}
                type="button"
                onClick={() =>
                  onOpenGroup(
                    group.id,
                  )
                }
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-signal/[0.035]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-paper/75">
                      {group.name}
                    </p>

                    <span
                      className={
                        admin
                          ? "shrink-0 border border-signal/20 px-1.5 py-0.5 font-display text-[7px] uppercase tracking-[0.12em] text-signal/60"
                          : "shrink-0 border border-wire px-1.5 py-0.5 font-display text-[7px] uppercase tracking-[0.12em] text-paper/25"
                      }
                    >
                      {admin
                        ? "Admin"
                        : "Member"}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] text-paper/25">
                    {group.members.length} member
                    {group.members.length === 1
                      ? ""
                      : "s"}
                    {" · "}
                    admin{" "}
                    {shortAddress(
                      group.ownerAddress,
                    )}
                  </p>
                </div>

                <span className="shrink-0 text-sm text-signal/50">
                  →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
