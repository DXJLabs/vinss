"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { BACKEND_URL } from "@/lib/starknet/constants";
import { discoverMessages } from "@/lib/deal-room/messaging";
import {
  pollPresence,
  publishPresence,
} from "@/lib/privacy/presence";
import {
  canonicalStarknetAddress,
  getOrCreateMessagingIdentity,
  sameStarknetAddress,
  type MessagingIdentity,
  type RoomParticipant,
} from "@/lib/privacy/participantKeys";

interface UseRoomParticipantsOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  active: boolean;
}

interface UseRoomParticipantsResult {
  participants: RoomParticipant[];
  setParticipants: Dispatch<
    SetStateAction<RoomParticipant[]>
  >;
  messagingIdentity: MessagingIdentity | null;
  selfRoutingIdentities: string[];
  refreshParticipants: (
    silent?: boolean,
  ) => Promise<void>;
}

/**
 * Participant discovery is its own concern.
 *
 * Group ciphertext is the private exchange point for wallet address +
 * messaging public key. Direct chat and Offer code consume this result but
 * never mutate Group message state.
 */
export function useRoomParticipants({
  roomId,
  session,
  channelKey,
  active,
}: UseRoomParticipantsOptions): UseRoomParticipantsResult {
  const [participants, setParticipants] =
    useState<RoomParticipant[]>([]);

  const [messagingIdentity, setMessagingIdentity] =
    useState<MessagingIdentity | null>(null);

  const [
    selfRoutingIdentities,
    setSelfRoutingIdentities,
  ] = useState<string[]>([]);

  useEffect(() => {
    if (!roomId || !session) {
      setMessagingIdentity(null);
      setParticipants([]);
      setSelfRoutingIdentities([]);
      return;
    }

    // Restore the last known peers immediately so a direct tab does not
    // disappear just because Ready X or the browser remounted this page.
    try {
      const cacheKey =
        `vinss:participants:${roomId}:` +
        canonicalStarknetAddress(
          session.account.address,
        );

      const cached = JSON.parse(
        window.localStorage.getItem(cacheKey) ??
          "[]",
      ) as RoomParticipant[];

      if (Array.isArray(cached)) {
        setParticipants(
          cached.filter(
            (participant) =>
              participant?.address &&
              participant?.publicKey &&
              !sameStarknetAddress(
                participant.address,
                session.account.address,
              ),
          ),
        );
      }
    } catch {
      // Cache failure never blocks fresh encrypted discovery.
    }

    let cancelled = false;

    getOrCreateMessagingIdentity(
      roomId,
      session.account.address,
    )
      .then((identity) => {
        if (!cancelled) {
          setMessagingIdentity(identity);
        }
      })
      .catch((err) => {
        console.error(
          "[VINSS PARTICIPANT IDENTITY ERROR]",
          err,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, session?.account.address]);

  async function refreshParticipants(
    silent = true,
  ): Promise<void> {
    if (!channelKey || !session) return;

    try {
      const [groupMessages, roomPresence] =
        await Promise.all([
          discoverMessages(
            BACKEND_URL,
            channelKey,
          ).catch((err) => {
            console.error(
              "[VINSS PARTICIPANT GROUP FALLBACK ERROR]",
              err,
            );
            return [];
          }),
          pollPresence(
            BACKEND_URL,
            channelKey,
          ).catch((err) => {
            console.error(
              "[VINSS PARTICIPANT PRESENCE ERROR]",
              err,
            );
            return [];
          }),
        ]);

      const peerMap = new Map<
        string,
        RoomParticipant
      >();

      const peerObservedAt =
        new Map<
          string,
          {
            at: number;
            priority: number;
          }
        >();

      const rememberPeer = (
        address: string,
        publicKey: string,
        sentAt: string | undefined,
        priority: number,
      ) => {
        const key =
          canonicalStarknetAddress(
            address,
          );

        const parsed =
          Date.parse(sentAt ?? "");

        const at =
          Number.isFinite(parsed)
            ? parsed
            : 0;

        const previous =
          peerObservedAt.get(key);

        if (
          previous &&
          (
            previous.at > at ||
            (
              previous.at === at &&
              previous.priority >
                priority
            )
          )
        ) {
          return;
        }

        peerObservedAt.set(
          key,
          {
            at,
            priority,
          },
        );

        peerMap.set(
          key,
          {
            address,
            publicKey,
          },
        );
      };

      const ownAliases = new Set<string>();

      // Room-level encrypted participant announcements remove the old
      // requirement that someone must post in Group before Direct appears.
      for (const event of roomPresence) {
        if (
          event.type !== "participant" ||
          !event.senderAddress ||
          !event.messagingPublicKey
        ) {
          continue;
        }

        if (
          sameStarknetAddress(
            event.senderAddress,
            session.account.address,
          )
        ) {
          ownAliases.add(event.senderAddress);
          continue;
        }

        rememberPeer(
          event.senderAddress,
          event.messagingPublicKey,
          event.sentAt,
          2,
        );
      }

      for (const item of groupMessages) {
        const sender = item.message.senderIdentity;

        if (
          !sender?.address ||
          !sender.messagingPublicKey
        ) {
          continue;
        }

        if (
          sameStarknetAddress(
            sender.address,
            session.account.address,
          )
        ) {
          // Keep the exact identity string previously encrypted by this wallet.
          // It can differ textually from a later wallet-session address while
          // still representing the same Starknet felt.
          ownAliases.add(sender.address);
          continue;
        }

        rememberPeer(
          sender.address,
          sender.messagingPublicKey,
          item.message.sentAt,
          1,
        );
      }

      setParticipants((previous) => {
        // Preserve an invitation-discovered peer until Group discovery catches
        // up, but let newer encrypted Group identity metadata win.
        const merged = new Map<
          string,
          RoomParticipant
        >();

        for (const participant of previous) {
          merged.set(
            canonicalStarknetAddress(
              participant.address,
            ),
            participant,
          );
        }

        for (const [
          key,
          participant,
        ] of peerMap) {
          merged.set(key, participant);
        }

        const next = [...merged.values()].filter(
          (participant) =>
            !sameStarknetAddress(
              participant.address,
              session.account.address,
            ),
        );

        try {
          const cacheKey =
            `vinss:participants:${roomId}:` +
            canonicalStarknetAddress(
              session.account.address,
            );

          window.localStorage.setItem(
            cacheKey,
            JSON.stringify(next),
          );
        } catch {
          // Local caching is only a UX optimization.
        }

        return next;
      });

      setSelfRoutingIdentities([
        session.account.address,
        ...ownAliases,
      ]);
    } catch (err) {
      console.error(
        "[VINSS PARTICIPANT DISCOVERY ERROR]",
        err,
      );

      if (!silent) {
        throw err;
      }
    }
  }

  useEffect(() => {
    if (
      !roomId ||
      !channelKey ||
      !session ||
      !messagingIdentity
    ) {
      return;
    }

    let stopped = false;

    const publishIdentity = async () => {
      try {
        await publishPresence(
          BACKEND_URL,
          channelKey,
          {
            version: 1,
            type: "participant",
            senderAddress:
              session.account.address,
            sentAt:
              new Date().toISOString(),
            messagingPublicKey:
              messagingIdentity.publicKey,
          },
          24 * 60 * 60 * 1000,
        );
      } catch (err) {
        if (!stopped) {
          console.error(
            "[VINSS PARTICIPANT PUBLISH ERROR]",
            err,
          );
        }
      }
    };

    // Publish immediately. No Group message or wallet transaction is needed.
    void publishIdentity();

    const timer = window.setInterval(() => {
      void publishIdentity();
    }, 60_000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [
    roomId,
    channelKey,
    session?.account.address,
    messagingIdentity?.publicKey,
  ]);

  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !channelKey ||
      !session
    ) {
      return;
    }

    let stopped = false;
    let running = false;

    const sync = async () => {
      if (stopped || running) return;

      running = true;

      try {
        await refreshParticipants(true);
      } finally {
        running = false;
      }
    };

    void sync();

    const timer = window.setInterval(() => {
      void sync();
    }, 3000);

    const onVisible = () => {
      if (
        document.visibilityState === "visible"
      ) {
        void sync();
      }
    };

    window.addEventListener("focus", sync);
    document.addEventListener(
      "visibilitychange",
      onVisible,
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener(
        "visibilitychange",
        onVisible,
      );
    };
  }, [
    active,
    roomId,
    channelKey,
    session?.account.address,
  ]);

  const stableSelfRoutingIdentities =
    useMemo(() => {
      const unique = new Map<string, string>();

      for (const identity of [
        session?.account.address ?? "",
        ...selfRoutingIdentities,
      ]) {
        if (!identity) continue;

        unique.set(
          canonicalStarknetAddress(identity),
          identity,
        );
      }

      return [...unique.values()];
    }, [
      session?.account.address,
      selfRoutingIdentities.join("|"),
    ]);

  return {
    participants,
    setParticipants,
    messagingIdentity,
    selfRoutingIdentities:
      stableSelfRoutingIdentities,
    refreshParticipants,
  };
}
