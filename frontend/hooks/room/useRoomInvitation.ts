"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { BACKEND_URL } from "@/lib/starknet/constants";
import { discoverMessages } from "@/lib/deal-room/messaging";
import {
  createInviteToken,
  getInviteOnchainState,
} from "@/lib/deal-room/invitation";
import type { RoomParticipant } from "@/lib/privacy/participantKeys";

interface RoomInvitationContext {
  id: string;
  label: string;
  roomSecret: string;
}

interface UseRoomInvitationOptions {
  room: RoomInvitationContext | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  participants: RoomParticipant[];
  setParticipants: Dispatch<SetStateAction<RoomParticipant[]>>;
  setError: (value: string | null) => void;
}

export function useRoomInvitation({
  room,
  session,
  channelKey,
  participants,
  setParticipants,
  setError,
}: UseRoomInvitationOptions) {
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [inviteCommitment, setInviteCommitment] =
    useState<string | null>(null);
  const [inviteNow, setInviteNow] = useState(Date.now());
  const [inviteCopied, setInviteCopied] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [inviteCompleted, setInviteCompleted] = useState(false);
  const [inviteJoinedNotice, setInviteJoinedNotice] = useState(false);

  useEffect(() => {
    if (!room) return;

    const completed =
      window.localStorage.getItem(
        `vinss:invite-completed:${room.id}`,
      ) === "1";

    setInviteCompleted(completed);

    if (completed) {
      setInviteLink(null);
      setInviteExpiresAt(null);
      setInviteCommitment(null);
      setInvitePending(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(
        `vinss:invite:${room.id}`,
      );

      if (!raw) return;

      const saved = JSON.parse(raw) as {
        link?: string;
        expiresAt?: string;
        commitment?: string;
        status?: "pending" | "ready";
      };

      if (
        saved.link &&
        saved.expiresAt &&
        Date.parse(saved.expiresAt) > Date.now()
      ) {
        setInviteLink(saved.link);
        setInviteExpiresAt(saved.expiresAt);
        setInviteCommitment(saved.commitment ?? null);
        setInvitePending(saved.status === "pending");
        setInviteNow(Date.now());
      } else {
        window.localStorage.removeItem(
          `vinss:invite:${room.id}`,
        );
      }
    } catch {
      window.localStorage.removeItem(
        `vinss:invite:${room.id}`,
      );
    }
  }, [room]);

  async function createInviteLink() {
    if (!room) return;

    setError(null);

    if (!session) {
      setError("Connect your wallet before creating an invite.");
      return;
    }

    // A new invitation must not inherit stale/expired/completed state.
    setInviteLink(null);
    setInviteExpiresAt(null);
    setInviteCommitment(null);
    setInviteCopied(false);
    setInvitePending(false);
    setInviteCompleted(false);
    setInviteJoinedNotice(false);
    setInviteNow(Date.now());

    window.localStorage.removeItem(
      `vinss:invite:${room.id}`,
    );

    window.localStorage.removeItem(
      `vinss:invite-completed:${room.id}`,
    );

    let preparedLink: string | null = null;
    let preparedCommitment: string | null = null;
    let preparedExpiresAt: string | null = null;

    try {
      const invite = await createInviteToken(
        session.account,
        {
          roomId: room.id,
          roomSecret: room.roomSecret,
          label: room.label,
        },
        (prepared) => {
          // IMPORTANT: this runs BEFORE Ready X is opened.
          const link =
            `${window.location.origin}/invite/${prepared.token}` +
            `#k=${prepared.key}`;

          preparedLink = link;
          preparedCommitment = prepared.commitment;
          preparedExpiresAt = prepared.expiresAt;

          setInviteLink(link);
          setInviteExpiresAt(prepared.expiresAt);
          setInviteCommitment(prepared.commitment);
          setInvitePending(true);
          setInviteNow(Date.now());

          window.localStorage.setItem(
            `vinss:invite:${room.id}`,
            JSON.stringify({
              link,
              expiresAt: prepared.expiresAt,
              commitment: prepared.commitment,
              status: "pending",
            }),
          );
        },
      );

      const link =
        preparedLink ??
        `${window.location.origin}/invite/${invite.token}` +
          `#k=${invite.key}`;

      setInviteLink(link);
      setInviteExpiresAt(invite.expiresAt);
      setInviteCommitment(invite.commitment);
      setInvitePending(false);
      setInviteNow(Date.now());

      window.localStorage.setItem(
        `vinss:invite:${room.id}`,
        JSON.stringify({
          link,
          expiresAt: invite.expiresAt,
          commitment: invite.commitment,
          status: "ready",
        }),
      );
    } catch (err) {
      console.error("[VINSS INVITE CREATE]", err);

      // Wallet callbacks can fail/disappear after mobile app switching
      // even when the chain transaction actually landed. Recover using
      // the commitment created before Ready X was opened.
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
            setInviteLink(preparedLink);
            setInviteExpiresAt(preparedExpiresAt);
            setInviteCommitment(preparedCommitment);
            setInvitePending(false);
            setInviteNow(Date.now());

            window.localStorage.setItem(
              `vinss:invite:${room.id}`,
              JSON.stringify({
                link: preparedLink,
                expiresAt: preparedExpiresAt,
                commitment: preparedCommitment,
                status: "ready",
              }),
            );

            return;
          }
        } catch {
          // Fall through to real failure cleanup.
        }
      }

      setInviteLink(null);
      setInviteExpiresAt(null);
      setInviteCommitment(null);
      setInvitePending(false);

      window.localStorage.removeItem(
        `vinss:invite:${room.id}`,
      );

      setError(
        "Could not create the private invitation.",
      );
    }
  }

  useEffect(() => {
    if (!inviteExpiresAt) return;

    const timer = window.setInterval(() => {
      setInviteNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [inviteExpiresAt]);

  const inviteRemainingMs = inviteExpiresAt
    ? Math.max(0, Date.parse(inviteExpiresAt) - inviteNow)
    : 0;

  const inviteExpired =
    Boolean(inviteExpiresAt) && inviteRemainingMs <= 0;

  const inviteRemainingSeconds =
    Math.ceil(inviteRemainingMs / 1000);

  const inviteMinutes =
    Math.floor(inviteRemainingSeconds / 60);

  const inviteSeconds =
    inviteRemainingSeconds % 60;

  const inviteCountdown =
    `${inviteMinutes}:${inviteSeconds.toString().padStart(2, "0")}`;

  useEffect(() => {
    if (
      !room ||
      participants.length === 0 ||
      inviteCompleted
    ) {
      return;
    }

    setInviteCompleted(true);
    setInviteJoinedNotice(true);
    setInviteLink(null);
    setInviteExpiresAt(null);
    setInviteCommitment(null);

    window.localStorage.setItem(
      `vinss:invite-completed:${room.id}`,
      "1",
    );

    window.localStorage.removeItem(
      `vinss:invite:${room.id}`,
    );

  }, [room, participants.length, inviteCompleted]);

  useEffect(() => {
    if (
      !inviteLink ||
      inviteExpired ||
      !channelKey ||
      !session ||
      participants.length > 0
    ) {
      return;
    }

    let cancelled = false;

    const checkCounterparty = async () => {
      try {
        const messages = await discoverMessages(
          BACKEND_URL,
          channelKey,
        );

        const map = new Map<string, RoomParticipant>();

        for (const item of messages) {
          const sender = item.message.senderIdentity;

          if (
            !sender?.address ||
            !sender.messagingPublicKey
          ) {
            continue;
          }

          if (
            sender.address.toLowerCase() ===
            session.account.address.toLowerCase()
          ) {
            continue;
          }

          map.set(sender.address.toLowerCase(), {
            address: sender.address,
            publicKey: sender.messagingPublicKey,
          });
        }

        if (!cancelled && map.size > 0) {
          setParticipants([...map.values()]);
        }
      } catch (err) {
      }
    };

    void checkCounterparty();

    const timer = window.setInterval(() => {
      void checkCounterparty();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    inviteLink,
    inviteExpired,
    channelKey,
    session,
    participants.length,
  ]);

  useEffect(() => {
    if (
      !room ||
      !inviteCommitment ||
      inviteExpired ||
      inviteCompleted
    ) {
      return;
    }

    let cancelled = false;

    const checkConsumed = async () => {
      try {
        const state =
          await getInviteOnchainState(inviteCommitment);

        if (
          cancelled ||
          !state.exists ||
          !state.consumed
        ) {
          return;
        }

        setInviteCompleted(true);
        setInviteJoinedNotice(true);

        setInviteLink(null);
        setInviteExpiresAt(null);
        setInviteCommitment(null);

        window.localStorage.setItem(
          `vinss:invite-completed:${room.id}`,
          "1",
        );

        window.localStorage.removeItem(
          `vinss:invite:${room.id}`,
        );
      } catch (err) {
      }
    };

    void checkConsumed();

    const timer = window.setInterval(() => {
      void checkConsumed();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    room,
    inviteCommitment,
    inviteExpired,
    inviteCompleted,
  ]);

  useEffect(() => {
    if (!inviteJoinedNotice) return;

    const timer = window.setTimeout(() => {
      setInviteJoinedNotice(false);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [inviteJoinedNotice]);

  useEffect(() => {
    if (
      !room ||
      !invitePending ||
      !inviteCommitment ||
      inviteExpired
    ) {
      return;
    }

    let cancelled = false;

    const recoverPendingInvite = async () => {
      try {
        const state =
          await getInviteOnchainState(
            inviteCommitment,
          );

        if (
          cancelled ||
          !state.exists
        ) {
          return;
        }

        setInvitePending(false);

        const raw =
          window.localStorage.getItem(
            `vinss:invite:${room.id}`,
          );

        if (!raw) return;

        const saved = JSON.parse(raw) as {
          link?: string;
          expiresAt?: string;
          commitment?: string;
        };

        window.localStorage.setItem(
          `vinss:invite:${room.id}`,
          JSON.stringify({
            ...saved,
            status: "ready",
          }),
        );
      } catch (err) {
      }
    };

    void recoverPendingInvite();

    const timer = window.setInterval(() => {
      void recoverPendingInvite();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    room,
    invitePending,
    inviteCommitment,
    inviteExpired,
  ]);

  async function copyInviteLink() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
    } catch (err) {
      console.error("[VINSS INVITE COPY]", err);
      setError("Could not copy the invite link.");
    }
  }

  async function shareInviteLink() {
    if (!inviteLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `VINSS — ${room?.label ?? "Private room"}`,
          text: "You're invited to a private VINSS deal room.",
          url: inviteLink,
        });
      } catch {
        // User cancelled native sharing.
      }
      return;
    }

    await copyInviteLink();
  }

  return {
    inviteLink,
    inviteCopied,
    invitePending,
    inviteCompleted,
    inviteJoinedNotice,
    inviteExpired,
    inviteCountdown,
    createInviteLink,
    copyInviteLink,
    shareInviteLink,
  };
}
