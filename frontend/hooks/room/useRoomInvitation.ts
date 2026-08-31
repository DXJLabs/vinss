"use client";

import {
  useEffect,
  useState,
} from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import {
  createInviteToken,
  getInviteOnchainState,
  type GroupInviteDuration,
  type InviteScope,
} from "@/lib/deal-room/invitation";
import {
  isGroupAdmin,
  type LocalRoomGroup,
} from "@/lib/groups/localGroups";

interface RoomInvitationContext {
  id: string;
  label: string;
  roomSecret: string;
}

interface UseRoomInvitationOptions {
  room: RoomInvitationContext | null;
  group: LocalRoomGroup | null;
  session: VinssWalletSession | null;
  setError: (
    value: string | null,
  ) => void;
}

export interface InviteUiState {
  link: string | null;
  expiresAt: string | null;
  commitment: string | null;
  pending: boolean;
  copied: boolean;
  expired: boolean;
  countdown: string;
}

interface StoredInvite {
  link?: string;
  expiresAt?: string;
  commitment?: string;
  status?: "pending" | "ready";
}

interface MutableInviteState {
  link: string | null;
  expiresAt: string | null;
  commitment: string | null;
  pending: boolean;
  copied: boolean;
}

const EMPTY_INVITE: MutableInviteState = {
  link: null,
  expiresAt: null,
  commitment: null,
  pending: false,
  copied: false,
};

function inviteStorageKey(
  roomId: string,
  scope: InviteScope,
  groupId?: string | null,
): string {
  if (scope === "group") {
    return (
      `vinss:invite:v3:${roomId}:group:` +
      (groupId ?? "none")
    );
  }

  return `vinss:invite:v3:${roomId}:direct`;
}

function formatCountdown(
  expiresAt: string | null,
  now: number,
): {
  expired: boolean;
  countdown: string;
} {
  if (!expiresAt) {
    return {
      expired: false,
      countdown: "",
    };
  }

  const remainingMs =
    Math.max(
      0,
      Date.parse(expiresAt) -
        now,
    );

  if (remainingMs <= 0) {
    return {
      expired: true,
      countdown: "Expired",
    };
  }

  const totalMinutes =
    Math.ceil(
      remainingMs / 60_000,
    );

  if (totalMinutes >= 24 * 60) {
    const days =
      Math.floor(
        totalMinutes / (24 * 60),
      );

    const hours =
      Math.floor(
        (totalMinutes %
          (24 * 60)) /
          60,
      );

    return {
      expired: false,
      countdown:
        `${days}d ${hours}h`,
    };
  }

  if (totalMinutes >= 60) {
    const hours =
      Math.floor(
        totalMinutes / 60,
      );

    const minutes =
      totalMinutes % 60;

    return {
      expired: false,
      countdown:
        `${hours}h ${minutes}m`,
    };
  }

  const totalSeconds =
    Math.ceil(
      remainingMs / 1000,
    );

  const minutes =
    Math.floor(
      totalSeconds / 60,
    );

  const seconds =
    totalSeconds % 60;

  return {
    expired: false,
    countdown:
      `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`,
  };
}

