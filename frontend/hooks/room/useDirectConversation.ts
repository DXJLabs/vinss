"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { BACKEND_URL } from "@/lib/starknet/constants";
import {
  discoverMessages,
  sendMessage,
} from "@/lib/deal-room/messaging";
import {
  canonicalStarknetAddress,
  deriveDirectMessageKey,
  sameStarknetAddress,
  type MessagingIdentity,
  type RoomParticipant,
} from "@/lib/privacy/participantKeys";
import type { MessageRoute } from "@/lib/privacy/messageRouting";
import {
  pollPresence,
  publishPresence,
} from "@/lib/privacy/presence";
import type {
  AttachmentRef,
  DealType,
  MessagePayload,
  WorkEvidence,
  WorkReviewDecision,
} from "@/types/deal-room";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { humanizeError } from "@/lib/errors/uiError";
import {
  loadEncryptedLocalJson,
  saveEncryptedLocalJson,
} from "@/lib/privacy/encryptedChatCache";
import {
  downloadDirectAttachment,
  uploadDirectAttachment,
} from "@/lib/privacy/directAttachments";
import {
  locatorHex,
  uniqueIdentities,
} from "@/lib/deal-room/directMessageRouting";
import { sha256FileHex } from "@/lib/fileDigest";

import {
  confirmRekberFulfillment as confirmWorkOnRekber,
  getRekberCustody as getWorkRekberState,
  requestRekberRevision as requestWorkRevisionOnRekber,
  submitRekberFulfillment as submitWorkOnRekber,
} from "@/lib/deal-room/settlement";
import {
  loadRekberSecrets as loadWorkRekberSecrets,
} from "@/lib/deal-room/rekberSecrets";

interface UseDirectConversationOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  messagingIdentity: MessagingIdentity | null;
  participants: RoomParticipant[];
  selfRoutingIdentities: string[];
  peerAddress: string | null;
  active: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

interface UseDirectConversationResult {
  entries: ConversationEntry[];
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  peerTyping: boolean;
  sendDirectMessage: () => Promise<void>;
  sendDirectAttachment: (
    file: File,
    caption?: string,
  ) => Promise<boolean>;
  loadDirectAttachment: (
    attachment: AttachmentRef,
  ) => Promise<Blob>;
  sendDirectWorkSubmission: (input: {
    custodyCommitment: string;
    dealType?: DealType;
    note: string;
    file?: File | null;
  }) => Promise<boolean>;
  sendDirectWorkReview: (input: {
    custodyCommitment: string;
    submissionLocator: string;
    decision: WorkReviewDecision;
    note?: string;
  }) => Promise<boolean>;
  refreshDirect: (silent?: boolean) => Promise<void>;
}

/*
 * Owns the React lifecycle for one direct peer: discovery, encrypted
 * local history, presence, receipts, attachments, and sends. Pure routing
 * and hashing helpers live in lib/ to avoid duplicated behavior.
 */
