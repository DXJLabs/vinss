"use client";

import { useEffect, useState } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { BACKEND_URL } from "@/lib/starknet/constants";
import {
  acceptOffer,
  counterOffer,
  createOffer,
  discoverOfferActions,
  rejectOffer,
} from "@/lib/deal-room/offers";
import {
  deriveDirectMessageKey,
  getOrCreateMessagingIdentity,
  type MessagingIdentity,
  type RoomParticipant,
} from "@/lib/privacy/participantKeys";
import type { MessageRoute } from "@/lib/privacy/messageRouting";
import type {
  DealType,
  OfferActionPayload,
  SendActionResult,
} from "@/types/deal-room";
import type { ConversationEntry } from "@/components/room/conversation/ConversationPanel";
import { humanizeError } from "@/lib/errors/uiError";

export interface OfferTermsInput {
  dealType?: DealType;
  asset: string;
  amount: string;
  paymentTerms: string;
  conditions?: string;
  expiresAt?: string;
}

interface UseRoomOffersOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  participants: RoomParticipant[];
  active: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

interface DirectOfferContext {
  peer: RoomParticipant;
  route: MessageRoute;
}

// Keep UI locators normalized without changing the on-chain felt value.
function stripLocator(locator: string): string {
  return locator.replace(/^0x/, "").toLowerCase();
}

// Store lifecycle parent/root references as explicit hex strings.
function canonicalLocator(locator: string): string {
  return `0x${stripLocator(locator)}`;
}

// Produce a compact Agent/UI summary without leaking it outside local state.
function summarizeOffer(action: OfferActionPayload): string {
  const verb =
    action.kind === "counter"
      ? "Counter offer"
      : action.kind === "accept"
        ? "Offer accepted"
        : action.kind === "reject"
          ? "Offer rejected"
          : "Offer";

  return `${verb} — ${action.amount} ${action.asset}`;
}

