"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import {
  BACKEND_URL,
} from "@/lib/starknet/constants";
import {
  deriveDirectMessageKey,
  sameStarknetAddress,
  type MessagingIdentity,
  type RoomParticipant,
} from "@/lib/privacy/participantKeys";
import {
  pollPresence,
  publishPresence,
} from "@/lib/privacy/presence";
import type {
  ConversationEntry,
} from "@/components/room/conversation/types";

interface UseDirectPresenceOptions {
  roomId: string | null;
  active: boolean;
  session: VinssWalletSession | null;
  messagingIdentity: MessagingIdentity | null;
  selectedPeer: RoomParticipant | null;
  peerKey: string;
  draft: string;
  entries: ConversationEntry[];
  setEntries: Dispatch<
    SetStateAction<ConversationEntry[]>
  >;
}

/*
 * Presence is intentionally isolated from message discovery.
 *
 * Typing/read receipts are pairwise encrypted, short-lived metadata and never
 * become MessageHelper/on-chain records. Keeping this lifecycle separate also
 * prevents presence polling from making the main conversation hook harder to
 * reason about.
 */
export function useDirectPresence({
  roomId,
  active,
  session,
  messagingIdentity,
  selectedPeer,
  peerKey,
  draft,
  entries,
  setEntries,
}: UseDirectPresenceOptions): boolean {
  const [peerTyping, setPeerTyping] =
    useState(false);

  const sentReadReceiptsRef =
    useRef<Set<string>>(new Set());

  async function resolveDirectKey():
    Promise<Uint8Array | null> {
    if (
      !roomId ||
      !messagingIdentity ||
      !selectedPeer
    ) {
      return null;
    }

    return deriveDirectMessageKey(
      roomId,
      messagingIdentity.privateKey,
      selectedPeer.publicKey,
    );
  }

  const hasTypingDraft =
    Boolean(draft.trim());

  // Publish our typing state only to the selected direct peer.
  useEffect(() => {
    if (
      !active ||
      !session ||
      !selectedPeer ||
      !messagingIdentity
    ) {
      setPeerTyping(false);
      return;
    }

    let stopped = false;
    let interval: number | null = null;

    const publishTyping = async (
      typing: boolean,
    ) => {
      try {
        const directKey =
          await resolveDirectKey();

        if (!directKey || stopped) {
          return;
        }

        await publishPresence(
          BACKEND_URL,
          directKey,
          {
            version: 1,
            type: "typing",
            senderAddress:
              session.account.address,
            sentAt:
              new Date().toISOString(),
            active: typing,
          },
          typing ? 5_000 : 2_000,
        );
      } catch (error) {
        console.error(
          "[VINSS DIRECT TYPING ERROR]",
          error,
        );
      }
    };

    if (hasTypingDraft) {
      void publishTyping(true);

      interval = window.setInterval(
        () => {
          void publishTyping(true);
        },
        2_000,
      );
    } else {
      void publishTyping(false);
    }

    return () => {
      stopped = true;

      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [
    active,
    roomId,
    session?.account.address,
    peerKey,
    selectedPeer?.publicKey,
    messagingIdentity?.publicKey,
    hasTypingDraft,
  ]);

  // Poll typing + read receipts only for this selected pair.
  useEffect(() => {
    if (
      !active ||
      !session ||
      !selectedPeer ||
      !messagingIdentity
    ) {
      setPeerTyping(false);
      return;
    }

    let stopped = false;
    let running = false;

    const poll = async () => {
      if (stopped || running) return;

      running = true;

      try {
        const directKey =
          await resolveDirectKey();

        if (!directKey || stopped) {
          return;
        }

        const events =
          await pollPresence(
            BACKEND_URL,
            directKey,
          );

        if (stopped) return;

        const peerEvents =
          events.filter((event) =>
            sameStarknetAddress(
              event.senderAddress,
              selectedPeer.address,
            ),
          );

        const latestTyping =
          peerEvents
            .filter(
              (event) =>
                event.type === "typing",
            )
            .sort(
              (left, right) =>
                new Date(
                  right.sentAt,
                ).getTime() -
                new Date(
                  left.sentAt,
                ).getTime(),
            )[0];

        setPeerTyping(
          Boolean(
            latestTyping?.active &&
            latestTyping.expiresAt >
              Date.now(),
          ),
        );

        const readByLocator =
          new Map<string, string>();

        for (const event of peerEvents) {
          if (
            event.type !== "read" ||
            !event.messageLocator
          ) {
            continue;
          }

          readByLocator.set(
            event.messageLocator
              .replace(/^0x/, "")
              .toLowerCase(),
            event.sentAt,
          );
        }

        if (readByLocator.size > 0) {
          setEntries((previous) =>
            previous.map((entry) => {
              if (
                entry.scope !== "direct" ||
                !sameStarknetAddress(
                  entry.senderAddress,
                  session.account.address,
                ) ||
                !sameStarknetAddress(
                  entry.recipientAddress,
                  selectedPeer.address,
                )
              ) {
                return entry;
              }

              const readAt =
                readByLocator.get(
                  entry.actionLocator
                    .replace(/^0x/, "")
                    .toLowerCase(),
                );

              return readAt
                ? {
                    ...entry,
                    readAt,
                  }
                : entry;
            }),
          );
        }
      } catch (error) {
        console.error(
          "[VINSS DIRECT PRESENCE ERROR]",
          error,
        );
        setPeerTyping(false);
      } finally {
        running = false;
      }
    };

    void poll();

    const timer = window.setInterval(
      () => {
        void poll();
      },
      1_200,
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
      setPeerTyping(false);
    };
  }, [
    active,
    roomId,
    session?.account.address,
    peerKey,
    selectedPeer?.publicKey,
    messagingIdentity?.publicKey,
  ]);

  // Emit receipts only while this direct panel is actually active/open.
  useEffect(() => {
    if (
      !active ||
      !session ||
      !selectedPeer ||
      !messagingIdentity
    ) {
      return;
    }

    const unreadIncoming =
      entries.filter(
        (entry) =>
          entry.scope === "direct" &&
          Boolean(entry.transactionHash) &&
          sameStarknetAddress(
            entry.senderAddress,
            selectedPeer.address,
          ) &&
          sameStarknetAddress(
            entry.recipientAddress,
            session.account.address,
          ) &&
          !sentReadReceiptsRef.current.has(
            entry.actionLocator
              .replace(/^0x/, "")
              .toLowerCase(),
          ),
      );

    if (unreadIncoming.length === 0) {
      return;
    }

    let cancelled = false;

    const publishReceipts =
      async () => {
        try {
          const directKey =
            await resolveDirectKey();

          if (!directKey || cancelled) {
            return;
          }

          for (
            const entry of unreadIncoming
          ) {
            const locator =
              entry.actionLocator
                .replace(/^0x/, "")
                .toLowerCase();

            sentReadReceiptsRef.current.add(
              locator,
            );

            try {
              await publishPresence(
                BACKEND_URL,
                directKey,
                {
                  version: 1,
                  type: "read",
                  senderAddress:
                    session.account.address,
                  sentAt:
                    new Date().toISOString(),
                  messageLocator: locator,
                },
                24 * 60 * 60 * 1000,
              );
            } catch (error) {
              sentReadReceiptsRef.current.delete(
                locator,
              );

              console.error(
                "[VINSS DIRECT READ RECEIPT ERROR]",
                error,
              );
            }
          }
        } catch (error) {
          console.error(
            "[VINSS DIRECT READ KEY ERROR]",
            error,
          );
        }
      };

    void publishReceipts();

    return () => {
      cancelled = true;
    };
  }, [
    active,
    roomId,
    session?.account.address,
    peerKey,
    selectedPeer?.publicKey,
    messagingIdentity?.publicKey,
    entries,
  ]);

  return peerTyping;
}
