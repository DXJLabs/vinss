"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BACKEND_URL } from "@/lib/starknet/constants";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import {
  deriveGroupKeyFromSecret,
} from "@/lib/privacy/channelKey";
import {
  pollPresence,
  publishPresence,
} from "@/lib/privacy/presence";
import {
  addOrUpdateGroupMember,
  createLocalGroup,
  isGroupAdmin,
  loadLocalGroups,
  saveLocalGroups,
  type LocalRoomGroup,
} from "@/lib/groups/localGroups";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";

interface UseRoomGroupsOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  selectedGroupId: string | null;
  active: boolean;
  setError: (
    value: string | null,
  ) => void;
}

export function useRoomGroups({
  roomId,
  session,
  selectedGroupId,
  active,
  setError,
}: UseRoomGroupsOptions) {
  const [groups, setGroups] =
    useState<LocalRoomGroup[]>([]);

  const [
    selectedGroupKey,
    setSelectedGroupKey,
  ] =
    useState<Uint8Array | null>(
      null,
    );

  const lastPublishRef =
    useRef<Record<string, number>>(
      {},
    );

  useEffect(() => {
    if (!roomId) {
      setGroups([]);
      return;
    }

    setGroups(
      loadLocalGroups(roomId),
    );
  }, [roomId]);

  const selectedGroup =
    useMemo(
      () =>
        selectedGroupId
          ? groups.find(
              (group) =>
                group.id ===
                selectedGroupId,
            ) ?? null
          : null,
      [
        selectedGroupId,
        groups,
      ],
    );

  useEffect(() => {
    let cancelled = false;

    setSelectedGroupKey(null);

    if (!selectedGroup) {
      return;
    }

    deriveGroupKeyFromSecret(
      selectedGroup.groupSecret,
    )
      .then((key) => {
        if (!cancelled) {
          setSelectedGroupKey(
            key,
          );
        }
      })
      .catch((err) => {
        console.error(
          "[VINSS GROUP KEY ERROR]",
          err,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedGroup?.id,
    selectedGroup?.groupSecret,
  ]);

  function commitGroups(
    next:
      | LocalRoomGroup[]
      | ((
          current: LocalRoomGroup[],
        ) => LocalRoomGroup[]),
  ) {
    if (!roomId) return;

    setGroups((current) => {
      const resolved =
        typeof next === "function"
          ? next(current)
          : next;

      saveLocalGroups(
        roomId,
        resolved,
      );

      return resolved;
    });
  }

  function createGroup(
    name: string,
  ): LocalRoomGroup | null {
    if (!roomId) return null;

    if (!session) {
      setError(
        "Connect your wallet before creating a Group.",
      );
      return null;
    }

    if (!name.trim()) {
      return null;
    }

    const group =
      createLocalGroup(
        roomId,
        name.trim(),
        session.account.address,
      );

    commitGroups((current) => [
      group,
      ...current,
    ]);

    return group;
  }

  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !session ||
      groups.length === 0
    ) {
      return;
    }

    let stopped = false;
    let running = false;

    const syncGroups =
      async () => {
        if (
          stopped ||
          running
        ) {
          return;
        }

        running = true;

        try {
          const updates =
            await Promise.all(
              groups.map(
                async (group) => {
                  const selfMember =
                    group.members.find(
                      (member) =>
                        sameStarknetAddress(
                          member.address,
                          session.account
                            .address,
                        ),
                    );

                  if (!selfMember) {
                    return group;
                  }

                  try {
                    const key =
                      await deriveGroupKeyFromSecret(
                        group.groupSecret,
                      );

                    const lastPublished =
                      lastPublishRef.current[
                        group.id
                      ] ?? 0;

                    if (
                      Date.now() -
                        lastPublished >
                      60_000
                    ) {
                      await publishPresence(
                        BACKEND_URL,
                        key,
                        {
                          version: 1,
                          type: "group_member",
                          senderAddress:
                            session.account
                              .address,
                          sentAt:
                            new Date().toISOString(),
                          groupId:
                            group.id,
                          role:
                            isGroupAdmin(
                              group,
                              session.account
                                .address,
                            )
                              ? "admin"
                              : "member",
                        },
                        24 *
                          60 *
                          60 *
                          1000,
                      );

                      lastPublishRef.current[
                        group.id
                      ] = Date.now();
                    }

                    const events =
                      await pollPresence(
                        BACKEND_URL,
                        key,
                      );

                    let next =
                      group;

                    for (
                      const event of events
                    ) {
                      if (
                        event.type !==
                          "group_member" ||
                        event.groupId !==
                          group.id
                      ) {
                        continue;
                      }

                      next =
                        addOrUpdateGroupMember(
                          next,
                          {
                            address:
                              event.senderAddress,
                            role:
                              sameStarknetAddress(
                                event.senderAddress,
                                group.ownerAddress,
                              )
                                ? "admin"
                                : "member",
                            joinedAt:
                              event.sentAt,
                          },
                        );
                    }

                    return next;
                  } catch (err) {
                    console.error(
                      "[VINSS GROUP MEMBERSHIP SYNC ERROR]",
                      err,
                    );

                    return group;
                  }
                },
              ),
            );

          if (!stopped) {
            const changed =
              JSON.stringify(
                updates,
              ) !==
              JSON.stringify(
                groups,
              );

            if (changed) {
              commitGroups(
                updates,
              );
            }
          }
        } finally {
          running = false;
        }
      };

    void syncGroups();

    const timer =
      window.setInterval(
        () => {
          void syncGroups();
        },
        5000,
      );

    const onVisible = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void syncGroups();
      }
    };

    window.addEventListener(
      "focus",
      syncGroups,
    );

    document.addEventListener(
      "visibilitychange",
      onVisible,
    );

    return () => {
      stopped = true;
      window.clearInterval(
        timer,
      );
      window.removeEventListener(
        "focus",
        syncGroups,
      );
      document.removeEventListener(
        "visibilitychange",
        onVisible,
      );
    };
  }, [
    active,
    roomId,
    session?.account.address,
    groups
      .map(
        (group) =>
          `${group.id}:${group.groupSecret}:${group.members.length}`,
      )
      .join("|"),
  ]);

  return {
    groups,
    selectedGroup,
    selectedGroupKey,
    createGroup,
    isSelectedGroupAdmin:
      Boolean(
        selectedGroup &&
          isGroupAdmin(
            selectedGroup,
            session?.account.address,
          ),
      ),
  };
}