export function useDirectConversation({
  roomId,
  session,
  channelKey,
  messagingIdentity,
  participants,
  selfRoutingIdentities,
  peerAddress,
  active,
  setBusy,
  setError,
}: UseDirectConversationOptions): UseDirectConversationResult {
  // Direct messages live in their own state and are never merged into Group state.
  const [entries, setEntries] =
    useState<ConversationEntry[]>([]);

  // Preserve a separate unsent draft for every participant tab.
  const [drafts, setDrafts] =
    useState<Record<string, string>>({});

  const [peerTyping, setPeerTyping] =
    useState(false);

  const [messagePending, setMessagePending] =
    useState(false);

  const sentReadReceiptsRef =
    useRef<Set<string>>(new Set());

  const chatEndRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * Serialize encrypted history writes. Multiple discovery/send callbacks
   * can finish out of order on mobile; every write must merge with the
   * latest persisted snapshot instead of replacing it.
   */
  const historyWriteChainRef =
    useRef<Promise<void>>(
      Promise.resolve(),
    );

  const peerKey = peerAddress
    ? canonicalStarknetAddress(peerAddress)
    : "";

  const draft = peerKey
    ? drafts[peerKey] ?? ""
    : "";

  const setDraft: Dispatch<
    SetStateAction<string>
  > = (next) => {
    if (!peerKey) return;

    setDrafts((previous) => {
      const current =
        previous[peerKey] ?? "";

      const value =
        typeof next === "function"
          ? next(current)
          : next;

      return {
        ...previous,
        [peerKey]: value,
      };
    });
  };

  const selectedPeer = useMemo(
    () =>
      peerAddress
        ? participants.find((participant) =>
            sameStarknetAddress(
              participant.address,
              peerAddress,
            ),
          ) ?? null
        : null,
    [
      peerAddress,
      participants
        .map(
          (participant) =>
            `${canonicalStarknetAddress(
              participant.address,
            )}:${participant.publicKey}`,
        )
        .sort()
        .join("|"),
    ],
  );

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

  async function buildDiscoveryRoutes():
    Promise<MessageRoute[]> {
    const directKey =
      await resolveDirectKey();

    if (
      !directKey ||
      !session ||
      !selectedPeer
    ) {
      return [];
    }

    const routes: MessageRoute[] = [];

    // Incoming Bob -> Alice messages were tagged with whichever exact Alice
    // address string Bob learned from encrypted Group metadata. Try every
    // locally observed self alias so leading-zero formatting cannot split chat.
    for (const identity of uniqueIdentities([
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

    // Also include the exact peer identity used when this wallet sent messages,
    // allowing outgoing history to reappear after reload.
    for (const identity of uniqueIdentities([
      selectedPeer.address,
      canonicalStarknetAddress(
        selectedPeer.address,
      ),
    ])) {
      routes.push({
        recipientIdentity: identity,
        encryptionKey: directKey,
        routingKey: directKey,
      });
    }

    return routes;
  }

  async function refreshDirect(
    silent = false,
  ): Promise<void> {
    if (
      !channelKey ||
      !session ||
      !selectedPeer
    ) {
      return;
    }

    if (!silent) {
      setBusy(true);
      setError(null);
    }

    try {
      const routes =
        await buildDiscoveryRoutes();

      if (routes.length === 0) return;

      const discovered =
        await discoverMessages(
          BACKEND_URL,
          channelKey,
          routes,
        );

      const incoming: ConversationEntry[] =
        discovered
          .filter((item) => {
            if (
              item.message.scope !== "direct"
            ) {
              return false;
            }

            const sender =
              item.message.senderIdentity?.address;

            const recipient =
              item.message.recipientAddress;

            const incomingFromPeer =
              sameStarknetAddress(
                sender,
                selectedPeer.address,
              ) &&
              sameStarknetAddress(
                recipient,
                session.account.address,
              );

            const outgoingToPeer =
              sameStarknetAddress(
                sender,
                session.account.address,
              ) &&
              sameStarknetAddress(
                recipient,
                selectedPeer.address,
              );

            return (
              incomingFromPeer ||
              outgoingToPeer
            );
          })
          .map((item) => ({
            id: `direct:${locatorHex(
              item.actionLocator,
            )}`,
            kind: "message",
            summary: item.message.body,
            transactionHash:
              item.transactionHash,
            actionLocator: locatorHex(
              item.actionLocator,
            ),
            sentAt: item.message.sentAt,
            scope: "direct",
            senderAddress:
              item.message.senderIdentity
                ?.address,
            recipientAddress:
              item.message.recipientAddress,
            workEvidence:
              item.message.workEvidence,
            attachment:
              item.message.attachment,
          }));

      setEntries((previous) => {
        const byLocator = new Map(
          previous.map((entry) => [
            entry.actionLocator,
            entry,
          ]),
        );

        for (const entry of incoming) {
          const existing =
            byLocator.get(
              entry.actionLocator,
            );

          byLocator.set(
            entry.actionLocator,
            {
              ...existing,
              ...entry,
              // Keep ephemeral read state when on-chain discovery refreshes.
              readAt:
                existing?.readAt ??
                entry.readAt,
            },
          );
        }

        const next = [...byLocator.values()].sort(
          (left, right) =>
            new Date(left.sentAt).getTime() -
            new Date(right.sentAt).getTime(),
        );

        void persistHistory(next);

        return next;
      });
    } catch (err) {
      console.error(
        "[VINSS DIRECT DISCOVERY ERROR]",
        err,
      );

      if (!silent) {
        setError(
          humanizeError(
            err,
            "We couldn't refresh this private chat.",
          ),
        );
      }
    } finally {
      if (!silent) {
        setBusy(false);
      }
    }
  }

  function pendingStorageKey(): string | null {
    if (
      !roomId ||
      !session ||
      !selectedPeer
    ) {
      return null;
    }

    return (
      `vinss:pending-direct-message:${roomId}:` +
      `${canonicalStarknetAddress(
        session.account.address,
      )}:` +
      canonicalStarknetAddress(
        selectedPeer.address,
      )
    );
  }

  function historyStorageKey():
    string | null {
    if (
      !roomId ||
      !session ||
      !selectedPeer
    ) {
      return null;
    }

    return (
      `vinss:direct-history:v2:${roomId}:` +
      `${canonicalStarknetAddress(
        session.account.address,
      )}:` +
      canonicalStarknetAddress(
        selectedPeer.address,
      )
    );
  }

  function legacyHistoryStorageKey():
    string | null {
    if (
      !roomId ||
      !session ||
      !selectedPeer
    ) {
      return null;
    }

    return (
      `vinss:direct-history:v1:${roomId}:` +
      `${canonicalStarknetAddress(
        session.account.address,
      )}:` +
      canonicalStarknetAddress(
        selectedPeer.address,
      )
    );
  }

  async function persistHistory(
    nextEntries: ConversationEntry[],
  ): Promise<void> {
    const storageKey =
      historyStorageKey();

    const historyKey =
      channelKey;

    if (
      !storageKey ||
      !historyKey
    ) {
      return;
    }

    /*
     * Capture key + storage key now. The selected peer can change before
     * an earlier queued encryption finishes.
     */
    historyWriteChainRef.current =
      historyWriteChainRef.current
        .catch(() => undefined)
        .then(async () => {
          const cached =
            await loadEncryptedLocalJson<{
              version: 1;
              savedAt: number;
              entries:
                ConversationEntry[];
            }>(
              storageKey,
              historyKey,
            );

          const byLocator =
            new Map<
              string,
              ConversationEntry
            >();

          for (const entry of [
            ...(cached?.entries ?? []),
            ...nextEntries,
          ]) {
            const locator =
              entry.actionLocator
                .replace(/^0x/, "")
                .toLowerCase();

            const existing =
              byLocator.get(locator);

            byLocator.set(
              locator,
              {
                ...existing,
                ...entry,
                readAt:
                  entry.readAt ??
                  existing?.readAt,
              },
            );
          }

          const merged =
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

          await saveEncryptedLocalJson(
            storageKey,
            historyKey,
            {
              version: 1,
              savedAt:
                Date.now(),
              entries:
                merged,
            },
          );
        });

    await historyWriteChainRef.current;
  }

  async function sendDirectMessage():
    Promise<void> {
    if (messagePending) {
      setError(
        "Your previous private message is still being confirmed.",
      );
      return;
    }

    if (
      !roomId ||
      !session ||
      !channelKey ||
      !messagingIdentity ||
      !selectedPeer ||
      !draft.trim()
    ) {
      return;
    }

    const directKey =
      await resolveDirectKey();

    if (!directKey) {
      setError(
        "This private chat is not ready yet.",
      );
      return;
    }

    const storageKey =
      pendingStorageKey();

    if (!storageKey) return;

    const body = draft.trim();
    const sentAt = new Date().toISOString();

    const route: MessageRoute = {
      // Use the exact peer address learned from encrypted Group metadata.
      recipientIdentity:
        selectedPeer.address,
      encryptionKey: directKey,
      routingKey: directKey,
    };

    const payload: MessagePayload = {
      kind: "text",
      scope: "direct",
      body,
      senderIdentity: {
        address: session.account.address,
        messagingPublicKey:
          messagingIdentity.publicKey,
      },
      recipientAddress:
        selectedPeer.address,
      sentAt,
    };

    let preparedLocator: string | null =
      null;

    setBusy(true);
    setError(null);

    try {
      const sendPromise = sendMessage(
        session.account,
        channelKey,
        payload,
        route,
        (prepared) => {
          preparedLocator =
            prepared.actionLocator.toString(16);

          setMessagePending(true);

          void saveEncryptedLocalJson(
            storageKey,
            directKey,
            {
              actionLocator: preparedLocator,
              body,
              sentAt,
              recipientAddress: selectedPeer.address,
              createdAt: Date.now(),
            },
          ).catch((err) => {
            console.error(
              "[VINSS DIRECT PENDING CACHE ERROR]",
              err,
            );
          });

          setEntries((previous) => {
            const next: ConversationEntry[] = [
              ...previous.filter(
                (entry) =>
                  entry.actionLocator !==
                  preparedLocator,
              ),
              {
                id: `direct:${preparedLocator}`,
                kind: "message",
                summary: body,
                transactionHash: "",
                actionLocator: preparedLocator!,
                sentAt,
                scope: "direct",
                senderAddress: session.account.address,
                recipientAddress: selectedPeer.address,
              },
            ];

            void persistHistory(next);
            return next;
          });

          setDraft("");
        },
      );

      const result = await Promise.race([
        sendPromise,
        new Promise<never>(
          (_, reject) => {
            window.setTimeout(() => {
              reject(
                new Error(
                  "VINSS_DIRECT_CALLBACK_TIMEOUT",
                ),
              );
            }, 20_000);
          },
        ),
      ]);

      window.localStorage.removeItem(
        storageKey,
      );

      setMessagePending(false);

      const confirmedLocator =
        result.actionLocator.toString(16);

      setEntries((previous) => {
        let matched = false;

        const next = previous.map(
          (entry) => {
            if (
              entry.actionLocator ===
              confirmedLocator
            ) {
              matched = true;

              return {
                ...entry,
                transactionHash:
                  result.transactionHash,
              };
            }

            return entry;
          },
        );

        if (matched) return next;

        return [
          ...next,
          {
            id: `direct:${confirmedLocator}`,
            kind: "message",
            summary: body,
            transactionHash:
              result.transactionHash,
            actionLocator:
              confirmedLocator,
            sentAt,
            scope: "direct",
            senderAddress:
              session.account.address,
            recipientAddress:
              selectedPeer.address,
          },
        ];
      });
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      // Ready X may successfully submit the Starknet transaction while the
      // browser loses or delays the wallet callback during a mobile remount.
      // A callback timeout is therefore a recoverable pending state, not a
      // transaction failure. Discovery will reconcile the public locator.
      const callbackDelayed =
        raw ===
        "VINSS_DIRECT_CALLBACK_TIMEOUT";

      if (
        callbackDelayed &&
        preparedLocator
      ) {
        console.warn(
          "[VINSS DIRECT CALLBACK DELAYED]",
          {
            actionLocator:
              preparedLocator,
          },
        );

        setMessagePending(true);
        setError(null);

        // Trigger one immediate discovery pass instead of waiting for the
        // normal polling interval to reconcile the confirmed transaction.
        void refreshDirect(true);
        return;
      }

      console.error(
        "[VINSS DIRECT SEND ERROR]",
        err,
      );

      const definitelyFailed =
        /USER_REFUSED|INVALID_REQUEST_PAYLOAD|NOT_REGISTERED|INSUFFICIENT_PRIVATE_BALANCE|PRIVACY_LEAK/i.test(
          raw,
        );

      if (definitelyFailed) {
        window.localStorage.removeItem(
          storageKey,
        );
        setMessagePending(false);

        if (preparedLocator) {
          setEntries((previous) =>
            previous.filter(
              (entry) =>
                entry.actionLocator !==
                preparedLocator,
            ),
          );
        }

        setDraft(body);
        setError(
          humanizeError(
            err,
            "Private message could not be sent.",
          ),
        );

        return;
      }

      if (preparedLocator) {
        setMessagePending(true);
        setError(
          "Message is being confirmed in the background.",
        );
        return;
      }

      setMessagePending(false);
      setDraft(body);
      setError(
        humanizeError(
          err,
          "Private message could not be sent.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadDirectAttachment(
    attachment: AttachmentRef,
  ): Promise<Blob> {
    const directKey = await resolveDirectKey();
    if (!directKey) {
      throw new Error("This private chat is not ready yet.");
    }

    return downloadDirectAttachment(
      BACKEND_URL,
      directKey,
      attachment,
    );
  }

  async function sendDirectAttachment(
    file: File,
    caption = "",
  ): Promise<boolean> {
    if (
      !roomId ||
      !session ||
      !channelKey ||
      !messagingIdentity ||
      !selectedPeer
    ) {
      return false;
    }

    const directKey =
      await resolveDirectKey();

    if (!directKey) {
      setError(
        "This private chat is not ready yet.",
      );
      return false;
    }

    const cleanCaption =
      caption.trim();

    const sentAt =
      new Date().toISOString();

    const preparedLocatorRef: {
      value: string | null;
    } = {
      value: null,
    };

    let uploadedAttachment:
      AttachmentRef | null = null;

    setBusy(true);
    setError(null);

    try {
      uploadedAttachment =
        await uploadDirectAttachment(
          BACKEND_URL,
          directKey,
          file,
        );

      const route: MessageRoute = {
        recipientIdentity:
          selectedPeer.address,
        encryptionKey:
          directKey,
        routingKey:
          directKey,
      };

      const payload: MessagePayload = {
        kind: "attachment_ref",
        scope: "direct",
        body:
          cleanCaption ||
          file.name,
        senderIdentity: {
          address:
            session.account.address,
          messagingPublicKey:
            messagingIdentity.publicKey,
        },
        recipientAddress:
          selectedPeer.address,
        attachment:
          uploadedAttachment,
        sentAt,
      };

      const result =
        await sendMessage(
          session.account,
          channelKey,
          payload,
          route,
          (prepared) => {
            preparedLocatorRef.value =
              prepared.actionLocator
                .toString(16);

            const pending:
              ConversationEntry = {
              id:
                `direct:${preparedLocatorRef.value}`,
              kind: "message",
              summary:
                cleanCaption ||
                file.name,
              transactionHash: "",
              actionLocator:
                preparedLocatorRef.value!,
              sentAt,
              scope: "direct",
              senderAddress:
                session.account.address,
              recipientAddress:
                selectedPeer.address,
              attachment:
                uploadedAttachment!,
            };

            setEntries(
              (previous) => {
                const next = [
                  ...previous.filter(
                    (entry) =>
                      entry.actionLocator !==
                      preparedLocatorRef.value,
                  ),
                  pending,
                ].sort(
                  (left, right) =>
                    new Date(
                      left.sentAt,
                    ).getTime() -
                    new Date(
                      right.sentAt,
                    ).getTime(),
                );

                void persistHistory(
                  next,
                );

                return next;
              },
            );
          },
        );

      const confirmedLocator =
        result.actionLocator
          .toString(16);

      setEntries(
        (previous) => {
          const next =
            previous.map(
              (entry) =>
                entry.actionLocator ===
                confirmedLocator
                  ? {
                      ...entry,
                      transactionHash:
                        result.transactionHash,
                    }
                  : entry,
            );

          void persistHistory(
            next,
          );

          return next;
        },
      );

      setError(null);
      return true;
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      /*
       * Ready X on mobile can report USER_REFUSED after
       * the transaction was actually submitted.
       *
       * If we already have a prepared locator, verify
       * discovery before declaring the send cancelled.
       */
      if (
        /USER_REFUSED/i.test(raw) &&
        preparedLocatorRef.value &&
        uploadedAttachment
      ) {
        const target =
          preparedLocatorRef.value
            .replace(/^0x/, "")
            .toLowerCase();

        for (
          let attempt = 0;
          attempt < 4;
          attempt += 1
        ) {
          if (attempt > 0) {
            await new Promise<void>(
              (resolve) =>
                window.setTimeout(
                  resolve,
                  1800,
                ),
            );
          }

          try {
            const routes =
              await buildDiscoveryRoutes();

            const discovered =
              await discoverMessages(
                BACKEND_URL,
                channelKey,
                routes,
              );

            const confirmed =
              discovered.find(
                (item) => {
                  try {
                    return (
                      BigInt(
                        item.actionLocator,
                      )
                        .toString(16)
                        .toLowerCase() ===
                      target
                    );
                  } catch {
                    return false;
                  }
                },
              );

            if (confirmed) {
              setEntries(
                (previous) => {
                  const next =
                    previous.map(
                      (entry) =>
                        entry.actionLocator
                          .replace(
                            /^0x/,
                            "",
                          )
                          .toLowerCase() ===
                        target
                          ? {
                              ...entry,
                              transactionHash:
                                confirmed
                                  .transactionHash,
                            }
                          : entry,
                    );

                  void persistHistory(
                    next,
                  );

                  return next;
                },
              );

              setError(null);
              return true;
            }
          } catch {
            // Retry briefly while the indexer catches up.
          }
        }
      }

      if (preparedLocatorRef.value) {
        const target =
          preparedLocatorRef.value
            .replace(/^0x/, "")
            .toLowerCase();

        setEntries(
          (previous) =>
            previous.filter(
              (entry) =>
                entry.actionLocator
                  .replace(/^0x/, "")
                  .toLowerCase() !==
                target,
            ),
        );
      }

      console.error(
        "[VINSS DIRECT ATTACHMENT ERROR]",
        err,
      );

      setError(
        humanizeError(
          err,
          "We couldn't send this encrypted file.",
        ),
      );

      return false;
    } finally {
      setBusy(false);
    }
  }


async function computeRekberEvidenceCommitment(
  parts: string[],
): Promise<bigint> {
  const bytes =
    new TextEncoder().encode(
      parts.join("\u001f"),
    );

  const digest =
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        bytes,
      ),
    );

  const hex =
    Array.from(digest)
      .map((byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");

  // Stay comfortably inside Starknet felt range.
  const value =
    BigInt(`0x${hex}`) &
    ((1n << 250n) - 1n);

  return value || 1n;
}

async function sha256WorkFile(
  file: File,
): Promise<string> {
  const digest =
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      ),
    );

  return (
    "0x" +
    Array.from(digest)
      .map((byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

  async function sendDirectWorkSubmission(
    input: {
      custodyCommitment: string;
      dealType?: DealType;
      note: string;
      file?: File | null;
    },
  ): Promise<boolean> {
    if (
      !roomId ||
      !session ||
      !channelKey ||
      !selectedPeer
    ) {
      return false;
    }

    const note = input.note.trim();
    const file = input.file ?? null;

    if (!note && !file) {
      setError(
        "Add a delivery note or select an evidence file first.",
      );
      return false;
    }

    let custodyCommitment: bigint;

    try {
      custodyCommitment =
        BigInt(input.custodyCommitment);
    } catch {
      setError(
        "The Rekber custody reference is invalid.",
      );
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      const [
        custody,
        secrets,
      ] = await Promise.all([
        getWorkRekberState(
          custodyCommitment,
        ),
        loadWorkRekberSecrets(
          roomId,
          session.account.address,
          custodyCommitment,
          channelKey,
        ),
      ]);

      if (
        !custody ||
        !secrets ||
        secrets.role !== "payee"
      ) {
        throw new Error(
          "PAYEE_SECRET_MISSING",
        );
      }

      const fulfillmentSecrets =
        secrets.fulfillmentChainSecrets ?? [];

      const secretIndex =
        fulfillmentSecrets.length -
        custody
          .fulfillmentRoundsRemaining;

      const chainSecretRaw =
        fulfillmentSecrets[
          secretIndex
        ];

      if (!chainSecretRaw) {
        throw new Error(
          "FULFILLMENT_SECRET_MISSING",
        );
      }

      const fileSha256 =
        file
          ? await sha256WorkFile(file)
          : "";

      /*
       * Evidence plaintext does NOT go on-chain.
       * Rekber receives only this opaque commitment.
       */
      const evidenceCommitment =
        await computeRekberEvidenceCommitment([
          "VINSS_REKBER_WORK_V1",
          custodyCommitment.toString(),
          input.dealType ?? "",
          note,
          file?.name ?? "",
          file?.type ?? "",
          String(file?.size ?? 0),
          fileSha256,
        ]);

      await submitWorkOnRekber(
        session.account,
        {
          custodyCommitment,
          chainSecret:
            BigInt(chainSecretRaw),
          evidenceCommitment,
        },
      );

      /*
       * Do not create a MessageHelper record here.
       * Both wallets derive workflow status from Rekber custody.
       */
      setError(null);
      void refreshDirect(true);

      return true;
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      const code =
        raw.match(
          /\b(BAD_CHAIN_SECRET|FULFILLMENT_EXISTS|FULFILLMENT_REQUIRED|FULFILLMENT_TOO_LATE|REVISION_TOO_LATE|INVALID_ROUNDS|CUSTODY_NOT_FOUND|CUSTODY_CONSUMED|ZERO_SECRET|ZERO_COMMITMENT|INVALID_CALLDATA|UNKNOWN_ERROR|PAYEE_SECRET_MISSING|FULFILLMENT_SECRET_MISSING)\b/i,
        )?.[1];

      setError(
        code
          ? `Rekber rejected work: ${code.toUpperCase()}`
          : humanizeError(
              err,
              "Work could not be committed to Rekber.",
            ),
      );

      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendDirectWorkReview(
    input: {
      custodyCommitment: string;
      submissionLocator: string;
      decision: WorkReviewDecision;
      note?: string;
    },
  ): Promise<boolean> {
    if (
      !roomId ||
      !session ||
      !channelKey ||
      !selectedPeer
    ) {
      return false;
    }

    let custodyCommitment: bigint;

    try {
      custodyCommitment =
        BigInt(input.custodyCommitment);
    } catch {
      setError(
        "The Rekber custody reference is invalid.",
      );
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      const [
        custody,
        secrets,
      ] = await Promise.all([
        getWorkRekberState(
          custodyCommitment,
        ),
        loadWorkRekberSecrets(
          roomId,
          session.account.address,
          custodyCommitment,
          channelKey,
        ),
      ]);

      if (
        !custody ||
        !secrets ||
        secrets.role !== "payer"
      ) {
        throw new Error(
          "PAYER_SECRET_MISSING",
        );
      }

      if (
        input.decision ===
        "revision_requested"
      ) {
        const revisionSecrets =
          secrets.revisionChainSecrets ?? [];

        const secretIndex =
          revisionSecrets.length -
          custody
            .revisionRoundsRemaining;

        const chainSecretRaw =
          revisionSecrets[
            secretIndex
          ];

        if (!chainSecretRaw) {
          throw new Error(
            "REVISION_SECRET_MISSING",
          );
        }

        const reasonCommitment =
          await computeRekberEvidenceCommitment([
            "VINSS_REKBER_REVISION_V1",
            custodyCommitment.toString(),
            input.submissionLocator,
            input.note?.trim() ?? "",
          ]);

        await requestWorkRevisionOnRekber(
          session.account,
          {
            custodyCommitment,
            chainSecret:
              BigInt(chainSecretRaw),
            reasonCommitment,
          },
        );

        return true;
      }

      if (
        input.decision === "approved"
      ) {
        /*
         * submission_review (policy 1) is confirmed by
         * submit_fulfillment itself. Payer approval is the
         * later release authorization in Escrow.
         */
        if (
          custody.verificationPolicy === 1
        ) {
          if (
            !custody
              .fulfillmentConfirmed ||
            custody.revisionPending
          ) {
            throw new Error(
              "FULFILLMENT_REQUIRED",
            );
          }

          return true;
        }

        /*
         * counterparty_confirm (policy 2) requires
         * explicit payer confirmation.
         */
        if (
          custody.verificationPolicy === 2
        ) {
          if (
            !secrets
              .payerConfirmationSecret ||
            !custody
              .fulfillmentEvidenceCommitment
          ) {
            throw new Error(
              "PAYER_CONFIRM_MISSING",
            );
          }

          await confirmWorkOnRekber(
            session.account,
            {
              custodyCommitment,
              confirmationSecret:
                BigInt(
                  secrets
                    .payerConfirmationSecret,
                ),
              evidenceCommitment:
                custody
                  .fulfillmentEvidenceCommitment,
            },
          );

          return true;
        }

        throw new Error(
          "INVALID_POLICY",
        );
      }

      setError(
        "Reject is handled through the Rekber dispute flow, not a work message.",
      );
      return false;
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      const code =
        raw.match(
          /\b(BAD_CHAIN_SECRET|REVISION_NOT_ALLOWED|REVISION_REQUIRED|REVISION_TOO_LATE|REVIEW_WINDOW_CLOSED|FULFILLMENT_REQUIRED|FULFILLMENT_ALREADY_CONFIRMED|INVALID_POLICY|PAYER_SECRET_MISSING|REVISION_SECRET_MISSING|PAYER_CONFIRM_MISSING|UNKNOWN_ERROR)\b/i,
        )?.[1];

      setError(
        code
          ? `Rekber review rejected: ${code.toUpperCase()}`
          : humanizeError(
              err,
              "Rekber review could not be completed.",
            ),
      );

      return false;
    } finally {
      setBusy(false);
    }
  }

  // Recover direct wallet callbacks that were interrupted by Ready X.
  useEffect(() => {
    if (
      !active ||
      !selectedPeer ||
      !session
    ) {
      return;
    }

    const storageKey =
      pendingStorageKey();

    if (!storageKey) return;

    let stopped = false;

    const checkPending = async () => {
      if (stopped) return;

      if (!window.localStorage.getItem(storageKey)) {
        setMessagePending(false);
        return;
      }

      const directKey = await resolveDirectKey();
      if (!directKey || stopped) return;

      const pending = await loadEncryptedLocalJson<{
        actionLocator: string;
        body?: string;
        createdAt: number;
      }>(storageKey, directKey);

      if (!pending) {
        setMessagePending(false);
        return;
      }

      setMessagePending(true);

      const locator =
        pending.actionLocator
          .replace(/^0x/, "")
          .toLowerCase();

      const recovered = entries.find(
        (entry) =>
          entry.actionLocator
            .replace(/^0x/, "")
            .toLowerCase() === locator &&
          Boolean(entry.transactionHash),
      );

      /*
       * Ready X mobile can return a delayed/lost callback even when the
       * transaction is already confirmed. In that case the discovered
       * message can be present while the cached prepared locator is stale.
       *
       * Treat a confirmed message with the same body + direct participants
       * + close timestamp as the same send.
       */
      const equivalentConfirmed =
        pending.body
          ? entries.find(
              (entry) => {
                if (
                  entry.kind !== "message" ||
                  entry.scope !== "direct" ||
                  !entry.transactionHash ||
                  entry.summary !== pending.body
                ) {
                  return false;
                }

                if (
                  !sameStarknetAddress(
                    entry.senderAddress,
                    session.account.address,
                  ) ||
                  !sameStarknetAddress(
                    entry.recipientAddress,
                    selectedPeer.address,
                  )
                ) {
                  return false;
                }

                const sentAt =
                  new Date(
                    entry.sentAt,
                  ).getTime();

                if (
                  !Number.isFinite(
                    sentAt,
                  )
                ) {
                  return false;
                }

                return (
                  Math.abs(
                    sentAt -
                      pending.createdAt,
                  ) <
                  5 * 60_000
                );
              },
            )
          : undefined;

      if (
        recovered ||
        equivalentConfirmed
      ) {
        window.localStorage.removeItem(
          storageKey,
        );

        setMessagePending(false);
        setError(null);
        return;
      }

      const pendingAge =
        Date.now() -
        pending.createdAt;

      /*
       * Before declaring a pending send failed, force one more discovery
       * reconciliation. Do not flash a red error just because the wallet
       * callback was slower than the browser.
       */
      if (
        pendingAge > 60_000 &&
        pendingAge <= 75_000
      ) {
        await refreshDirect(true);
        return;
      }

      if (
        pendingAge > 75_000
      ) {
        window.localStorage.removeItem(
          storageKey,
        );

        setMessagePending(false);

        setEntries((previous) =>
          previous.filter(
            (entry) =>
              entry.actionLocator
                .replace(/^0x/, "")
                .toLowerCase() !==
              locator,
          ),
        );

        if (pending.body) {
          setDraft((current) =>
            current.trim()
              ? current
              : pending.body!,
          );
        }

        setError(
          "Message was not confirmed. Review it and try again.",
        );
      }
    };

    void checkPending();

    const timer = window.setInterval(
      () => {
        void checkPending();
      },
      2_000,
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [
    active,
    peerKey,
    session?.account.address,
    entries,
  ]);

  /*
   * Direct history v2 is encrypted with the stable room channel key.
   *
   * v1 used the current ECDH direct key, so a participant identity change
   * could make that cache unreadable. Keep v1 as a best-effort migration
   * source without ever deleting it after a failed decrypt.
   */
  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !session ||
      !channelKey ||
      !selectedPeer ||
      !messagingIdentity
    ) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      const stableStorageKey =
        historyStorageKey();

      if (!stableStorageKey) {
        return;
      }

      const stable =
        await loadEncryptedLocalJson<{
          version: 1;
          savedAt: number;
          entries:
            ConversationEntry[];
        }>(
          stableStorageKey,
          channelKey,
        );

      if (cancelled) {
        return;
      }

      let legacyEntries:
        ConversationEntry[] = [];

      const legacyStorageKey =
        legacyHistoryStorageKey();

      const directKey =
        await resolveDirectKey();

      if (
        legacyStorageKey &&
        directKey &&
        !cancelled
      ) {
        const legacy =
          await loadEncryptedLocalJson<{
            version: 1;
            savedAt: number;
            entries:
              ConversationEntry[];
          }>(
            legacyStorageKey,
            directKey,
          );

        legacyEntries =
          legacy?.entries ?? [];
      }

      if (cancelled) {
        return;
      }

      const cachedEntries = [
        ...legacyEntries,
        ...(stable?.entries ?? []),
      ];

      if (
        cachedEntries.length === 0
      ) {
        return;
      }

      setEntries((previous) => {
        const byLocator =
          new Map<
            string,
            ConversationEntry
          >();

        for (const entry of [
          ...cachedEntries,
          ...previous,
        ]) {
          const locator =
            entry.actionLocator
              .replace(/^0x/, "")
              .toLowerCase();

          const existing =
            byLocator.get(locator);

          byLocator.set(
            locator,
            {
              ...existing,
              ...entry,
              readAt:
                entry.readAt ??
                existing?.readAt,
            },
          );
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

        void persistHistory(next);

        return next;
      });
    };

    void hydrate().catch((err) => {
      console.error(
        "[VINSS DIRECT HISTORY HYDRATE ERROR]",
        err,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    active,
    roomId,
    channelKey,
    session?.account.address,
    peerKey,
    selectedPeer?.publicKey,
    messagingIdentity?.publicKey,
  ]);

  // Sync only the selected direct pair. Group refresh cannot overwrite it.
  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !channelKey ||
      !session ||
      !messagingIdentity ||
      !selectedPeer
    ) {
      return;
    }

    let stopped = false;
    let running = false;

    const sync = async () => {
      if (stopped || running) return;

      running = true;

      try {
        await refreshDirect(true);
      } finally {
        running = false;
      }
    };

    void sync();

    const timer = window.setInterval(() => {
      void sync();
    }, 2200);

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
    channelKey,
    session?.account.address,
    messagingIdentity?.publicKey,
    peerKey,
    selectedPeer?.publicKey,
    selfRoutingIdentities.join("|"),
  ]);

  // Typing is pairwise encrypted presence and never becomes an on-chain event.
  const hasTypingDraft =
    Boolean(draft.trim());

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
      } catch (err) {
        console.error(
          "[VINSS DIRECT TYPING ERROR]",
          err,
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
    session?.account.address,
    peerKey,
    selectedPeer?.publicKey,
    messagingIdentity?.publicKey,
    hasTypingDraft,
  ]);

  // Poll typing + read receipts only for the selected direct pair.
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

        const peerEvents = events.filter(
          (event) =>
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
      } catch (err) {
        console.error(
          "[VINSS DIRECT PRESENCE ERROR]",
          err,
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
      1200,
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
      setPeerTyping(false);
    };
  }, [
    active,
    session?.account.address,
    peerKey,
    selectedPeer?.publicKey,
    messagingIdentity?.publicKey,
  ]);

  // Publish a read receipt only when the selected direct panel is actually open.
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

          for (const entry of unreadIncoming) {
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
            } catch (err) {
              sentReadReceiptsRef.current.delete(
                locator,
              );

              console.error(
                "[VINSS DIRECT READ RECEIPT ERROR]",
                err,
              );
            }
          }
        } catch (err) {
          console.error(
            "[VINSS DIRECT READ KEY ERROR]",
            err,
          );
        }
      };

    void publishReceipts();

    return () => {
      cancelled = true;
    };
  }, [
    active,
    session?.account.address,
    peerKey,
    selectedPeer?.publicKey,
    messagingIdentity?.publicKey,
    entries,
  ]);

  useEffect(() => {
    if (!active || entries.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [entries.length, active, peerKey]);

  return {
    entries,
    draft,
    setDraft,
    chatEndRef,
    peerTyping,
    sendDirectMessage,
    sendDirectAttachment,
    loadDirectAttachment,
    sendDirectWorkSubmission,
    sendDirectWorkReview,
    refreshDirect,
  };
}
