"use client";

import { useState } from "react";
import { ConversationAvatarIcon } from "@/components/room/conversation/ConversationAvatarIcon";
import {
  isGroupAdmin,
  type LocalRoomGroup,
} from "@/lib/groups/localGroups";

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
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] =
    useState(false);

  function create() {
    const cleanName = name.trim();

    if (!cleanName) return;

    const group =
      onCreateGroup(cleanName);

    if (!group) return;

    setName("");
    setShowCreate(false);
    onOpenGroup(group.id);
  }

  return (
    <div className="border-x border-b border-wire bg-black/10">
      <div className="flex items-center justify-between gap-3 border-b border-wire/60 bg-vault/10 px-4 py-3">
        <p className="text-[10px] text-paper/30">
          {groups.length}{" "}
          {groups.length === 1
            ? "group"
            : "groups"}
        </p>

        <button
          type="button"
          onClick={() =>
            setShowCreate(
              (value) => !value,
            )
          }
          disabled={!connected}
          aria-expanded={showCreate}
          className="rounded-lg border border-signal/25 px-3 py-2 text-[10px] font-medium text-signal/75 transition hover:bg-signal/[0.06] hover:text-signal disabled:opacity-30"
        >
          {showCreate
            ? "Cancel"
            : "+ New group"}
        </button>
      </div>

      {showCreate && (
        <div className="border-b border-wire/60 bg-vault/20 p-4">
          <p className="mb-3 text-xs font-medium text-paper/65">
            New group
          </p>

          <div className="flex gap-2">
            <input
              autoFocus
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

                if (
                  event.key ===
                  "Escape"
                ) {
                  setName("");
                  setShowCreate(
                    false,
                  );
                }
              }}
              placeholder="Group name"
              disabled={!connected}
              className="h-10 min-w-0 flex-1 rounded-lg border border-wire bg-ink/40 px-3 text-sm text-paper outline-none placeholder:text-paper/20 focus:border-signal/40 disabled:opacity-35"
            />

            <button
              type="button"
              onClick={create}
              disabled={
                !connected ||
                !name.trim()
              }
              className="h-10 shrink-0 rounded-lg border border-signal/30 px-4 text-[10px] font-medium text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center px-8 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-signal/15 bg-signal/[0.04]">
            <span className="text-lg text-signal/65">
              +
            </span>
          </div>

          <h3 className="text-sm font-medium text-paper/65">
            No groups yet
          </h3>

          <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/30">
            Create a group to start
            a private group
            conversation.
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
                className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-signal/[0.035]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-signal/15 bg-signal/[0.045] text-signal/75">
                  <ConversationAvatarIcon seed={`group:${group.id}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-paper/75">
                      {group.name}
                    </p>

                    {admin && (
                      <span className="shrink-0 rounded border border-signal/20 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.12em] text-signal/55">
                        Admin
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[10px] text-paper/28">
                    {
                      group.members
                        .length
                    }{" "}
                    {group.members
                      .length === 1
                      ? "member"
                      : "members"}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="shrink-0 text-lg text-signal/40"
                >
                  ›
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
