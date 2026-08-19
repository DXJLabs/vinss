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

          routes.push({
            // For receive-side matching the recipient is ME,
            // not the peer.
            recipientIdentity: session.account.address,
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
      if (!silent) {
        setError(
          humanizeError(
            err,
            "We couldn't refresh the room. Please try again in a moment.",
          ),
        );
      } else {
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

    // Langsung sync saat masuk room.
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
    handleSendMessage,
    handleRefresh,
  };
}
