"use client";
import { accountForMode, parseTransactionMode, transactionModeOf, type TransactionMode } from "@/lib/starknet/transactionMode";
import { publicInviteConsumedBy } from "@/lib/starknet/publicInvite";
import { PUBLIC_RAIL_ADDRESS } from "@/lib/starknet/constants";

import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  decodeInviteToken,
  consumeInviteOnchain,
  getInviteOnchainStateForSecret,
  type InvitePayload,
  type InviteScope,
} from "@/lib/deal-room/invitation";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";
import { useWallet } from "@/components/providers/WalletProvider";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import {
  upsertLocalGroup,
  type LocalRoomGroup,
} from "@/lib/groups/localGroups";

interface LocalRoom {
  id: string;
  label: string;
  roomSecret: string;
  createdAt: string;
  joinedVia?: InviteScope;
  transactionMode?: TransactionMode;
}

const ROOM_STORAGE_KEY =
  "vinss:local-rooms";

const CONSUMED_STORAGE_KEY =
  "vinss:consumed-invites:v2";

function loadConsumedInviteIds(): string[] {
  try {
    const raw =
      window.localStorage.getItem(
        CONSUMED_STORAGE_KEY,
      );

    return raw
      ? (JSON.parse(
          raw,
        ) as string[])
      : [];
  } catch {
    return [];
  }
}

function markInviteConsumed(
  inviteId: string,
) {
  const existing =
    loadConsumedInviteIds();

  const next = [
    inviteId,
    ...existing.filter(
      (id) => id !== inviteId,
    ),
  ].slice(0, 100);

  window.localStorage.setItem(
    CONSUMED_STORAGE_KEY,
    JSON.stringify(next),
  );
}


const CONSUME_RECOVERY_PREFIX =
  "vinss:invite-consume:v1:";

interface PendingInviteConsume {
  inviteId: string;
  roomId: string;
  walletAddress: string;
  startedAt: number;
}

type InviteConsumeAccount =
  Parameters<typeof consumeInviteOnchain>[0];

function recoveryKey(inviteId: string) {
  return CONSUME_RECOVERY_PREFIX + inviteId;
}

function loadRecovery(
  invite: InvitePayload,
  walletAddress: string,
): PendingInviteConsume | null {
  try {
    const raw =
      window.localStorage.getItem(
        recoveryKey(invite.inviteId),
      );

    if (!raw) return null;

    const saved =
      JSON.parse(raw) as PendingInviteConsume;

    const structurallyValid =
      saved.inviteId === invite.inviteId &&
      saved.roomId === invite.roomId &&
      Date.now() - saved.startedAt <=
        60 * 60 * 1000;

    if (!structurallyValid) {
      window.localStorage.removeItem(
        recoveryKey(invite.inviteId),
      );
      return null;
    }

    if (
      !sameStarknetAddress(
        saved.walletAddress,
        walletAddress,
      )
    ) {
      return null;
    }

    return saved;
  } catch {
    return null;
  }
}

function saveRecovery(
  invite: InvitePayload,
  walletAddress: string,
) {
  window.localStorage.setItem(
    recoveryKey(invite.inviteId),
    JSON.stringify({
      inviteId: invite.inviteId,
      roomId: invite.roomId,
      walletAddress,
      startedAt: Date.now(),
    } satisfies PendingInviteConsume),
  );
}

function clearRecovery(inviteId: string) {
  window.localStorage.removeItem(
    recoveryKey(inviteId),
  );
}

async function waitConsumed(
  onchainSecret: string,
  account: InviteConsumeAccount,
  publicCommitment?: string,
  attempts = 10,
) {
  for (let i = 0; i < attempts; i++) {
    try {
      const state =
        await getInviteOnchainStateForSecret(
          onchainSecret,
          account,
          publicCommitment,
        );

      if (state.exists && state.consumed) {
        return transactionModeOf(account) === "unshield" ? publicInviteConsumedBy(publicCommitment ?? "", account.address) : true;
      }
    } catch {}

    if (i + 1 < attempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1500),
      );
    }
  }

  return false;
}

