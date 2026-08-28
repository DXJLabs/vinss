"use client";

import { useEffect, useRef, useState } from "react";
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
  buildOfferSettlementPlan,
} from "@/lib/deal-room/settlementPlan";
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
  reason?: string;
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

  // One Offer action can be prepared before the mobile wallet returns.
  // Keep that optimistic locator isolated so a failed wallet attempt can
  // be removed without touching confirmed Offer history.
  const activePreparedOfferLocatorsRef =
    useRef<Set<string>>(new Set());

  const startOfferCallbackTimeoutRef =
    useRef<(() => void) | null>(null);

  /*
   * A delayed Ready X callback may reconcile after the user has already
   * started another Offer action. Generation guards prevent an old recovery
   * task from changing the UI state of a newer action.
   */
  const offerRecoveryGenerationRef =
    useRef(0);

  // Locally remember which pairwise route actually decrypted each action.
  // Lifecycle replies must use this proven route instead of re-deriving a
  // key from a participant announcement that may have changed meanwhile.
  const matchedOfferRoutesRef =
    useRef<Map<string, MessageRoute>>(new Map());

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
    matchedOfferRoutesRef.current.clear();
    sentOfferReadReceiptsRef.current.clear();
  }, [roomId, session?.account.address]);

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

  /**
   * Resolve a lifecycle reply for one authenticated immutable parent.
   *
   * The historical matched route proves this wallet actually decrypted the
   * parent Offer. It must NOT become the encryption key for a new action:
   * Counter/Accept/Reject always use the current Alice<->Bob pairwise key so
   * both wallets derive the same route from their active room identities.
   */
  async function resolveReplyContext(
    source: ConversationEntry,
    peerAddress: string,
  ): Promise<DirectOfferContext> {
    const parentLocator =
      stripLocator(
        source.actionLocator,
      );

    let matchedRoute =
      matchedOfferRoutesRef.current.get(
        parentLocator,
      );

    /*
     * Cached cards can render before discovery authenticates their ciphertext.
     * Refresh once before allowing a lifecycle reply.
     */
    if (!matchedRoute) {
      await handleOfferRefresh(true);

      matchedRoute =
        matchedOfferRoutesRef.current.get(
          parentLocator,
        );
    }

    if (!matchedRoute) {
      throw new Error(
        "The private parent Offer is not authenticated yet. Sync the room and try again.",
      );
    }

    /*
     * Parent authentication and reply routing are deliberately separate.
     * Reusing a historical ECDH route can create a valid on-chain Counter that
     * only the sender can render locally while the recipient cannot decrypt it.
     */
    return resolveDirectContext(
      peerAddress,
      peerAddress,
    );
  }

  // Reflect a prepared action before Ready X takes over the mobile screen.
  // The locator is the exact on-chain identity used by later discovery.
  /*
   * Prepared Offer state exists only for the Ready X handoff.
   * It has no transaction hash and must be removable after a real wallet
   * failure so create/counter/accept/reject can safely be retried.
   */
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

    const preparedLocator =
      stripLocator(
        entry.actionLocator,
      );

    activePreparedOfferLocatorsRef
      .current.add(
        preparedLocator,
      );

    // The callback timer starts here, after FeePolicy/config preflight,
    // immediately before Ready X is invoked.
    startOfferCallbackTimeoutRef
      .current?.();

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
  /*
   * A wallet-confirmed action replaces its optimistic copy by immutable
   * action locator. Never create a second lifecycle record for the same tx.
   */
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

    activePreparedOfferLocatorsRef
      .current.delete(
        stripLocator(
          entry.actionLocator,
        ),
      );

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
  /*
   * Offer discovery remains keyless on the backend.
   * Candidate routes and ciphertext decryption are evaluated only client-side.
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

      for (const item of discovered) {
        matchedOfferRoutesRef.current.set(
          stripLocator(item.actionLocator),
          item.matchedRoute,
        );
      }

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
      const { route } =
        await resolveReplyContext(
          source,
          peerAddress,
        );

      const directKey =
        route.encryptionKey ?? channelKey;

      if (!directKey) return;

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

  function discardPreparedOffers(
    locators: Set<string>,
  ) {
    if (locators.size === 0) {
      return;
    }

    setOfferEntries((previous) => {
      const next =
        previous.filter(
          (entry) =>
            Boolean(
              entry.transactionHash,
            ) ||
            !locators.has(
              stripLocator(
                entry.actionLocator,
              ),
            ),
        );

      void persistOfferHistory(
        next,
      );

      return next;
    });

    for (const locator of locators) {
      activePreparedOfferLocatorsRef
        .current.delete(locator);
    }
  }

  /*
   * Ready X can submit successfully while its mobile callback arrives late.
   * Keep the prepared card during a short reconciliation window and let
   * encrypted Offer discovery decide whether the immutable action exists.
   *
   * Only after repeated successful polling fails to find the locator do we
   * remove the optimistic card and allow the user to retry.
   */
  async function recoverDelayedOffer(
    locators: Set<string>,
    generation: number,
  ): Promise<void> {
    const attempts = 8;

    for (
      let attempt = 0;
      attempt < attempts;
      attempt += 1
    ) {
      if (
        offerRecoveryGenerationRef.current !==
        generation
      ) {
        return;
      }

      await handleOfferRefresh(true);

      const confirmed =
        [...locators].every(
          (locator) =>
            matchedOfferRoutesRef.current.has(
              locator,
            ),
        );

      if (confirmed) {
        setError(null);
        return;
      }

      await new Promise<void>(
        (resolve) =>
          window.setTimeout(
            resolve,
            5_000,
          ),
      );
    }

    if (
      offerRecoveryGenerationRef.current !==
      generation
    ) {
      return;
    }

    discardPreparedOffers(
      locators,
    );

    setError(
      "Offer was not confirmed. You can try again.",
    );
  }

  /**
   * Run one wallet-backed Offer action.
   *
   * The timeout starts only after Offer preflight has completed and Ready X
   * is about to receive the transaction. A real wallet/RPC failure removes
   * the temporary card so Accept/Counter/Reject can be tried again.
   */
  async function runOfferAction(
    scope: string,
    fallbackMessage: string,
    action: (
      markPrepared: () => void,
    ) => Promise<void>,
    onWalletHandoff?: () => void,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);

    const recoveryGeneration =
      ++offerRecoveryGenerationRef.current;

    activePreparedOfferLocatorsRef.current =
      new Set();

    let callbackTimer:
      number | null = null;

    let startCallbackTimeout:
      (() => void) | null = null;

    let walletHandoffNotified =
      false;

    const callbackTimeoutPromise =
      new Promise<never>(
        (_, reject) => {
          startCallbackTimeout =
            () => {
              if (
                callbackTimer !== null
              ) {
                return;
              }

              callbackTimer =
                window.setTimeout(
                  () =>
                    reject(
                      new Error(
                        `VINSS_OFFER_${scope}_CALLBACK_TIMEOUT`,
                      ),
                    ),
                  25_000,
                );
            };
        },
      );

    startOfferCallbackTimeoutRef.current =
      startCallbackTimeout;

    try {
      await Promise.race([
        action(() => {
          startCallbackTimeout?.();

          /*
           * UI navigation is independent from blockchain confirmation.
           * Once Ready X receives the prepared action, return the user-facing
           * surface to Chat while immutable confirmation continues in background.
           */
          if (
            !walletHandoffNotified
          ) {
            walletHandoffNotified =
              true;
            onWalletHandoff?.();
          }
        }),
        callbackTimeoutPromise,
      ]);

      void handleOfferRefresh(true);
      return true;
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      const prepared =
        new Set(
          activePreparedOfferLocatorsRef
            .current,
        );

      const callbackDelayed =
        raw.includes(
          `VINSS_OFFER_${scope}_CALLBACK_TIMEOUT`,
        );

      const explicitUserCancellation =
        /USER_REFUSED|USER_REJECTED|REJECTED_BY_USER|CANCELLED_BY_USER|ACTION_REJECTED/i.test(
          raw,
        );

      const hasPreparedAction =
        prepared.size > 0;

      /*
       * Blockchain state is authoritative.
       *
       * Ready/Mises may return a generic error even after the private action
       * was successfully submitted. Any post-preparation error is therefore
       * reconciled against encrypted on-chain discovery unless the user
       * explicitly rejected/cancelled the wallet request.
       */
      if (
        callbackDelayed ||
        (
          hasPreparedAction &&
          !explicitUserCancellation
        )
      ) {
        console.warn(
          `[VINSS OFFER ${scope} WALLET RESULT AMBIGUOUS]`,
          err,
        );

        setError(null);

        void recoverDelayedOffer(
          prepared,
          recoveryGeneration,
        );

        return true;
      }

      // Explicit cancellation, or a failure before preparation, cannot have
      // produced the prepared immutable Offer action and can safely be retried.
      discardPreparedOffers(
        prepared,
      );

      console.error(
        `[VINSS OFFER ${scope} ERROR]`,
        err,
      );

      setError(
        humanizeError(
          err,
          fallbackMessage,
        ),
      );

      return false;
    } finally {
      if (
        callbackTimer !== null
      ) {
        window.clearTimeout(
          callbackTimer,
        );
      }

      startOfferCallbackTimeoutRef.current =
        null;

      activePreparedOfferLocatorsRef.current =
        new Set();

      setBusy(false);
    }
  }

  /**
   * Create a new direct Offer for the participant selected in Chat.
   */
  async function createDirectOffer(
    peerAddress: string,
    terms: OfferTermsInput,
    onWalletHandoff?: () => void,
  ): Promise<boolean> {
    if (!session || !channelKey) {
      setError("Connect your wallet before creating an offer.");
      return false;
    }

    return runOfferAction(
      "CREATE",
      "We couldn't create the offer. Please try again.",
      async (markPrepared) => {
        // Outgoing routing tags must represent the selected peer.
        const { peer, route } =
          await resolveDirectContext(
            peerAddress,
            peerAddress,
          );

        // The original Offer explicitly fixes Rekber roles.
        // These roles stay encrypted with the private Offer terms.
        const settlementPlan =
          buildOfferSettlementPlan({
            dealType: terms.dealType,
            payerAddress:
              session.account.address,
            payeeAddress:
              peer.address,
          });

        // Participant identity, settlement policy and ordering metadata
        // remain encrypted.
        const action: Omit<OfferActionPayload, "kind"> = {
          ...terms,
          settlementPlan,
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
            markPrepared();

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
      onWalletHandoff,
    );
  }

  /**
   * Counter the exact immutable action selected from the direct chat.
   */
  async function counterDirectOffer(
    source: ConversationEntry,
    terms: OfferTermsInput,
    onWalletHandoff?: () => void,
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
      async (markPrepared) => {
        // Counter goes back to the sender of the parent action.
        const { peer, route } =
          await resolveReplyContext(
            source,
            peerAddress,
          );

        // Keep root and parent relationships inside ciphertext.
        const rootOfferLocator =
          sourceAction.rootOfferLocator ??
          canonicalLocator(source.actionLocator);

        if (!sourceAction.settlementPlan) {
          throw new Error(
            "This Offer predates production Rekber settlement terms. Create a new Offer.",
          );
        }

        const action: Omit<OfferActionPayload, "kind"> = {
          ...terms,
          settlementPlan:
            sourceAction.settlementPlan,
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
            markPrepared();

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
      onWalletHandoff,
    );
  }

  /**
   * Accept the latest incoming create/counter action.
   */
  async function acceptDirectOffer(
    source: ConversationEntry,
    onWalletHandoff?: () => void,
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
      async (markPrepared) => {
        // The acceptance action returns to the sender of the current terms.
        const { peer, route } =
          await resolveReplyContext(
            source,
            peerAddress,
          );

        if (!sourceAction.settlementPlan) {
          throw new Error(
            "This Offer predates production Rekber settlement terms. Create a new Offer.",
          );
        }

        // Copy the complete accepted terms, including the immutable Rekber
        // roles/policy, into the encrypted acceptance action.
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
          settlementPlan:
            sourceAction.settlementPlan,
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
            markPrepared();

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
      onWalletHandoff,
    );
  }

  /**
   * Reject the latest incoming create/counter action.
   */
  async function rejectDirectOffer(
    source: ConversationEntry,
    onWalletHandoff?: () => void,
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
      async (markPrepared) => {
        // The rejection action returns to the sender of the current terms.
        const { peer, route } =
          await resolveReplyContext(
            source,
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
            markPrepared();

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
      onWalletHandoff,
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
    }, 2000);

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

  function isOfferDiscovered(
    entry: ConversationEntry | null | undefined,
  ): boolean {
    if (!entry) {
      return false;
    }

    return matchedOfferRoutesRef.current.has(
      stripLocator(entry.actionLocator),
    );
  }

  return {
    offerEntries,
    createDirectOffer,
    counterDirectOffer,
    acceptDirectOffer,
    rejectDirectOffer,
    markOfferRead,
    handleOfferRefresh,
    isOfferDiscovered,
  };
}
