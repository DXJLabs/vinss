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
import type { AttachmentRef, MessagePayload, WorkEvidence } from "@/types/deal-room";
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
    note: string;
    file?: File | null;
  }) => Promise<boolean>;
  refreshDirect: (silent?: boolean) => Promise<void>;
}

function locatorHex(value: string): string {
  return BigInt(value).toString(16);
}

function uniqueIdentities(
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

async function sha256FileHex(
  file: File,
): Promise<string> {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );

  return (
    "0x" +
    Array.from(
      new Uint8Array(digest),
    )
      .map((value) =>
        value
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

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

  function historyStorageKey(): string | null {
    if (!roomId || !session || !selectedPeer) {
      return null;
    }

    return (
      `vinss:direct-history:v1:${roomId}:` +
      `${canonicalStarknetAddress(session.account.address)}:` +
      canonicalStarknetAddress(selectedPeer.address)
    );
  }

  async function persistHistory(
    nextEntries: ConversationEntry[],
  ): Promise<void> {
    const storageKey = historyStorageKey();
    if (!storageKey) return;

    const directKey = await resolveDirectKey();
    if (!directKey) return;

    await saveEncryptedLocalJson(storageKey, directKey, {
      version: 1,
      savedAt: Date.now(),
      entries: nextEntries,
    });
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

    const directKey = await resolveDirectKey();
    if (!directKey) {
      setError("This private chat is not ready yet.");
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      const attachment = await uploadDirectAttachment(
        BACKEND_URL,
        directKey,
        file,
      );

      const sentAt = new Date().toISOString();
      const cleanCaption = caption.trim();
      const route: MessageRoute = {
        recipientIdentity: selectedPeer.address,
        encryptionKey: directKey,
        routingKey: directKey,
      };
      const payload: MessagePayload = {
        kind: "attachment_ref",
        scope: "direct",
        body: cleanCaption || file.name,
        senderIdentity: {
          address: session.account.address,
          messagingPublicKey: messagingIdentity.publicKey,
        },
        recipientAddress: selectedPeer.address,
        attachment,
        sentAt,
      };

      const result = await sendMessage(
        session.account,
        channelKey,
        payload,
        route,
      );

      const entry: ConversationEntry = {
        id: `direct:${result.actionLocator.toString(16)}`,
        kind: "message",
        summary: cleanCaption || file.name,
        transactionHash: result.transactionHash,
        actionLocator: result.actionLocator.toString(16),
        sentAt,
        scope: "direct",
        senderAddress: session.account.address,
        recipientAddress: selectedPeer.address,
        attachment,
      };

      setEntries((previous) => {
        const next = [...previous, entry].sort(
          (left, right) =>
            new Date(left.sentAt).getTime() -
            new Date(right.sentAt).getTime(),
        );
        void persistHistory(next);
        return next;
      });

      return true;
    } catch (err) {
      console.error("[VINSS DIRECT ATTACHMENT ERROR]", err);
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

  async function sendDirectWorkSubmission(
    input: {
      custodyCommitment: string;
      note: string;
      file?: File | null;
    },
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

    const note =
      input.note.trim();

    const file =
      input.file ?? null;

    if (!note && !file) {
      setError(
        "Add a work note or select a file first.",
      );
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

    let custodyCommitment: string;

    try {
      custodyCommitment =
        `0x${BigInt(
          input.custodyCommitment,
        ).toString(16)}`;
    } catch {
      setError(
        "The Rekber custody reference is invalid.",
      );
      return false;
    }

    const evidence:
      WorkEvidence = {
        type: "work_submission",
        custodyCommitment,
        note,
      };

    if (file) {
      evidence.fileName =
        file.name;
      evidence.fileType =
        file.type ||
        "application/octet-stream";
      evidence.fileSize =
        file.size;
      evidence.fileSha256 =
        await sha256FileHex(
          file,
        );
    }

    const sentAt =
      new Date().toISOString();

    const route:
      MessageRoute = {
        recipientIdentity:
          selectedPeer.address,
        encryptionKey:
          directKey,
        routingKey:
          directKey,
      };

    const payload:
      MessagePayload = {
        kind: file
          ? "attachment_ref"
          : "system_note",
        scope: "direct",
        body:
          note ||
          "Work submitted",
        senderIdentity: {
          address:
            session.account.address,
          messagingPublicKey:
            messagingIdentity.publicKey,
        },
        recipientAddress:
          selectedPeer.address,
        workEvidence:
          evidence,
        sentAt,
      };

    let preparedLocator:
      string | null = null;

    setBusy(true);
    setError(null);

    try {
      const sendPromise =
        sendMessage(
          session.account,
          channelKey,
          payload,
          route,
          (prepared) => {
            preparedLocator =
              prepared.actionLocator
                .toString(16);

            setEntries(
              (previous) => {
                const next:
                  ConversationEntry[] = [
                    ...previous.filter(
                      (entry) =>
                        entry.actionLocator !==
                        preparedLocator,
                    ),
                    {
                      id:
                        `direct:${preparedLocator}`,
                      kind:
                        "message",
                      summary:
                        note ||
                        "Work submitted",
                      transactionHash:
                        "",
                      actionLocator:
                        preparedLocator!,
                      sentAt,
                      scope:
                        "direct",
                      senderAddress:
                        session.account.address,
                      recipientAddress:
                        selectedPeer.address,
                      workEvidence:
                        evidence,
                    },
                  ];

                void persistHistory(
                  next,
                );

                return next;
              },
            );
          },
        );

      const result =
        await Promise.race([
          sendPromise,
          new Promise<never>(
            (_, reject) => {
              window.setTimeout(
                () =>
                  reject(
                    new Error(
                      "VINSS_WORK_CALLBACK_TIMEOUT",
                    ),
                  ),
                25_000,
              );
            },
          ),
        ]);

      const confirmedLocator =
        result.actionLocator
          .toString(16);

      setEntries(
        (previous) =>
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
          ),
      );

      void refreshDirect(true);

      return true;
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      const definitelyFailed =
        /USER_REFUSED|INVALID_REQUEST_PAYLOAD|NOT_REGISTERED|INSUFFICIENT_PRIVATE_BALANCE|PRIVACY_LEAK/i.test(
          raw,
        );

      if (
        definitelyFailed
      ) {
        if (
          preparedLocator
        ) {
          setEntries(
            (previous) =>
              previous.filter(
                (entry) =>
                  entry.actionLocator !==
                  preparedLocator,
              ),
          );
        }

        setError(
          humanizeError(
            err,
            "Work submission could not be sent.",
          ),
        );

        return false;
      }

      // Ready X can lose the browser callback after the encrypted message
      // transaction is already submitted. Discovery reconciles the locator.
      if (
        preparedLocator
      ) {
        console.warn(
          "[VINSS WORK SUBMISSION CALLBACK DELAYED]",
          {
            actionLocator:
              preparedLocator,
          },
        );

        setError(null);
        void refreshDirect(true);

        return true;
      }

      setError(
        humanizeError(
          err,
          "Work submission could not be sent.",
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

      if (recovered) {
        window.localStorage.removeItem(
          storageKey,
        );
        setMessagePending(false);
        setError(null);
        return;
      }

      if (
        Date.now() - pending.createdAt >
        60_000
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

  // Hydrate encrypted local history before network discovery for fast reopen.
  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !session ||
      !selectedPeer ||
      !messagingIdentity
    ) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      const storageKey = historyStorageKey();
      if (!storageKey) return;

      const directKey = await resolveDirectKey();
      if (!directKey || cancelled) return;

      const cached = await loadEncryptedLocalJson<{
        version: 1;
        savedAt: number;
        entries: ConversationEntry[];
      }>(storageKey, directKey);

      if (cancelled || !cached?.entries?.length) return;

      setEntries((previous) =>
        previous.length > 0 ? previous : cached.entries,
      );
    };

    void hydrate();

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
    refreshDirect,
  };
}
