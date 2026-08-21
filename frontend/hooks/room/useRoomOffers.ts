"use client";

import { useEffect, useRef, useState } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { BACKEND_URL } from "@/lib/starknet/constants";
import {
  acceptOffer,
  counterOffer,
  createOffer,
  discoverOfferActions,
  prepareEscrowFromOffer,
  rejectOffer,
} from "@/lib/deal-room/offers";
import {
  canonicalStarknetAddress,
  deriveDirectMessageKey,
  getOrCreateMessagingIdentity,
  sameStarknetAddress,
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
import {
  pollPresence,
  publishPresence,
} from "@/lib/privacy/presence";
import {
  loadEncryptedLocalJson,
  saveEncryptedLocalJson,
} from "@/lib/privacy/encryptedChatCache";

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
  selfRoutingIdentities: string[];
  active: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

interface DirectOfferContext {
  peer: RoomParticipant;
  route: MessageRoute;
}

// Keep UI locators normalized without changing the on-chain felt value.
function stripLocator(
  locator: string | null | undefined,
): string {
  return typeof locator === "string"
    ? locator
        .replace(/^0x/, "")
        .toLowerCase()
    : "";
}

// Store lifecycle parent/root references as explicit hex strings.
function canonicalLocator(locator: string): string {
  return `0x${stripLocator(locator)}`;
}

function uniqueOfferRoutingIdentities(
  identities: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const identity of identities) {
    if (!identity?.trim()) continue;

    const exact = identity.trim().toLowerCase();

    if (!seen.has(exact)) {
      seen.add(exact);
      result.push(identity.trim());
    }
  }

  return result;
}