export function useRoomInvitation({
  room,
  group,
  session,
  setError,
}: UseRoomInvitationOptions) {
  const [
    invites,
    setInvites,
  ] = useState<
    Record<
      InviteScope,
      MutableInviteState
    >
  >({
    direct: {
      ...EMPTY_INVITE,
    },
    group: {
      ...EMPTY_INVITE,
    },
  });

  const [
    groupDuration,
    setGroupDuration,
  ] = useState<GroupInviteDuration>(
    "24h",
  );

  const [
    joinedNoticeScope,
    setJoinedNoticeScope,
  ] =
    useState<InviteScope | null>(
      null,
    );

  const [now, setNow] =
    useState(Date.now());

  function updateInvite(
    scope: InviteScope,
    patch: Partial<MutableInviteState>,
  ) {
    setInvites((previous) => ({
      ...previous,
      [scope]: {
        ...previous[scope],
        ...patch,
      },
    }));
  }

  function clearInvite(
    scope: InviteScope,
  ) {
    setInvites((previous) => ({
      ...previous,
      [scope]: {
        ...EMPTY_INVITE,
      },
    }));
  }

  useEffect(() => {
    if (!room) {
      setInvites({
        direct: {
          ...EMPTY_INVITE,
        },
        group: {
          ...EMPTY_INVITE,
        },
      });
      return;
    }

    const restored: Record<
      InviteScope,
      MutableInviteState
    > = {
      direct: {
        ...EMPTY_INVITE,
      },
      group: {
        ...EMPTY_INVITE,
      },
    };

    for (const scope of [
      "direct",
      "group",
    ] as const) {
      if (
        scope === "group" &&
        !group
      ) {
        continue;
      }

      const key =
        inviteStorageKey(
          room.id,
          scope,
          scope === "group"
            ? group?.id
            : undefined,
        );

      try {
        const raw =
          window.localStorage.getItem(
            key,
          );

        if (!raw) continue;

        const saved =
          JSON.parse(
            raw,
          ) as StoredInvite;

        if (
          saved.link &&
          saved.expiresAt &&
          Date.parse(
            saved.expiresAt,
          ) > Date.now()
        ) {
          restored[scope] = {
            link: saved.link,
            expiresAt:
              saved.expiresAt,
            commitment:
              saved.commitment ??
              null,
            pending:
              saved.status ===
              "pending",
            copied: false,
          };
        } else {
          window.localStorage.removeItem(
            key,
          );
        }
      } catch {
        window.localStorage.removeItem(
          key,
        );
      }
    }

    setInvites(restored);
    setNow(Date.now());
  }, [
    room?.id,
    group?.id,
  ]);

  const directTiming =
    formatCountdown(
      invites.direct.expiresAt,
      now,
    );

  const groupTiming =
    formatCountdown(
      invites.group.expiresAt,
      now,
    );

  useEffect(() => {
    if (
      !invites.direct.expiresAt &&
      !invites.group.expiresAt
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setNow(Date.now());
      }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    invites.direct.expiresAt,
    invites.group.expiresAt,
  ]);

  async function createInviteLink(
    scope: InviteScope,
  ) {
    if (!room) return;

    setError(null);

    if (!session) {
      setError(
        "Connect your wallet before creating an invite.",
      );
      return;
    }

    if (
      scope === "direct" &&
      !room.roomSecret
    ) {
      setError(
        "This device joined through a Group invite. A private Chat invite requires direct room access.",
      );
      return;
    }

    if (scope === "group") {
      if (!group) {
        setError(
          "Create or open a Group before inviting members.",
        );
        return;
      }

      if (
        !isGroupAdmin(
          group,
          session.account.address,
        )
      ) {
        setError(
          "Only the Group admin can create member invitations.",
        );
        return;
      }
    }

    clearInvite(scope);
    setJoinedNoticeScope(null);
    setNow(Date.now());

    const storageKey =
      inviteStorageKey(
        room.id,
        scope,
        scope === "group"
          ? group?.id
          : undefined,
      );

    window.localStorage.removeItem(
      storageKey,
    );

    let preparedLink:
      | string
      | null = null;

    let preparedCommitment:
      | string
      | null = null;

    let preparedExpiresAt:
      | string
      | null = null;

    try {
      const invite =
        await createInviteToken(
          session.account,
          {
            roomId: room.id,
            roomSecret:
              room.roomSecret,
            label: room.label,
            scope,
            groupDuration:
              scope === "group"
                ? groupDuration
                : undefined,
            groupId:
              scope === "group"
                ? group?.id
                : undefined,
            groupName:
              scope === "group"
                ? group?.name
                : undefined,
            groupSecret:
              scope === "group"
                ? group?.groupSecret
                : undefined,
            groupOwnerAddress:
              scope === "group"
                ? group?.ownerAddress
                : undefined,
          },
          (prepared) => {
            // Persist before Ready X opens so mobile backgrounding is recoverable.
            const link =
              `${window.location.origin}/invite/${prepared.token}` +
              `#k=${prepared.key}`;

            preparedLink = link;
            preparedCommitment =
              prepared.commitment;
            preparedExpiresAt =
              prepared.expiresAt;

            updateInvite(
              scope,
              {
                link,
                expiresAt:
                  prepared.expiresAt,
                commitment:
                  prepared.commitment,
                pending: true,
                copied: false,
              },
            );

            setNow(Date.now());

            window.localStorage.setItem(
              storageKey,
              JSON.stringify({
                link,
                expiresAt:
                  prepared.expiresAt,
                commitment:
                  prepared.commitment,
                status: "pending",
              } satisfies StoredInvite),
            );
          },
        );

      const link =
        preparedLink ??
        `${window.location.origin}/invite/${invite.token}` +
          `#k=${invite.key}`;

      updateInvite(scope, {
        link,
        expiresAt:
          invite.expiresAt,
        commitment:
          invite.commitment,
        pending: false,
        copied: false,
      });

      setNow(Date.now());

      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          link,
          expiresAt:
            invite.expiresAt,
          commitment:
            invite.commitment,
          status: "ready",
        } satisfies StoredInvite),
      );
    } catch (err) {
      console.error(
        `[VINSS ${scope.toUpperCase()} INVITE CREATE]`,
        err,
      );

      if (
        preparedCommitment &&
        preparedLink &&
        preparedExpiresAt
      ) {
        try {
          const state =
            await getInviteOnchainState(
              preparedCommitment,
            );

          if (state.exists) {
            updateInvite(
              scope,
              {
                link:
                  preparedLink,
                expiresAt:
                  preparedExpiresAt,
                commitment:
                  preparedCommitment,
                pending: false,
                copied: false,
              },
            );

            window.localStorage.setItem(
              storageKey,
              JSON.stringify({
                link:
                  preparedLink,
                expiresAt:
                  preparedExpiresAt,
                commitment:
                  preparedCommitment,
                status: "ready",
              } satisfies StoredInvite),
            );

            return;
          }
        } catch {
          // Fall through to the safe UI error.
        }
      }

      clearInvite(scope);

      window.localStorage.removeItem(
        storageKey,
      );

      setError(
        scope === "direct"
          ? "Could not create the private Chat invitation."
          : "Could not create the Group invitation.",
      );
    }
  }

  useEffect(() => {
    if (!room) return;

    if (
      !invites.direct.commitment &&
      !invites.group.commitment
    ) {
      return;
    }

    let cancelled = false;

    const checkInvites =
      async () => {
        for (const scope of [
          "direct",
          "group",
        ] as const) {
          const invite =
            invites[scope];

          if (
            !invite.commitment ||
            !invite.expiresAt ||
            Date.parse(
              invite.expiresAt,
            ) <= Date.now()
          ) {
            continue;
          }

          try {
            const state =
              await getInviteOnchainState(
                invite.commitment,
              );

            if (
              cancelled ||
              !state.exists
            ) {
              continue;
            }

            if (state.consumed) {
              clearInvite(scope);

              window.localStorage.removeItem(
                inviteStorageKey(
                  room.id,
                  scope,
                  scope === "group"
                    ? group?.id
                    : undefined,
                ),
              );

              setJoinedNoticeScope(
                scope,
              );

              continue;
            }

            if (invite.pending) {
              updateInvite(
                scope,
                {
                  pending: false,
                },
              );

              const key =
                inviteStorageKey(
                  room.id,
                  scope,
                  scope === "group"
                    ? group?.id
                    : undefined,
                );

              try {
                const raw =
                  window.localStorage.getItem(
                    key,
                  );

                const saved =
                  raw
                    ? (JSON.parse(
                        raw,
                      ) as StoredInvite)
                    : {};

                window.localStorage.setItem(
                  key,
                  JSON.stringify({
                    ...saved,
                    status: "ready",
                  } satisfies StoredInvite),
                );
              } catch {
                // Local recovery metadata is only a UX optimization.
              }
            }
          } catch {
            // Poll failures do not invalidate an otherwise usable invite.
          }
        }
      };

    void checkInvites();

    const timer =
      window.setInterval(() => {
        void checkInvites();
      }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    room?.id,
    group?.id,
    invites.direct.commitment,
    invites.direct.expiresAt,
    invites.direct.pending,
    invites.group.commitment,
    invites.group.expiresAt,
    invites.group.pending,
  ]);

  useEffect(() => {
    if (!joinedNoticeScope) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setJoinedNoticeScope(
          null,
        );
      }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [joinedNoticeScope]);

  async function copyInviteLink(
    scope: InviteScope,
  ) {
    const link =
      invites[scope].link;

    if (!link) return;

    try {
      await navigator.clipboard.writeText(
        link,
      );

      updateInvite(
        scope,
        {
          copied: true,
        },
      );
    } catch (err) {
      console.error(
        `[VINSS ${scope.toUpperCase()} INVITE COPY]`,
        err,
      );

      setError(
        "Could not copy the invite link.",
      );
    }
  }

  async function shareInviteLink(
    scope: InviteScope,
  ) {
    const link =
      invites[scope].link;

    if (!link) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title:
            scope === "direct"
              ? `VINSS Chat — ${room?.label ?? "Private room"}`
              : `VINSS Group — ${group?.name ?? "Private Group"}`,
          text:
            scope === "direct"
              ? "You're invited to a private VINSS chat."
              : `You're invited to the VINSS Group ${group?.name ?? ""}.`,
          url: link,
        });

        return;
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }

        console.warn(
          `[VINSS ${scope.toUpperCase()} INVITE SHARE] native share failed; copying instead`,
          err,
        );
      }
    }

    await copyInviteLink(scope);
  }

  const directInvite: InviteUiState = {
    ...invites.direct,
    expired:
      directTiming.expired,
    countdown:
      directTiming.countdown,
  };

  const groupInvite: InviteUiState = {
    ...invites.group,
    expired:
      groupTiming.expired,
    countdown:
      groupTiming.countdown,
  };

  return {
    directInvite,
    groupInvite,
    joinedNoticeScope,
    groupDuration,
    setGroupDuration,
    createInviteLink,
    copyInviteLink,
    shareInviteLink,
  };
}
