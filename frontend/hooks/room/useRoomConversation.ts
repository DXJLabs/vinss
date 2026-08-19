"use client";

import { useEffect, useRef, useState } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { BACKEND_URL } from "@/lib/starknet/constants";
import {
  sendMessage,
  discoverMessages,
} from "@/lib/deal-room/messaging";
import {
  deriveDirectMessageKey,
  getOrCreateMessagingIdentity,
  type MessagingIdentity,
  type RoomParticipant,
} from "@/lib/privacy/participantKeys";
import type { MessagePayload } from "@/types/deal-room";
import type { MessageRoute } from "@/lib/privacy/messageRouting";
import {
  pollPresence,
  publishPresence,
} from "@/lib/privacy/presence";
import type { ConversationEntry } from "@/components/room/conversation/ConversationPanel";
import { humanizeError } from "@/lib/errors/uiError";

interface UseRoomConversationOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  active: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export function useRoomConversation({
  roomId,
  session,
  channelKey,
  active,
  setBusy,
  setError,
}: UseRoomConversationOptions) {
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [draft, setDraft] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [messagePending, setMessagePending] = useState(false);
  const [messagingIdentity, setMessagingIdentity] =
    useState<MessagingIdentity | null>(null);
  const [participants, setParticipants] =
    useState<RoomParticipant[]>([]);
  const [messageTarget, setMessageTarget] = useState("group");

  // Typing is live pairwise presence and never becomes a chat/on-chain record.
  const [peerTyping, setPeerTyping] = useState(false);

  // Avoid repeatedly publishing the same read receipt while a message stays visible.
  const sentReadReceiptsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!roomId || !session) {
      setMessagingIdentity(null);
      return;
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
        console.error("[VINSS MESSAGING IDENTITY]", err);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, session]);

  useEffect(() => {
    if (
      !roomId ||
      !session ||
      !channelKey ||
      !messagingIdentity
    ) {
      return;
    }

    const storageKey =
      `vinss:pending-message:${roomId}:` +
      session.account.address.toLowerCase();

    const raw =
      window.localStorage.getItem(storageKey);

    if (!raw) {
      setMessagePending(false);
      return;
    }

    let pending: {
      actionLocator: string;
      body: string;
      sentAt: string;
      scope: "group" | "direct";
      recipientAddress: string | null;
      createdAt: number;
    };

    try {
      pending = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(storageKey);
      setMessagePending(false);
      return;
    }

    setMessagePending(true);

    let cancelled = false;

    const recover = async () => {
      if (cancelled) return;

      // Don't leave a dead pending message around forever.
      if (
        Date.now() - pending.createdAt >
        90_000
      ) {
        window.localStorage.removeItem(storageKey);
        setMessagePending(false);
        setBusy(false);

        setError(
          "Message was not confirmed. You can try sending it again.",
        );

        return;
      }

      try {
        let route: MessageRoute | undefined;

        if (
          pending.scope === "direct" &&
          pending.recipientAddress
        ) {
          const participant =
            participants.find(
              (item) =>
                item.address.toLowerCase() ===
                pending.recipientAddress!.toLowerCase(),
            );

          if (!participant) {
            return;
          }

          const directKey =
            await deriveDirectMessageKey(
              roomId,
              messagingIdentity.privateKey,
              participant.publicKey,
            );

          route = {
            recipientIdentity:
              participant.address,
            encryptionKey: directKey,
            routingKey: directKey,
          };
        }

        const discovered =
          await discoverMessages(
            BACKEND_URL,
            channelKey,
            route,
          );

        const found = discovered.find(
          (item) =>
            BigInt(item.actionLocator).toString(16) ===
            pending.actionLocator,
        );

        if (!found || cancelled) {
          return;
        }

        const locator =
          BigInt(found.actionLocator).toString(16);

        setEntries((prev) => {
          let matched = false;

          const next = prev.map((entry) => {
            if (
              entry.kind === "message" &&
              entry.actionLocator === locator
            ) {
              matched = true;

              return {
                ...entry,
                transactionHash:
                  found.transactionHash,
                senderAddress:
                  found.message.senderIdentity?.address ??
                  entry.senderAddress,
              };
            }

            return entry;
          });

          if (matched) return next;

          return [
            ...next,
            {
              id: crypto.randomUUID(),
              kind: "message",
              summary: found.message.body,
              transactionHash:
                found.transactionHash,
              actionLocator: locator,
              sentAt: found.message.sentAt,

              // Preserve the decrypted scope so Group and direct chats stay separate.
              scope: found.message.scope ?? "group",

              // Preserve the decrypted recipient only in local UI state.
              recipientAddress: found.message.recipientAddress,

              // Preserve the decrypted sender only in local UI state.
              senderAddress:
                found.message.senderIdentity?.address,
            },
          ];
        });

        window.localStorage.removeItem(storageKey);

        setMessagePending(false);
        setBusy(false);
        setError(null);

        setDraft((current) =>
          current.trim() === pending.body
            ? ""
            : current,
        );
      } catch (err) {
      }
    };

    void recover();

    const timer = window.setInterval(() => {
      void recover();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    roomId,
    session,
    channelKey,
    messagingIdentity,
    participants,
  ]);

  // Keep participant dependencies stable across background discovery refreshes.
  const participantFingerprint = participants
    .map(
      (participant) =>
        `${participant.address.toLowerCase()}:${participant.publicKey}`,
    )
    .sort()
    .join("|");

  // Track only the empty/non-empty transition so continuous typing does not
  // restart the heartbeat on every character.
  const hasTypingDraft = Boolean(draft.trim());

  // Resolve the currently selected direct chat to its pairwise key.
  async function resolveSelectedDirectKey(): Promise<Uint8Array | null> {
    if (
      !roomId ||
      !session ||
      !messagingIdentity ||
      messageTarget === "group"
    ) {
      return null;
    }

    const participant = participants.find(
      (item) =>
        item.address.toLowerCase() ===
        messageTarget.toLowerCase(),
    );

    if (!participant) return null;

    return deriveDirectMessageKey(
      roomId,
      messagingIdentity.privateKey,
      participant.publicKey,
    );
  }

  useEffect(() => {
    // Typing presence exists only while a direct chat is open.
    if (
      !active ||
      !session ||
      messageTarget === "group" ||
      !messagingIdentity ||
      !participantFingerprint
    ) {
      return;
    }

    let stopped = false;
    let interval: number | null = null;

    const publishTyping = async (typing: boolean) => {
      try {
        const directKey = await resolveSelectedDirectKey();

        if (!directKey || stopped) return;

        await publishPresence(
          BACKEND_URL,
          directKey,
          {
            version: 1,
            type: "typing",
            senderAddress: session.account.address,
            sentAt: new Date().toISOString(),
            active: typing,
          },
          typing ? 5_000 : 2_000,
        );
      } catch (err) {
        // Presence failure must never block normal encrypted messaging.
        console.error("[VINSS TYPING PRESENCE ERROR]", err);
      }
    };

    if (hasTypingDraft) {
      // Publish immediately, then heartbeat while the user continues typing.
      void publishTyping(true);

      interval = window.setInterval(() => {
        void publishTyping(true);
      }, 2_000);
    } else {
      // An explicit inactive event hides the indicator faster than TTL expiry.
      void publishTyping(false);
    }

    return () => {
      stopped = true;

      if (interval !== null) {
        window.clearInterval(interval);
      }

      // The short server TTL remains the final fallback if cleanup is interrupted.
      void (async () => {
        try {
          const directKey = await resolveSelectedDirectKey();

          if (!directKey) return;

          await publishPresence(
            BACKEND_URL,
            directKey,
            {
              version: 1,
              type: "typing",
              senderAddress: session.account.address,
              sentAt: new Date().toISOString(),
              active: false,
            },
            2_000,
          );
        } catch {
          // Cleanup presence is best-effort only.
        }
      })();
    };
  }, [
    active,
    session?.account.address,
    messageTarget,
    messagingIdentity?.publicKey,
    participantFingerprint,
    hasTypingDraft,
  ]);

  useEffect(() => {
    // Poll the selected pair only; Group has no per-user read/typing state.
    if (
      !active ||
      !session ||
      messageTarget === "group" ||
      !messagingIdentity ||
      !participantFingerprint
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
        const directKey = await resolveSelectedDirectKey();

        if (!directKey || stopped) return;

        const events = await pollPresence(
          BACKEND_URL,
          directKey,
        );

        if (stopped) return;

        const self = session.account.address.toLowerCase();
        const peer = messageTarget.toLowerCase();

        // Only encrypted events from the selected peer affect this chat.
        const peerEvents = events.filter(
          (event) =>
            event.senderAddress.toLowerCase() === peer &&
            event.senderAddress.toLowerCase() !== self,
        );

        const latestTyping = peerEvents
          .filter((event) => event.type === "typing")
          .sort(
            (left, right) =>
              new Date(right.sentAt).getTime() -
              new Date(left.sentAt).getTime(),
          )[0];

        setPeerTyping(
          Boolean(
            latestTyping?.active &&
            latestTyping.expiresAt > Date.now(),
          ),
        );

        // Apply encrypted read receipts to this wallet's matching outgoing messages.
        const readByLocator = new Map<string, string>();

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
                entry.kind !== "message" ||
                entry.scope !== "direct" ||
                entry.senderAddress?.toLowerCase() !== self ||
                entry.recipientAddress?.toLowerCase() !== peer
              ) {
                return entry;
              }

              const readAt = readByLocator.get(
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
        // Live presence is optional and must not surface as a blocking UI error.
        console.error("[VINSS PRESENCE POLL ERROR]", err);
        setPeerTyping(false);
      } finally {
        running = false;
      }
    };

    void poll();

    const timer = window.setInterval(() => {
      void poll();
    }, 1_200);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      setPeerTyping(false);
    };
  }, [
    active,
    session?.account.address,
    messageTarget,
    messagingIdentity?.publicKey,
    participantFingerprint,
  ]);

  useEffect(() => {
    // A direct incoming message is considered read only while its chat is open.
    if (
      !active ||
      !session ||
      messageTarget === "group" ||
      !messagingIdentity ||
      !participantFingerprint
    ) {
      return;
    }

    const self = session.account.address.toLowerCase();
    const peer = messageTarget.toLowerCase();

    const unreadIncoming = entries.filter(
      (entry) =>
        entry.kind === "message" &&
        entry.scope === "direct" &&
        Boolean(entry.transactionHash) &&
        entry.senderAddress?.toLowerCase() === peer &&
        entry.recipientAddress?.toLowerCase() === self &&
        !sentReadReceiptsRef.current.has(
          entry.actionLocator
            .replace(/^0x/, "")
            .toLowerCase(),
        ),
    );

    if (unreadIncoming.length === 0) return;

    let cancelled = false;

    const publishReceipts = async () => {
      try {
        const directKey = await resolveSelectedDirectKey();

        if (!directKey || cancelled) return;

        for (const entry of unreadIncoming) {
          const locator = entry.actionLocator
            .replace(/^0x/, "")
            .toLowerCase();

          // Mark before awaiting so overlapping renders cannot publish duplicates.
          sentReadReceiptsRef.current.add(locator);

          try {
            await publishPresence(
              BACKEND_URL,
              directKey,
              {
                version: 1,
                type: "read",
                senderAddress: session.account.address,
                sentAt: new Date().toISOString(),
                messageLocator: locator,
              },
              24 * 60 * 60 * 1_000,
            );
          } catch (err) {
            // Allow a later render to retry a receipt that failed to publish.
            sentReadReceiptsRef.current.delete(locator);
            console.error("[VINSS READ RECEIPT ERROR]", err);
          }
        }
      } catch (err) {
        console.error("[VINSS READ RECEIPT KEY ERROR]", err);
      }
    };

    void publishReceipts();

    return () => {
      cancelled = true;
    };
  }, [
    active,
    session?.account.address,
    messageTarget,
    messagingIdentity?.publicKey,
    participantFingerprint,
    entries,
  ]);

  async function handleSendMessage() {
    if (messagePending) {
      setError(
        "Your previous message is still being confirmed.",
      );
      return;
    }

    if (
      !session ||
      !roomId ||
      !channelKey ||
      !messagingIdentity ||
      !draft.trim()
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    const body = draft.trim();

    const storageKey =
      `vinss:pending-message:${roomId}:` +
      session.account.address.toLowerCase();

    let preparedLocator: string | null = null;

    try {
      let route: MessageRoute | undefined;
      let recipientAddress: string | undefined;

      if (messageTarget !== "group") {
        const participant = participants.find(
          (item) =>
            item.address.toLowerCase() ===
            messageTarget.toLowerCase(),
        );

        if (!participant) {
          throw new Error(
            "Direct recipient is not available in this room yet.",
          );
        }

        const directKey = await deriveDirectMessageKey(
          roomId,
          messagingIdentity.privateKey,
          participant.publicKey,
        );

        recipientAddress = participant.address;

        route = {
          recipientIdentity: participant.address,
          encryptionKey: directKey,
          routingKey: directKey,
        };
      }

      const payload: MessagePayload = {
        kind: "text",
        scope: route ? "direct" : "group",
        body,
        senderIdentity: {
          address: session.account.address,
          messagingPublicKey: messagingIdentity.publicKey,
        },
        recipientAddress,
        sentAt: new Date().toISOString(),
      };

      const sendPromise = sendMessage(
        session.account,
        channelKey,
        payload,
        route,
        (prepared) => {
          preparedLocator =
            prepared.actionLocator.toString(16);

          setMessagePending(true);

          window.localStorage.setItem(
            storageKey,
            JSON.stringify({
              actionLocator: preparedLocator,
              body,
              sentAt: payload.sentAt,
              scope: payload.scope ?? "group",
              recipientAddress:
                payload.recipientAddress ?? null,
              createdAt: Date.now(),
            }),
          );

          // Show the message immediately on the sender device.
          setEntries((prev) => {
            if (
              prev.some(
                (entry) =>
                  entry.kind === "message" &&
                  entry.actionLocator === preparedLocator,
              )
            ) {
              return prev;
            }

            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                kind: "message",
                summary: body,
                transactionHash: "",
                actionLocator: preparedLocator!,
                sentAt: payload.sentAt,

                // Preserve the local message scope for immediate chat filtering.
                scope: payload.scope ?? "group",

                // Preserve the intended direct recipient only in local UI state.
                recipientAddress: payload.recipientAddress,

                // Preserve the local sender identity only in local UI state.
                senderAddress:
                  session.account.address,
              },
            ];
          });

          // Composer feels instant; chain confirmation continues
          // in the background.
          setDraft("");
        },
      );

      // Ready X may background/remount the dapp and never resolve
      // its original JS callback. Don't let VINSS stay busy forever.
      const result = await Promise.race([
        sendPromise,
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(
              new Error(
                "VINSS_MESSAGE_CALLBACK_TIMEOUT",
              ),
            );
          }, 20000);
        }),
      ]);

      window.localStorage.removeItem(storageKey);
      setMessagePending(false);

      const confirmedLocator =
        result.actionLocator.toString(16);

      setEntries((prev) => {
        let matched = false;

        const next = prev.map((entry) => {
          if (
            entry.kind === "message" &&
            entry.actionLocator === confirmedLocator
          ) {
            matched = true;

            return {
              ...entry,
              transactionHash:
                result.transactionHash,
              senderAddress:
                session.account.address,
            };
          }

          return entry;
        });

        if (matched) return next;

        return [
          ...next,
          {
            id: crypto.randomUUID(),
            kind: "message",
            summary: body,
            transactionHash:
              result.transactionHash,
            actionLocator: confirmedLocator,
            sentAt: payload.sentAt,

            // Preserve the local message scope after wallet confirmation.
            scope: payload.scope ?? "group",

            // Preserve the intended direct recipient only in local UI state.
            recipientAddress: payload.recipientAddress,

            // Preserve the local sender identity only in local UI state.
            senderAddress:
              session.account.address,
          },
        ];
      });
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      console.error("[VINSS SEND ERROR]", err);

      // These errors mean the request did not become an ambiguous
      // background transaction. Clear the pending record immediately.
      const definitelyFailed =
        /USER_REFUSED|INVALID_REQUEST_PAYLOAD|NOT_REGISTERED|INSUFFICIENT_PRIVATE_BALANCE|PRIVACY_LEAK/i.test(
          raw,
        );

      if (definitelyFailed) {
        window.localStorage.removeItem(storageKey);
        setMessagePending(false);

        if (preparedLocator) {
          setEntries((prev) =>
            prev.filter(
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
            "Message could not be sent. Please try again.",
          ),
        );
        return;
      }

      if (preparedLocator) {
        // Keep recovery metadata. The polling effect below determines
        // whether the transaction actually landed on-chain.
        setMessagePending(true);

        if (
          raw.includes(
            "VINSS_MESSAGE_CALLBACK_TIMEOUT",
          )
        ) {
          setError(
            "Message is being confirmed in the background.",
          );
        } else {
          setError(
            "Wallet response was interrupted. VINSS is checking the message on-chain.",
          );
        }

        return;
      }

      setMessagePending(false);
      setError(
        humanizeError(
          err,
          "Message could not be sent. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }


  async function handleRefresh(
    silent = false,
  ) {
    if (!channelKey) return;

    if (!silent) {
      setBusy(true);
      setError(null);
    }

    try {
      // Pass 1: decrypt GROUP messages.
      //
      // Group messages are also the private participant-key exchange:
      // sender wallet + messaging public key live inside ciphertext.
      const groupMessages = await discoverMessages(
        BACKEND_URL,
        channelKey,
      ).catch((err) => {
        console.error("[VINSS GROUP DISCOVERY FAILED]", err);
        return [];
      });

      const participantMap = new Map<
        string,
        RoomParticipant
      >();

      for (const item of groupMessages) {
        const sender = item.message.senderIdentity;

        if (
          !sender?.address ||
          !sender.messagingPublicKey
        ) {
          continue;
        }

        if (
          session &&
          sender.address.toLowerCase() ===
            session.account.address.toLowerCase()
        ) {
          continue;
        }

        participantMap.set(
          sender.address.toLowerCase(),
          {
            address: sender.address,
            publicKey: sender.messagingPublicKey,
          },
        );
      }

      const discoveredParticipants = [
        ...participantMap.values(),
      ];

      setParticipants(discoveredParticipants);

      // Pass 2: now that participant public keys are known from the
      // encrypted group conversation, derive pairwise Alice<->Bob keys
      // and discover messages addressed specifically to THIS wallet.
      let directMessages: Awaited<
        ReturnType<typeof discoverMessages>
      > = [];

      if (
        roomId &&
        session &&
        messagingIdentity &&
        discoveredParticipants.length > 0
      ) {
        const routes: MessageRoute[] = [];

        for (const participant of discoveredParticipants) {
          const directKey = await deriveDirectMessageKey(
            roomId,
            messagingIdentity.privateKey,
            participant.publicKey,
          );

          // Incoming direct messages route to this wallet.
          routes.push({
            recipientIdentity: session.account.address,
            encryptionKey: directKey,
            routingKey: directKey,
          });

          // Outgoing direct messages route to the peer. Including this second
          // candidate lets the sender rediscover its own chat after reload.
          routes.push({
            recipientIdentity: participant.address,
            encryptionKey: directKey,
            routingKey: directKey,
          });
        }

        directMessages = await discoverMessages(
          BACKEND_URL,
          channelKey,
          routes,
        ).catch((err) => {
          console.error("[VINSS DIRECT DISCOVERY FAILED]", err);
          return [];
        });
      }

      const messages = [
        ...groupMessages,
        ...directMessages,
      ].filter(
        (item, index, all) =>
          all.findIndex(
            (other) =>
              other.actionLocator === item.actionLocator,
          ) === index,
      );

      const messageEntries: ConversationEntry[] =
        messages.map((m) => ({
          id: crypto.randomUUID(),
          kind: "message",
          summary: m.message.body,
          transactionHash: m.transactionHash,
          actionLocator:
            m.actionLocator.replace(/^0x/, ""),
          sentAt: m.message.sentAt,

          // Preserve decrypted scope only on the client for chat separation.
          scope: m.message.scope ?? "group",

          // Preserve the decrypted recipient only on the client.
          recipientAddress: m.message.recipientAddress,

          // Preserve the decrypted sender only on the client.
          senderAddress:
            m.message.senderIdentity?.address,
        }));

      setEntries((prev) => {
        // Keep the generic conversation timeline limited to chat messages.
        const incoming = messageEntries;

        const byLocator = new Map(
          prev.map((entry) => [
            `${entry.kind}:${entry.actionLocator}`,
            entry,
          ]),
        );

        for (const entry of incoming) {
          const key =
            `${entry.kind}:${entry.actionLocator}`;

          const existing = byLocator.get(key);

          byLocator.set(key, {
            ...existing,
            ...entry,
            senderAddress:
              entry.senderAddress ??
              existing?.senderAddress,
          });
        }

        return [...byLocator.values()].sort(
          (a, b) =>
            new Date(a.sentAt).getTime() -
            new Date(b.sentAt).getTime(),
        );
      });
    } catch (err) {
      // Raw discovery failures are developer-only and never rendered directly.
      console.error("[VINSS ROOM REFRESH ERROR]", err);

      if (!silent) {
        setError(
          humanizeError(
            err,
            "We couldn't refresh the room. Please try again in a moment.",
          ),
        );
      }
    } finally {
      if (!silent) {
        setBusy(false);
      }
    }
  }

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
        await handleRefresh(true);
      } finally {
        running = false;
      }
    };

    // Sync immediately when the user enters the room.
    void sync();

    const timer = window.setInterval(() => {
      void sync();
    }, 2500);

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
    channelKey,
    session?.account.address,
    messagingIdentity?.publicKey,
  ]);

  // Keep the selected chat pinned to the newest visible message.
  useEffect(() => {
    if (
      !active ||
      entries.length === 0
    ) {
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
  }, [entries.length, active]);

  return {
    entries,
    setEntries,
    draft,
    setDraft,
    chatEndRef,
    participants,
    setParticipants,
    messageTarget,
    setMessageTarget,
    peerTyping,
    handleSendMessage,
    handleRefresh,
  };
}
