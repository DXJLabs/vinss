"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import {
  discoverEscrowActions,
  sendEscrowCoordinationAction,
} from "@/lib/deal-room/escrow";
import type {
  EscrowActionPayload,
  SendActionResult,
} from "@/types/deal-room";
import {
  canonicalStarknetAddress,
  deriveDirectMessageKey,
  getOrCreateMessagingIdentity,
  sameStarknetAddress,
  type MessagingIdentity,
  type RoomParticipant,
} from "@/lib/privacy/participantKeys";
import type {
  MessageRoute,
} from "@/lib/privacy/messageRouting";
import {
  BACKEND_URL,
} from "@/lib/starknet/constants";

export interface DiscoveredEscrowAction {
  actionLocator: string;
  payloadCommitment: string;
  senderTag: string;
  recipientTag: string;
  action: EscrowActionPayload;
  blockNumber: number;
  transactionHash: string;
}

interface UseRoomEscrowOptions {
  roomId: string | null;
  session:
    | VinssWalletSession
    | null;
  channelKey:
    | Uint8Array
    | null;
  participants:
    RoomParticipant[];
  active: boolean;
}

export function useRoomEscrow({
  roomId,
  session,
  channelKey,
  participants,
  active,
}: UseRoomEscrowOptions) {
  const [
    messagingIdentity,
    setMessagingIdentity,
  ] =
    useState<
      MessagingIdentity | null
    >(null);

  const [
    escrowActions,
    setEscrowActions,
  ] =
    useState<
      DiscoveredEscrowAction[]
    >([]);

  const participantFingerprint =
    useMemo(
      () =>
        participants
          .map(
            (participant) =>
              `${canonicalStarknetAddress(
                participant.address,
              )}:${participant.publicKey}`,
          )
          .sort()
          .join("|"),
      [participants],
    );

  useEffect(() => {
    if (!roomId || !session) {
      setMessagingIdentity(null);
      setEscrowActions([]);
      return;
    }

    let cancelled = false;

    getOrCreateMessagingIdentity(
      roomId,
      session.account.address,
    )
      .then((identity) => {
        if (!cancelled) {
          setMessagingIdentity(
            identity,
          );
        }
      })
      .catch((err) => {
        console.error(
          "[VINSS ESCROW IDENTITY ERROR]",
          err,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    roomId,
    session?.account.address,
  ]);

  async function resolveDirectRoute(
    peerAddress: string,
  ): Promise<{
    peer: RoomParticipant;
    route: MessageRoute;
  }> {
    if (
      !roomId ||
      !messagingIdentity
    ) {
      throw new Error(
        "Private Escrow identity is not ready.",
      );
    }

    const peer =
      participants.find(
        (participant) =>
          sameStarknetAddress(
            participant.address,
            peerAddress,
          ),
      );

    if (!peer) {
      throw new Error(
        "The accepted Offer counterparty is not available for private Escrow yet.",
      );
    }

    const directKey =
      await deriveDirectMessageKey(
        roomId,
        messagingIdentity.privateKey,
        peer.publicKey,
      );

    return {
      peer,
      route: {
        recipientIdentity:
          canonicalStarknetAddress(
            peer.address,
          ),
        encryptionKey:
          directKey,
        routingKey:
          directKey,
      },
    };
  }

  async function buildDiscoveryRoutes():
    Promise<MessageRoute[]> {
    if (
      !roomId ||
      !session ||
      !messagingIdentity
    ) {
      return [];
    }

    const routes:
      MessageRoute[] = [];

    const self =
      canonicalStarknetAddress(
        session.account.address,
      );

    for (
      const participant
      of participants
    ) {
      const directKey =
        await deriveDirectMessageKey(
          roomId,
          messagingIdentity.privateKey,
          participant.publicKey,
        );

      // Incoming coordination targets this wallet.
      routes.push({
        recipientIdentity: self,
        encryptionKey:
          directKey,
        routingKey:
          directKey,
      });

      // Outgoing history targets the peer.
      routes.push({
        recipientIdentity:
          canonicalStarknetAddress(
            participant.address,
          ),
        encryptionKey:
          directKey,
        routingKey:
          directKey,
      });
    }

    return routes;
  }

  async function refreshEscrowActions():
    Promise<void> {
    if (
      !roomId ||
      !session ||
      !channelKey ||
      !messagingIdentity ||
      participants.length === 0
    ) {
      return;
    }

    const routes =
      await buildDiscoveryRoutes();

    const discovered =
      await discoverEscrowActions(
        BACKEND_URL,
        channelKey,
        routes,
      );

    const self =
      canonicalStarknetAddress(
        session.account.address,
      );

    const knownPeers =
      new Set(
        participants.map(
          (participant) =>
            canonicalStarknetAddress(
              participant.address,
            ),
        ),
      );

    const visible =
      discovered.filter(
        (item) => {
          const sender =
            item.action.senderAddress
              ? canonicalStarknetAddress(
                  item.action.senderAddress,
                )
              : "";
          const recipient =
            item.action.recipientAddress
              ? canonicalStarknetAddress(
                  item.action.recipientAddress,
                )
              : "";

          if (
            !sender ||
            !recipient
          ) {
            return false;
          }

          const peer =
            sender === self
              ? recipient
              : recipient === self
                ? sender
                : "";

          return (
            Boolean(peer) &&
            knownPeers.has(peer)
          );
        },
      );

    const byLocator =
      new Map<
        string,
        DiscoveredEscrowAction
      >();

    for (const item of visible) {
      byLocator.set(
        item.actionLocator
          .replace(/^0x/, "")
          .toLowerCase(),
        item,
      );
    }

    setEscrowActions(
      [...byLocator.values()]
        .sort(
          (a, b) =>
            a.blockNumber -
            b.blockNumber,
        ),
    );
  }

  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !session ||
      !channelKey ||
      !messagingIdentity ||
      !participantFingerprint
    ) {
      return;
    }

    let stopped = false;
    let running = false;

    const sync =
      async () => {
        if (
          stopped ||
          running
        ) {
          return;
        }

        running = true;

        try {
          await refreshEscrowActions();
        } catch (err) {
          console.error(
            "[VINSS ESCROW DISCOVERY ERROR]",
            err,
          );
        } finally {
          running = false;
        }
      };

    void sync();

    const timer =
      window.setInterval(
        () => {
          void sync();
        },
        3000,
      );

    const onVisible =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void sync();
        }
      };

    window.addEventListener(
      "focus",
      sync,
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
        sync,
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
    channelKey,
    messagingIdentity?.publicKey,
    participantFingerprint,
  ]);

  async function
  sendDirectEscrowCoordination(
    peerAddress: string,
    payload: EscrowActionPayload,
  ): Promise<SendActionResult> {
    if (
      !session ||
      !channelKey
    ) {
      throw new Error(
        "Connect your wallet before starting Escrow Rekber.",
      );
    }

    const { peer, route } =
      await resolveDirectRoute(
        peerAddress,
      );

    const result =
      await sendEscrowCoordinationAction(
        session.account,
        channelKey,
        {
          ...payload,
          senderAddress:
            session.account.address,
          recipientAddress:
            peer.address,
          sentAt:
            new Date().toISOString(),
        },
        route,
      );

    // Reconcile immediately instead of waiting for the next poll.
    void refreshEscrowActions();

    return result;
  }

  return {
    escrowIdentityReady:
      Boolean(
        messagingIdentity,
      ),
    escrowActions,
    refreshEscrowActions,
    sendDirectEscrowCoordination,
  };
}
