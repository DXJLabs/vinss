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

    // Rekber coordination is peer-to-peer UX on top of indexed
    // encrypted actions. Poll quickly while the Escrow view is active so
    // a completed counterparty approval appears without a long stale spinner.
    const timer =
      window.setInterval(
        () => {
          void sync();
        },
        1000,
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

    const action: EscrowActionPayload = {
      ...payload,
      senderAddress:
        session.account.address,
      recipientAddress:
        peer.address,
      sentAt:
        new Date().toISOString(),
    };

    // Ready X may execute the STRK20 invoke successfully but its in-page
    // callback can later reject with "Timeout". Capture the immutable
    // locator before the wallet request and confirm that exact action from
    // ciphertext discovery instead of treating the callback as truth.
    let preparedLocator!: bigint;
    let preparedCommitment!: bigint;
    let signalPrepared:
      (() => void) | null = null;

    const preparedReady =
      new Promise<void>((resolve) => {
        signalPrepared = resolve;
      });

    const walletPromise =
      sendEscrowCoordinationAction(
        session.account,
        channelKey,
        action,
        route,
        (prepared) => {
          preparedLocator =
            prepared.actionLocator;
          preparedCommitment =
            prepared.payloadCommitment;
          signalPrepared?.();
        },
      );

    // sendEscrowCoordinationAction invokes onPrepared before opening Ready X.
    await preparedReady;

    const locatorKey =
      preparedLocator
        .toString(16)
        .replace(/^0x/, "")
        .toLowerCase();

    let stopDiscovery = false;

    const confirmationPromise =
      (async () => {
        const deadline =
          Date.now() + 45_000;

        while (
          !stopDiscovery &&
          Date.now() < deadline
        ) {
          try {
            const discovered =
              await discoverEscrowActions(
                BACKEND_URL,
                channelKey,
                route,
              );

            const match =
              discovered.find(
                (item) =>
                  item.actionLocator
                    .replace(/^0x/, "")
                    .toLowerCase() ===
                  locatorKey,
              );

            if (match) {
              return match;
            }
          } catch {
            // Backend/indexer can briefly lag the accepted chain transaction.
          }

          await new Promise<void>(
            (resolve) =>
              window.setTimeout(
                resolve,
                1000,
              ),
          );
        }

        return null;
      })();

    const walletOutcome =
      walletPromise
        .then((result) => ({
          kind: "wallet" as const,
          result,
        }))
        .catch((error) => ({
          kind:
            "wallet_error" as const,
          error,
        }));

    const first =
      await Promise.race([
        walletOutcome,
        confirmationPromise.then(
          (match) => ({
            kind:
              "discovery" as const,
            match,
          }),
        ),
      ]);

    const resultFromProof = (
      transactionHash: string,
    ): SendActionResult => ({
      transactionHash,
      actionLocator:
        preparedLocator,
      payloadCommitment:
        preparedCommitment,
    });

    /*
     * Blockchain discovery is authoritative for Rekber coordination.
     *
     * Ready X/Mises can report success, timeout, or even a generic error
     * after the private action has already reached Starknet. Never advance
     * setup/approval from the wallet callback alone.
     */
    if (
      first.kind === "discovery" &&
      first.match
    ) {
      stopDiscovery = true;

      // A late wallet callback is irrelevant after the exact immutable
      // action locator already has an indexed Starknet transaction proof.
      void walletPromise.catch(
        () => undefined,
      );

      void refreshEscrowActions();

      return resultFromProof(
        first.match.transactionHash,
      );
    }

    /*
     * A 45s discovery timeout must also terminate a wallet promise that
     * never resolves. Previously VINSS fell back to `await walletPromise`
     * here, which could leave the UI stuck forever at step 2/2.
     */
    if (
      first.kind === "discovery" &&
      !first.match
    ) {
      stopDiscovery = true;

      void walletPromise.catch(
        () => undefined,
      );

      throw new Error(
        "Rekber coordination was not confirmed on-chain. Sync the room before retrying.",
      );
    }

    if (
      first.kind ===
      "wallet_error"
    ) {
      const raw =
        first.error instanceof Error
          ? first.error.message
          : String(first.error);

      const explicitUserCancellation =
        /(?:user.*(?:reject|refus|cancel|denied)|rejected by user|cancelled by user|action_rejected)/i.test(
          raw,
        );

      /*
       * An explicit user cancellation can fail immediately. Any other wallet
       * error remains ambiguous and must be checked against Starknet first.
       */
      if (explicitUserCancellation) {
        stopDiscovery = true;
        throw first.error;
      }
    }

    /*
     * Even a successful wallet callback is only transport information.
     * Wait for the exact prepared locator to appear in encrypted discovery.
     */
    const confirmed =
      await confirmationPromise;

    stopDiscovery = true;

    if (confirmed) {
      void refreshEscrowActions();

      return resultFromProof(
        confirmed.transactionHash,
      );
    }

    if (
      first.kind ===
      "wallet_error"
    ) {
      throw first.error;
    }

    throw new Error(
      "Ready X returned, but the Rekber action was not confirmed on-chain. Sync before retrying.",
    );
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