async function ensureInviteConsumed(
  account: InviteConsumeAccount,
  invite: InvitePayload,
) {
  const mode = parseTransactionMode(invite.transactionMode);
  if (mode === "unshield" && (!invite.publicRailAddress || BigInt(invite.publicRailAddress) !== BigInt(PUBLIC_RAIL_ADDRESS || "0"))) {
    throw new Error("This Unshield invitation belongs to a different or unconfigured public deployment.");
  }
  const storedRooms = JSON.parse(window.localStorage.getItem(ROOM_STORAGE_KEY) ?? "[]") as LocalRoom[];
  const existing = storedRooms.find(room => room.id === invite.roomId);
  const lockedMode = window.localStorage.getItem(`vinss:rail-lock:${invite.roomId}`);
  if ((lockedMode && lockedMode !== mode) || (existing && parseTransactionMode(existing.transactionMode) !== mode)) {
    throw new Error("This device already has this room on another transaction rail. Its existing deals cannot be switched by an invitation.");
  }
  account = accountForMode(account, mode, invite.roomId);
  const pending =
    loadRecovery(
      invite,
      account.address,
    );

  let state = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const candidate =
        await getInviteOnchainStateForSecret(
          invite.onchainSecret,
          account,
          invite.publicInviteCommitment,
        );

      if (candidate.exists) {
        state = candidate;
        break;
      }
    } catch {}

    if (attempt < 5) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000),
      );
    }
  }

  if (!state) {
    throw new Error("INVITE_NOT_FOUND");
  }

  if (state.consumed) {
    if (mode === "unshield") {
      if (await publicInviteConsumedBy(invite.publicInviteCommitment ?? "", account.address)) return;
      throw new Error("INVITE_ALREADY_CONSUMED_BY_ANOTHER_WALLET");
    }
    if (pending) return;

    throw new Error(
      "INVITE_ALREADY_CONSUMED",
    );
  }

  if (!pending) {
    saveRecovery(
      invite,
      account.address,
    );
  }

  try {
    await consumeInviteOnchain(
      account,
      invite.onchainSecret,
      invite.publicInviteCommitment,
    );
  } catch (error) {
    if (
      await waitConsumed(
        invite.onchainSecret,
        account,
        invite.publicInviteCommitment,
      )
    ) {
      return;
    }

    clearRecovery(invite.inviteId);
    throw error;
  }
}