export function useRoomOffers({
  roomId,
  session,
  channelKey,
  participants,
  active,
  setBusy,
  setError,
}: UseRoomOffersOptions) {
  // Offer entries are intentionally separate from generic message state.
  const [offerEntries, setOfferEntries] = useState<ConversationEntry[]>([]);

  // Reuse the same per-room non-exportable ECDH identity used by direct chat.
  const [messagingIdentity, setMessagingIdentity] =
    useState<MessagingIdentity | null>(null);

  // Stabilize the participant dependency so chat refreshes do not constantly
  // restart the Offer discovery interval with an equivalent participant set.
  const participantFingerprint = participants
    .map(
      (participant) =>
        `${participant.address.toLowerCase()}:${participant.publicKey}`,
    )
    .sort()
    .join("|");

  useEffect(() => {
    // Direct Offers cannot derive a pairwise key without room and wallet identity.
    if (!roomId || !session) {
      setMessagingIdentity(null);
      return;
    }

    let cancelled = false;

    // IndexedDB returns the same non-exportable key pair used by direct chat.
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
        // Raw identity errors stay in developer logs only.
        console.error("[VINSS OFFER IDENTITY ERROR]", err);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, session?.account.address]);

  /**
   * Resolve one pairwise Offer route.
   *
   * The caller chooses which recipient identity should be represented by the
   * opaque recipient tag. Encryption always uses the same Alice<->Bob key.
   */
  async function resolveDirectContext(
    peerAddress: string,
    recipientIdentity: string,
  ): Promise<DirectOfferContext> {
    if (!roomId || !messagingIdentity) {
      throw new Error("Private Offer identity is not ready.");
    }

    // Match against participant public keys learned from encrypted room chat.
    const peer = participants.find(
      (participant) =>
        participant.address.toLowerCase() ===
        peerAddress.toLowerCase(),
    );

    if (!peer) {
      throw new Error(
        "The selected participant is not available for a private Offer yet.",
      );
    }

    // Derive the same pairwise key on Alice and Bob without exporting either private key.
    const directKey = await deriveDirectMessageKey(
      roomId,
      messagingIdentity.privateKey,
      peer.publicKey,
    );

    return {
      peer,
      route: {
        recipientIdentity,
        encryptionKey: directKey,
        routingKey: directKey,
      },
    };
  }

  // Merge one locally confirmed action immediately while discovery catches up.
  function appendLocalOffer(
    result: SendActionResult,
    action: OfferActionPayload,
  ) {
    const entry: ConversationEntry = {
      id: `offer:${result.actionLocator.toString(16)}`,
      kind: "offer",
      summary: summarizeOffer(action),
      transactionHash: result.transactionHash,
      actionLocator: result.actionLocator.toString(16),
      sentAt: action.sentAt ?? new Date().toISOString(),
      scope: "direct",
      senderAddress: action.senderAddress,
      recipientAddress: action.recipientAddress,
      offerAction: action,
    };

    setOfferEntries((previous) => {
      // Replace an existing copy if auto discovery won the race.
      const withoutSameLocator = previous.filter(
        (item) =>
          stripLocator(item.actionLocator) !==
          stripLocator(entry.actionLocator),
      );

      return [...withoutSameLocator, entry].sort(
        (left, right) =>
          new Date(left.sentAt).getTime() -
          new Date(right.sentAt).getTime(),
      );
    });
  }

  /**
   * Discover both incoming and outgoing direct Offer actions.
   *
   * Each pairwise key gets two candidate recipient identities:
   * - this wallet, for incoming actions;
   * - the peer wallet, for our own outgoing actions.
   */
  async function handleOfferRefresh(silent = false) {
    if (
      !roomId ||
      !session ||
      !channelKey ||
      !messagingIdentity ||
      participants.length === 0
    ) {
      return;
    }

    if (!silent) {
      setBusy(true);
      setError(null);
    }

    try {
      const routes: MessageRoute[] = [];

      // Build private candidate routes for every participant known locally.
      for (const participant of participants) {
        const directKey = await deriveDirectMessageKey(
          roomId,
          messagingIdentity.privateKey,
          participant.publicKey,
        );

        // Incoming action: the opaque recipient tag represents this wallet.
        routes.push({
          recipientIdentity: session.account.address,
          encryptionKey: directKey,
          routingKey: directKey,
        });

        // Outgoing action: the opaque recipient tag represents the peer.
        routes.push({
          recipientIdentity: participant.address,
          encryptionKey: directKey,
          routingKey: directKey,
        });
      }

      // The backend returns ciphertext only; decryption remains local.
      const discovered = await discoverOfferActions(
        BACKEND_URL,
        channelKey,
        routes,
      );

      const self = session.account.address.toLowerCase();

      // Only keep direct actions whose encrypted participants include this wallet
      // and one participant currently known in this room.
      const knownPeers = new Set(
        participants.map((participant) =>
          participant.address.toLowerCase(),
        ),
      );

      const incomingEntries = discovered
        .filter((item) => {
          const sender =
            item.action.senderAddress?.toLowerCase() ?? "";
          const recipient =
            item.action.recipientAddress?.toLowerCase() ?? "";

          if (!sender || !recipient) return false;

          const peer =
            sender === self
              ? recipient
              : recipient === self
                ? sender
                : "";

          return Boolean(peer) && knownPeers.has(peer);
        })
        .map<ConversationEntry>((item) => ({
          id: `offer:${stripLocator(item.actionLocator)}`,
          kind: "offer",
          summary: summarizeOffer(item.action),
          transactionHash: item.transactionHash,
          actionLocator: stripLocator(item.actionLocator),
          // New direct Offer actions always carry encrypted sentAt metadata.
          // Keep a deterministic old fallback instead of treating block height as time.
          sentAt:
            item.action.sentAt ??
            "1970-01-01T00:00:00.000Z",
          scope: "direct",
          senderAddress: item.action.senderAddress,
          recipientAddress: item.action.recipientAddress,
          offerAction: item.action,
        }));

      // Merge by immutable action locator so polling never duplicates cards.
      setOfferEntries((previous) => {
        const byLocator = new Map(
          previous.map((entry) => [
            stripLocator(entry.actionLocator),
            entry,
          ]),
        );

        for (const entry of incomingEntries) {
          const key = stripLocator(entry.actionLocator);
          const existing = byLocator.get(key);

          byLocator.set(key, {
            ...existing,
            ...entry,
            sentAt:
              entry.sentAt === "1970-01-01T00:00:00.000Z"
                ? existing?.sentAt ?? entry.sentAt
                : entry.sentAt,
          });
        }

        return [...byLocator.values()].sort(
          (left, right) =>
            new Date(left.sentAt).getTime() -
            new Date(right.sentAt).getTime(),
        );
      });
    } catch (err) {
      // Detailed discovery errors stay in the developer console.
      console.error("[VINSS OFFER DISCOVERY FAILED]", err);

      // Silent background polling must never interrupt the chat UI.
      if (!silent) {
        setError(
          humanizeError(
            err,
            "We couldn't refresh private offers. Please try again.",
          ),
        );
      }
    } finally {
      if (!silent) {
        setBusy(false);
      }
    }
  }

  /**
   * Run one wallet-backed Offer action behind a consistent error boundary.
   */
  async function runOfferAction(
    scope: string,
    fallbackMessage: string,
    action: () => Promise<void>,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);

    try {
      await action();

      // Refresh silently after local insertion to reconcile with on-chain data.
      await handleOfferRefresh(true);

      return true;
    } catch (err) {
      // Raw wallet/RPC detail is intentionally console-only.
      console.error(`[VINSS OFFER ${scope} ERROR]`, err);

      // The visible message stays short and safe.
      setError(humanizeError(err, fallbackMessage));

      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Create a new direct Offer for the participant selected in Chat.
   */
  async function createDirectOffer(
    peerAddress: string,
    terms: OfferTermsInput,
  ): Promise<boolean> {
    if (!session || !channelKey) {
      setError("Connect your wallet before creating an offer.");
      return false;
    }

    return runOfferAction(
      "CREATE",
      "We couldn't create the offer. Please try again.",
      async () => {
        // Outgoing routing tags must represent the selected peer.
        const { peer, route } =
          await resolveDirectContext(
            peerAddress,
            peerAddress,
          );

        // Participant identity and ordering metadata remain encrypted.
        const action: Omit<OfferActionPayload, "kind"> = {
          ...terms,
          senderAddress: session.account.address,
          recipientAddress: peer.address,
          sentAt: new Date().toISOString(),
        };

        // Send through the same Alice<->Bob direct key used by private chat.
        const result = await createOffer(
          session.account,
          channelKey,
          action,
          route,
        );

        // Reflect confirmed wallet output immediately in the direct chat.
        appendLocalOffer(result, {
          ...action,
          kind: "create",
        });
      },
    );
  }

  /**
   * Counter the exact immutable action selected from the direct chat.
   */
  async function counterDirectOffer(
    source: ConversationEntry,
    terms: OfferTermsInput,
  ): Promise<boolean> {
    if (!session || !channelKey || !source.offerAction) {
      setError("This offer cannot be countered right now.");
      return false;
    }

    const sourceAction = source.offerAction;

    // A counter is valid only for the encrypted recipient of the parent action.
    if (
      sourceAction.recipientAddress?.toLowerCase() !==
      session.account.address.toLowerCase()
    ) {
      setError("Only the current recipient can counter this offer.");
      return false;
    }

    const peerAddress = sourceAction.senderAddress;

    if (!peerAddress) {
      setError("The offer counterparty could not be resolved.");
      return false;
    }

    return runOfferAction(
      "COUNTER",
      "We couldn't send the counter offer. Please try again.",
      async () => {
        // Counter goes back to the sender of the parent action.
        const { peer, route } =
          await resolveDirectContext(
            peerAddress,
            peerAddress,
          );

        // Keep root and parent relationships inside ciphertext.
        const rootOfferLocator =
          sourceAction.rootOfferLocator ??
          canonicalLocator(source.actionLocator);

        const action: Omit<OfferActionPayload, "kind"> = {
          ...terms,
          rootOfferLocator,
          parentOfferLocator:
            canonicalLocator(source.actionLocator),
          senderAddress: session.account.address,
          recipientAddress: peer.address,
          sentAt: new Date().toISOString(),
        };

        // Every counter is a new immutable on-chain action.
        const result = await counterOffer(
          session.account,
          channelKey,
          action,
          route,
        );

        appendLocalOffer(result, {
          ...action,
          kind: "counter",
        });
      },
    );
  }

  /**
   * Accept the latest incoming create/counter action.
   */
  async function acceptDirectOffer(
    source: ConversationEntry,
  ): Promise<boolean> {
    if (!session || !channelKey || !source.offerAction) {
      setError("This offer cannot be accepted right now.");
      return false;
    }

    const sourceAction = source.offerAction;

    if (
      sourceAction.recipientAddress?.toLowerCase() !==
      session.account.address.toLowerCase()
    ) {
      setError("Only the current recipient can accept this offer.");
      return false;
    }

    const peerAddress = sourceAction.senderAddress;

    if (!peerAddress) {
      setError("The offer counterparty could not be resolved.");
      return false;
    }

    return runOfferAction(
      "ACCEPT",
      "We couldn't accept the offer. Please try again.",
      async () => {
        // The acceptance action returns to the sender of the current terms.
        const { peer, route } =
          await resolveDirectContext(
            peerAddress,
            peerAddress,
          );

        // Copy the accepted terms into the encrypted acceptance action so
        // the final agreement remains self-contained for both clients.
        const action: Omit<OfferActionPayload, "kind"> = {
          dealType: sourceAction.dealType,
          rootOfferLocator:
            sourceAction.rootOfferLocator ??
            canonicalLocator(source.actionLocator),
          parentOfferLocator:
            canonicalLocator(source.actionLocator),
          asset: sourceAction.asset,
          amount: sourceAction.amount,
          paymentTerms: sourceAction.paymentTerms,
          conditions: sourceAction.conditions,
          expiresAt: sourceAction.expiresAt,
          senderAddress: session.account.address,
          recipientAddress: peer.address,
          sentAt: new Date().toISOString(),
        };

        const result = await acceptOffer(
          session.account,
          channelKey,
          action,
          route,
        );

        appendLocalOffer(result, {
          ...action,
          kind: "accept",
        });
      },
    );
  }

  /**
   * Reject the latest incoming create/counter action.
   */
  async function rejectDirectOffer(
    source: ConversationEntry,
  ): Promise<boolean> {
    if (!session || !channelKey || !source.offerAction) {
      setError("This offer cannot be rejected right now.");
      return false;
    }

    const sourceAction = source.offerAction;

    if (
      sourceAction.recipientAddress?.toLowerCase() !==
      session.account.address.toLowerCase()
    ) {
      setError("Only the current recipient can reject this offer.");
      return false;
    }

    const peerAddress = sourceAction.senderAddress;

    if (!peerAddress) {
      setError("The offer counterparty could not be resolved.");
      return false;
    }

    return runOfferAction(
      "REJECT",
      "We couldn't reject the offer. Please try again.",
      async () => {
        // The rejection action returns to the sender of the current terms.
        const { peer, route } =
          await resolveDirectContext(
            peerAddress,
            peerAddress,
          );

        const action: Omit<OfferActionPayload, "kind"> = {
          dealType: sourceAction.dealType,
          rootOfferLocator:
            sourceAction.rootOfferLocator ??
            canonicalLocator(source.actionLocator),
          parentOfferLocator:
            canonicalLocator(source.actionLocator),
          asset: sourceAction.asset,
          amount: sourceAction.amount,
          paymentTerms: sourceAction.paymentTerms,
          conditions: sourceAction.conditions,
          expiresAt: sourceAction.expiresAt,
          senderAddress: session.account.address,
          recipientAddress: peer.address,
          sentAt: new Date().toISOString(),
        };

        const result = await rejectOffer(
          session.account,
          channelKey,
          action,
          route,
        );

        appendLocalOffer(result, {
          ...action,
          kind: "reject",
        });
      },
    );
  }

  useEffect(() => {
    // Poll only while Chat or Offer UI is active and private routing is ready.
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

    const sync = async () => {
      if (stopped || running) return;

      running = true;

      try {
        await handleOfferRefresh(true);
      } finally {
        running = false;
      }
    };

    // Sync once immediately so both sides see new lifecycle actions after reload.
    void sync();

    const timer = window.setInterval(() => {
      void sync();
    }, 3000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
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
    session?.account.address,
    channelKey,
    messagingIdentity?.publicKey,
    participantFingerprint,
  ]);

  return {
    offerEntries,
    createDirectOffer,
    counterDirectOffer,
    acceptDirectOffer,
    rejectDirectOffer,
    handleOfferRefresh,
  };
}