// Produce a compact Agent/UI summary without leaking it outside local state.
function summarizeOffer(action: OfferActionPayload): string {
  if (action.kind === "prepare_escrow") {
    const deal =
      action.dealType
        ?.replace(/_/g, " ") ??
      "deal";

    return `Rekber ready — ${deal} · ${action.amount} ${action.asset}`;
  }

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
  selfRoutingIdentities,
  active,
  setBusy,
  setError,
}: UseRoomOffersOptions) {
  // Offer entries are intentionally separate from generic message state.
  const [offerEntries, setOfferEntries] = useState<ConversationEntry[]>([]);

  // Reuse the same per-room non-exportable ECDH identity used by direct chat.
  const [messagingIdentity, setMessagingIdentity] =
    useState<MessagingIdentity | null>(null);

  const sentOfferReadReceiptsRef =
    useRef<Set<string>>(new Set());

  // Stabilize the participant dependency so chat refreshes do not constantly
  // restart the Offer discovery interval with an equivalent participant set.
  const participantFingerprint = participants
    .map(
      (participant) =>
        `${participant.address.toLowerCase()}:${participant.publicKey}`,
    )
    .sort()
    .join("|");

  function offerHistoryStorageKey():
    string | null {
    if (
      !roomId ||
      !session
    ) {
      return null;
    }

    return (
      `vinss:offer-history:v1:${roomId}:` +
      canonicalStarknetAddress(
        session.account.address,
      )
    );
  }

  async function persistOfferHistory(
    next:
      ConversationEntry[],
  ): Promise<void> {
    const storageKey =
      offerHistoryStorageKey();

    if (
      !storageKey ||
      !channelKey
    ) {
      return;
    }

    await saveEncryptedLocalJson(
      storageKey,
      channelKey,
      {
        version: 1,
        savedAt: Date.now(),
        entries: next,
      },
    );
  }

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

  useEffect(() => {
    if (
      !roomId ||
      !session ||
      !channelKey
    ) {
      return;
    }

    let cancelled = false;

    const hydrate =
      async () => {
        const storageKey =
          offerHistoryStorageKey();

        if (!storageKey) {
          return;
        }

        const cached =
          await loadEncryptedLocalJson<{
            version: 1;
            savedAt: number;
            entries:
              ConversationEntry[];
          }>(
            storageKey,
            channelKey,
          );

        if (
          cancelled ||
          !cached?.entries
            ?.length
        ) {
          return;
        }

        setOfferEntries(
          (previous) =>
            previous.length > 0
              ? previous
              : cached.entries,
        );
      };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    roomId,
    session?.account.address,
    channelKey,
  ]);

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
        sameStarknetAddress(
          participant.address,
          peerAddress,
        ),
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
        // Canonical felt formatting makes future Alice -> Bob and Bob -> Alice
        // Offer routing independent from wallet leading-zero address formatting.
        recipientIdentity:
          canonicalStarknetAddress(
            recipientIdentity,
          ),
        encryptionKey: directKey,
        routingKey: directKey,
      },
    };
  }

  // Reflect a prepared action before Ready X takes over the mobile screen.
  // The locator is the exact on-chain identity used by later discovery.
  function appendPreparedOffer(
    actionLocator: bigint,
    action: OfferActionPayload,
  ) {
    const entry: ConversationEntry = {
      id: `offer:${actionLocator.toString(16)}`,
      kind: "offer",
      summary: summarizeOffer(action),
      transactionHash: "",
      actionLocator:
        actionLocator.toString(16),
      sentAt:
        action.sentAt ??
        new Date().toISOString(),
      scope: "direct",
      senderAddress:
        action.senderAddress,
      recipientAddress:
        action.recipientAddress,
      offerAction: action,
    };

    setOfferEntries((previous) => {
      const withoutSameLocator =
        previous.filter(
          (item) =>
            stripLocator(
              item.actionLocator,
            ) !==
            stripLocator(
              entry.actionLocator,
            ),
        );

      const next = [
        ...withoutSameLocator,
        entry,
      ].sort(
        (left, right) =>
          new Date(
            left.sentAt,
          ).getTime() -
          new Date(
            right.sentAt,
          ).getTime(),
      );

      void persistOfferHistory(
        next,
      );

      return next;
    });
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

      const next = [
        ...withoutSameLocator,
        entry,
      ].sort(
        (left, right) =>
          new Date(
            left.sentAt,
          ).getTime() -
          new Date(
            right.sentAt,
          ).getTime(),
      );

      void persistOfferHistory(
        next,
      );

      return next;
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

        // Incoming actions may have used any exact address string this wallet
        // previously announced. Try those aliases plus canonical felt form.
        for (const identity of uniqueOfferRoutingIdentities([
          session.account.address,
          ...selfRoutingIdentities,
          canonicalStarknetAddress(
            session.account.address,
          ),
        ])) {
          routes.push({
            recipientIdentity: identity,
            encryptionKey: directKey,
            routingKey: directKey,
          });
        }

        // Outgoing history may contain the peer's old textual address form.
        for (const identity of uniqueOfferRoutingIdentities([
          participant.address,
          canonicalStarknetAddress(
            participant.address,
          ),
        ])) {
          routes.push({
            recipientIdentity: identity,
            encryptionKey: directKey,
            routingKey: directKey,
          });
        }
      }

      // The backend returns ciphertext only; decryption remains local.
      const discovered = await discoverOfferActions(
        BACKEND_URL,
        channelKey,
        routes,
      );

      const self =
        canonicalStarknetAddress(
          session.account.address,
        );

      // Only keep direct actions whose encrypted participants include this wallet
      // and one participant currently known in this room.
      const knownPeers = new Set(
        participants.map((participant) =>
          canonicalStarknetAddress(
            participant.address,
          ),
        ),
      );

      const incomingEntries = discovered
        .filter((item) => {
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

        const next =
          [...byLocator.values()]
            .sort(
              (left, right) =>
                new Date(
                  left.sentAt,
                ).getTime() -
                new Date(
                  right.sentAt,
                ).getTime(),
            );

        void persistOfferHistory(
          next,
        );

        return next;
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

  async function markOfferRead(
    source: ConversationEntry,
  ): Promise<void> {
    if (
      !session ||
      !source.offerAction ||
      !source.transactionHash
    ) {
      return;
    }

    const action = source.offerAction;

    if (
      !sameStarknetAddress(
        action.recipientAddress,
        session.account.address,
      )
    ) {
      return;
    }

    const peerAddress = action.senderAddress;
    if (!peerAddress) return;

    const locator =
      stripLocator(source.actionLocator);
    const receiptId =
      `offer:${locator}`;

    if (
      sentOfferReadReceiptsRef.current.has(
        receiptId,
      )
    ) {
      return;
    }

    try {
      const { peer } =
        await resolveDirectContext(
          peerAddress,
          session.account.address,
        );

      const directKey =
        await deriveDirectMessageKey(
          roomId!,
          messagingIdentity!.privateKey,
          peer.publicKey,
        );

      sentOfferReadReceiptsRef.current.add(
        receiptId,
      );

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
          messageLocator: receiptId,
        },
        24 * 60 * 60 * 1000,
      );
    } catch (err) {
      sentOfferReadReceiptsRef.current.delete(
        receiptId,
      );

      console.error(
        "[VINSS OFFER READ RECEIPT ERROR]",
        err,
      );
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

      // Local confirmed state is already inserted. Reconcile ciphertext
      // discovery in the background so backend/indexer latency does not keep
      // the user-facing wallet action stuck in a loading state.
      void handleOfferRefresh(true);

      return true;
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      // Ready X may submit successfully and still return late after a mobile
      // background/remount. A timeout is therefore a pending result until
      // encrypted discovery reconciles the exact prepared Offer locator.
      const callbackDelayed =
        /(?:timeout|timed out)/i.test(
          raw,
        );

      if (callbackDelayed) {
        console.warn(
          `[VINSS OFFER ${scope} CALLBACK DELAYED]`,
          err,
        );

        setError(null);

        // Return to Chat. The prepared card remains visible and normal Offer
        // polling fills its transaction hash when discovery sees the event.
        void handleOfferRefresh(true);
        return true;
      }

      // Raw wallet/RPC detail is intentionally console-only.
      console.error(
        `[VINSS OFFER ${scope} ERROR]`,
        err,
      );

      // The visible message stays short and safe.
      setError(
        humanizeError(
          err,
          fallbackMessage,
        ),
      );

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
          (prepared) => {
            appendPreparedOffer(
              prepared.actionLocator,
              {
                ...action,
                kind: "create",
              },
            );
          },
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
      !sameStarknetAddress(
        sourceAction.recipientAddress,
        session.account.address,
      )
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
          (prepared) => {
            appendPreparedOffer(
              prepared.actionLocator,
              {
                ...action,
                kind: "counter",
              },
            );
          },
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
      !sameStarknetAddress(
        sourceAction.recipientAddress,
        session.account.address,
      )
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
          (prepared) => {
            appendPreparedOffer(
              prepared.actionLocator,
              {
                ...action,
                kind: "accept",
              },
            );
          },
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
      !sameStarknetAddress(
        sourceAction.recipientAddress,
        session.account.address,
      )
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
          (prepared) => {
            appendPreparedOffer(
              prepared.actionLocator,
              {
                ...action,
                kind: "reject",
              },
            );
          },
        );

        appendLocalOffer(result, {
          ...action,
          kind: "reject",
        });
      },
    );
  }


  /**
   * Move one immutable accepted Offer into the explicit prepare_escrow state.
   * Either party to the accepted direct Offer may prepare it.
   */
  async function prepareEscrowDirectOffer(
    source: ConversationEntry,
  ): Promise<boolean> {
    if (
      !session ||
      !channelKey ||
      !source.offerAction ||
      source.offerAction.kind !== "accept"
    ) {
      setError(
        "Escrow can only be prepared from an accepted offer.",
      );
      return false;
    }

    const sourceAction =
      source.offerAction;

    const self =
      session.account.address;

    const peerAddress =
      sameStarknetAddress(
        sourceAction.senderAddress,
        self,
      )
        ? sourceAction.recipientAddress
        : sameStarknetAddress(
              sourceAction.recipientAddress,
              self,
            )
          ? sourceAction.senderAddress
          : undefined;

    if (!peerAddress) {
      setError(
        "The accepted offer counterparty could not be resolved.",
      );
      return false;
    }

    return runOfferAction(
      "PREPARE_ESCROW",
      "We couldn't prepare this accepted offer for escrow. Please try again.",
      async () => {
        const { peer, route } =
          await resolveDirectContext(
            peerAddress,
            peerAddress,
          );

        const action:
          Omit<
            OfferActionPayload,
            "kind"
          > = {
          dealType:
            sourceAction.dealType,
          rootOfferLocator:
            sourceAction.rootOfferLocator ??
            sourceAction.parentOfferLocator ??
            canonicalLocator(
              source.actionLocator,
            ),
          parentOfferLocator:
            canonicalLocator(
              source.actionLocator,
            ),
          asset:
            sourceAction.asset,
          amount:
            sourceAction.amount,
          paymentTerms:
            sourceAction.paymentTerms,
          conditions:
            sourceAction.conditions,
          expiresAt:
            sourceAction.expiresAt,
          senderAddress:
            self,
          recipientAddress:
            peer.address,
          sentAt:
            new Date().toISOString(),
        };

        // Ready X can execute successfully on-chain while its in-page
        // callback later rejects with "Timeout". For prepare_escrow we do not
        // make that callback the source of truth: once the exact prepared
        // locator is known, race the wallet callback against ciphertext
        // discovery of that same locator.
        let preparedLocator!: bigint;
        let preparedCommitment!: bigint;
        let signalPrepared:
          (() => void) | null = null;

        const preparedReady =
          new Promise<void>((resolve) => {
            signalPrepared = resolve;
          });

        const walletPromise =
          prepareEscrowFromOffer(
            session.account,
            channelKey,
            action,
            route,
            (prepared) => {
              preparedLocator =
                prepared.actionLocator;
              preparedCommitment =
                prepared.payloadCommitment;

              appendPreparedOffer(
                prepared.actionLocator,
                {
                  ...action,
                  kind:
                    "prepare_escrow",
                },
              );

              signalPrepared?.();
            },
          );

        await preparedReady;

        const locator =
          preparedLocator;
        const commitment =
          preparedCommitment;
        const locatorKey =
          stripLocator(
            locator.toString(16),
          );

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
                  await discoverOfferActions(
                    BACKEND_URL,
                    channelKey,
                    route,
                  );

                const match =
                  discovered.find(
                    (item) =>
                      stripLocator(
                        item.actionLocator,
                      ) === locatorKey,
                  );

                if (match) {
                  return match;
                }
              } catch {
                // Indexer/backend may be briefly behind the chain.
              }

              await new Promise<void>(
                (resolve) =>
                  window.setTimeout(
                    resolve,
                    1500,
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
              kind: "wallet_error" as const,
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

        if (
          first.kind === "wallet"
        ) {
          stopDiscovery = true;

          appendLocalOffer(
            first.result,
            {
              ...action,
              kind:
                "prepare_escrow",
            },
          );

          return;
        }

        if (
          first.kind === "discovery" &&
          first.match
        ) {
          stopDiscovery = true;

          void walletPromise.catch(
            (err) => {
              const raw =
                err instanceof Error
                  ? err.message
                  : String(err);

              if (
                !/(?:timeout|timed out)/i.test(
                  raw,
                )
              ) {
                console.error(
                  "[VINSS OFFER PREPARE_ESCROW LATE WALLET ERROR]",
                  err,
                );
              }
            },
          );

          appendLocalOffer(
            {
              transactionHash:
                first.match
                  .transactionHash,
              actionLocator:
                locator,
              payloadCommitment:
                commitment,
            },
            {
              ...action,
              kind:
                "prepare_escrow",
            },
          );

          return;
        }

        if (
          first.kind ===
          "wallet_error"
        ) {
          const raw =
            first.error instanceof Error
              ? first.error.message
              : String(first.error);

          if (
            !/(?:timeout|timed out)/i.test(
              raw,
            )
          ) {
            stopDiscovery = true;
            throw first.error;
          }

          const confirmed =
            await confirmationPromise;

          stopDiscovery = true;

          if (confirmed) {
            appendLocalOffer(
              {
                transactionHash:
                  confirmed
                    .transactionHash,
                actionLocator:
                  locator,
                payloadCommitment:
                  commitment,
              },
              {
                ...action,
                kind:
                  "prepare_escrow",
              },
            );

            return;
          }

          throw first.error;
        }

        const result =
          await walletPromise;

        stopDiscovery = true;

        appendLocalOffer(
          result,
          {
            ...action,
            kind:
              "prepare_escrow",
          },
        );
      },
    );
  }

  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !session ||
      !messagingIdentity ||
      !participantFingerprint
    ) {
      return;
    }

    let stopped = false;
    let running = false;

    const pollOfferReads = async () => {
      if (stopped || running) return;

      running = true;

      try {
        const readByLocator =
          new Map<string, string>();

        for (const participant of participants) {
          const directKey =
            await deriveDirectMessageKey(
              roomId,
              messagingIdentity.privateKey,
              participant.publicKey,
            );

          const events =
            await pollPresence(
              BACKEND_URL,
              directKey,
            );

          for (const event of events) {
            if (
              event.type !== "read" ||
              !event.messageLocator ||
              !event.messageLocator.startsWith(
                "offer:",
              ) ||
              !sameStarknetAddress(
                event.senderAddress,
                participant.address,
              )
            ) {
              continue;
            }

            readByLocator.set(
              stripLocator(
                event.messageLocator.slice(
                  "offer:".length,
                ),
              ),
              event.sentAt,
            );
          }
        }

        if (
          stopped ||
          readByLocator.size === 0
        ) {
          return;
        }

        setOfferEntries((previous) =>
          previous.map((entry) => {
            if (
              entry.scope !== "direct" ||
              !sameStarknetAddress(
                entry.senderAddress,
                session.account.address,
              )
            ) {
              return entry;
            }

            const readAt =
              readByLocator.get(
                stripLocator(
                  entry.actionLocator,
                ),
              );

            return readAt
              ? {
                  ...entry,
                  readAt:
                    entry.readAt ?? readAt,
                }
              : entry;
          }),
        );
      } catch (err) {
        console.error(
          "[VINSS OFFER READ POLL ERROR]",
          err,
        );
      } finally {
        running = false;
      }
    };

    void pollOfferReads();

    const timer = window.setInterval(
      () => {
        void pollOfferReads();
      },
      1500,
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [
    active,
    roomId,
    session?.account.address,
    messagingIdentity?.publicKey,
    participantFingerprint,
  ]);

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
    }, 5000);

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
    selfRoutingIdentities.join("|"),
  ]);

  return {
    offerEntries,
    createDirectOffer,
    counterDirectOffer,
    acceptDirectOffer,
    rejectDirectOffer,
    prepareEscrowDirectOffer,
    markOfferRead,
    handleOfferRefresh,
  };
}