export default function InvitePage() {
  const params =
    useParams<{
      token: string;
    }>();

  const router =
    useRouter();

  const { session } =
    useWallet();

  const attempted =
    useRef(false);

  const [
    invite,
    setInvite,
  ] =
    useState<InvitePayload | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token =
        params.token;

      if (!token) {
        setError(
          "Invalid invitation.",
        );
        return;
      }

      const fragment =
        new URLSearchParams(
          window.location.hash.replace(
            /^#/,
            "",
          ),
        );

      const inviteKey =
        fragment.get("k");

      // Keep #k until consume succeeds so Ready X remounts can recover.
      if (!inviteKey) {
        setError(
          "This invitation is missing its private access key.",
        );
        return;
      }

      const decoded =
        await decodeInviteToken(
          token,
          inviteKey,
        );

      if (cancelled) return;

      if (!decoded) {
        setError(
          "This invitation is invalid, corrupted, or expired.",
        );
        return;
      }

      if (
        loadConsumedInviteIds().includes(
          decoded.inviteId,
        )
      ) {
        setError(
          "This invitation has already been used on this device.",
        );
        return;
      }

      setInvite(decoded);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.token]);

  useEffect(() => {
    if (
      !invite ||
      !session ||
      attempted.current
    ) {
      return;
    }

    attempted.current = true;

    void (async () => {
      try {
        await ensureInviteConsumed(
          session.account,
          invite,
        );

        const room: LocalRoom = {
          id: invite.roomId,
          label:
            invite.label ||
            "Joined room",
          roomSecret:
            invite.roomSecret ?? "",
          createdAt:
            new Date().toISOString(),
          joinedVia:
            invite.scope,
          transactionMode: parseTransactionMode(invite.transactionMode),
        };

        window.localStorage.setItem(`vinss:rail-lock:${invite.roomId}`, parseTransactionMode(invite.transactionMode));
        const raw =
          window.localStorage.getItem(
            ROOM_STORAGE_KEY,
          );

        const rooms = raw
          ? (JSON.parse(
              raw,
            ) as LocalRoom[])
          : [];

        const existingRoom =
          rooms.find(
            (existing) =>
              existing.id ===
              room.id,
          );

        // A Group-only invite must never erase room-level Chat access that
        // this device already obtained through an earlier direct invite.
        if (
          !room.roomSecret &&
          existingRoom?.roomSecret
        ) {
          room.roomSecret =
            existingRoom.roomSecret;
        }

        if (
          existingRoom?.createdAt
        ) {
          room.createdAt =
            existingRoom.createdAt;
        }

        const next = [
          room,
          ...rooms.filter(
            (existing) =>
              existing.id !==
              room.id,
          ),
        ];

        window.localStorage.setItem(
          ROOM_STORAGE_KEY,
          JSON.stringify(next),
        );

        let joinedGroupId:
          | string
          | null = null;

        if (
          invite.scope ===
          "group"
        ) {
          const now =
            new Date().toISOString();

          joinedGroupId =
            invite.groupId ??
            `legacy-${invite.roomId}`;

          const ownerAddress =
            invite.groupOwnerAddress ??
            invite.inviterAddress ??
            session.account.address;

          const joinedGroup:
            LocalRoomGroup = {
            id: joinedGroupId,
            roomId:
              invite.roomId,
            name:
              invite.groupName ??
              `${invite.label} Group`,
            groupSecret:
              invite.groupSecret ??
              invite.roomSecret ??
              "",
            ownerAddress,
            createdAt: now,
            members: [
              {
                address:
                  ownerAddress,
                role: "admin",
                joinedAt: now,
              },
              {
                address:
                  session.account
                    .address,
                role:
                  ownerAddress ===
                  session.account
                    .address
                    ? "admin"
                    : "member",
                joinedAt: now,
              },
            ],
          };

          upsertLocalGroup(
            room.id,
            joinedGroup,
          );
        }

        markInviteConsumed(
          invite.inviteId,
        );

        clearRecovery(
          invite.inviteId,
        );

        if (
          invite.scope ===
            "group" &&
          joinedGroupId
        ) {
          router.replace(
            `/room/${room.id}?group=${encodeURIComponent(
              joinedGroupId,
            )}`,
          );
          return;
        }

        if (
          invite.inviterAddress
        ) {
          router.replace(
            `/room/${room.id}?chat=${encodeURIComponent(
              invite.inviterAddress,
            )}`,
          );
          return;
        }

        router.replace(
          `/room/${room.id}?message=chat`,
        );
      } catch (err) {
        console.error(
          "[VINSS INVITE CONSUME ERROR]",
          err,
        );

        attempted.current =
          false;

        if (
          window.location.pathname.startsWith(
            "/invite/",
          )
        ) {
          setError(
            "This invite could not be validated on-chain. It may already be used or expired.",
          );
        }
      }
    })();
  }, [
    invite,
    session,
    router,
  ]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-10">
        <section className="w-full border border-wire bg-vault/30 p-6 sm:p-8">
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-danger">
            Invitation unavailable
          </p>

          <h1 className="mt-3 font-display text-2xl text-paper">
            This private invite cannot be opened
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-paper/40">
            {error}
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex h-11 items-center justify-center border border-wire px-5 font-display text-xs uppercase tracking-widest text-paper/60"
          >
            Back to VINSS
          </Link>
        </section>
      </main>
    );
  }

  if (invite && !session) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md text-center">
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
            {invite.scope ===
            "group"
              ? "Group invitation"
              : "Private Chat invitation"}
          </p>

          <p className="mt-3 text-sm text-paper/40">
            Connect Ready X to validate and consume this one-time invite.
          </p>

          <div className="mt-6 flex justify-center">
            <WalletConnectButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
          {invite?.scope ===
          "group"
            ? "Encrypted Group invitation"
            : "Encrypted Chat invitation"}
        </p>

        <p className="mt-3 font-display text-xs uppercase tracking-widest text-paper/30">
          {invite
            ? "Validating one-time invite on-chain…"
            : "Decrypting private room access…"}
        </p>
      </div>
    </main>
  );
}
