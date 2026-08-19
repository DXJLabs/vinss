"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import {
  BACKEND_URL,
} from "@/lib/starknet/constants";
import {
  discoverMessages,
  sendMessage,
} from "@/lib/deal-room/messaging";
import type {
  MessagingIdentity,
} from "@/lib/privacy/participantKeys";
import type {
  MessagePayload,
} from "@/types/deal-room";
import type {
  ConversationEntry,
} from "@/components/room/conversation/types";
import {
  humanizeError,
} from "@/lib/errors/uiError";
import type {
  LocalRoomGroup,
} from "@/lib/groups/localGroups";

interface UseGroupConversationOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  group: LocalRoomGroup | null;
  groupKey: Uint8Array | null;
  messagingIdentity: MessagingIdentity | null;
  active: boolean;
  setBusy: (
    value: boolean,
  ) => void;
  setError: (
    value: string | null,
  ) => void;
}

interface UseGroupConversationResult {
  entries: ConversationEntry[];
  draft: string;
  setDraft: Dispatch<
    SetStateAction<string>
  >;
  chatEndRef: MutableRefObject<
    HTMLDivElement | null
  >;
  sendGroupMessage: () => Promise<void>;
  refreshGroup: (
    silent?: boolean,
  ) => Promise<void>;
}

function locatorHex(
  value: string,
): string {
  return BigInt(value).toString(16);
}

export function useGroupConversation({
  roomId,
  session,
  group,
  groupKey,
  messagingIdentity,
  active,
  setBusy,
  setError,
}: UseGroupConversationOptions): UseGroupConversationResult {
  const [entries, setEntries] =
    useState<ConversationEntry[]>([]);

  const [draft, setDraft] =
    useState("");

  const [pending, setPending] =
    useState(false);

  const pendingBodyRef =
    useRef<string | null>(null);

  const chatEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(() => {
    // Never carry one Group's decrypted timeline into another Group.
    setEntries([]);
    setDraft("");
    setPending(false);
    pendingBodyRef.current = null;
  }, [group?.id]);

  async function refreshGroup(
    silent = false,
  ): Promise<void> {
    if (
      !group ||
      !groupKey
    ) {
      return;
    }

    if (!silent) {
      setBusy(true);
      setError(null);
    }

    try {
      const discovered =
        await discoverMessages(
          BACKEND_URL,
          groupKey,
        );

      const incoming:
        ConversationEntry[] =
        discovered
          .filter(
            (item) =>
              (item.message.scope ??
                "group") ===
                "group" &&
              item.message.groupId ===
                group.id,
          )
          .map((item) => ({
            id: `group:${group.id}:${locatorHex(
              item.actionLocator,
            )}`,
            kind: "message",
            summary:
              item.message.body,
            transactionHash:
              item.transactionHash,
            actionLocator:
              locatorHex(
                item.actionLocator,
              ),
            sentAt:
              item.message.sentAt,
            scope: "group",
            groupId:
              group.id,
            senderAddress:
              item.message
                .senderIdentity
                ?.address,
          }));

      setEntries((previous) => {
        const byLocator =
          new Map(
            previous.map(
              (entry) => [
                entry.actionLocator,
                entry,
              ],
            ),
          );

        for (const entry of incoming) {
          byLocator.set(
            entry.actionLocator,
            {
              ...byLocator.get(
                entry.actionLocator,
              ),
              ...entry,
            },
          );
        }

        return [
          ...byLocator.values(),
        ].sort(
          (left, right) =>
            new Date(
              left.sentAt,
            ).getTime() -
            new Date(
              right.sentAt,
            ).getTime(),
        );
      });
    } catch (err) {
      console.error(
        "[VINSS GROUP DISCOVERY ERROR]",
        err,
      );

      if (!silent) {
        setError(
          humanizeError(
            err,
            "We couldn't refresh this Group.",
          ),
        );
      }
    } finally {
      if (!silent) {
        setBusy(false);
      }
    }
  }

  function pendingStorageKey():
    | string
    | null {
    if (
      !roomId ||
      !session ||
      !group
    ) {
      return null;
    }

    return (
      `vinss:pending-group-message:${roomId}:` +
      `${group.id}:` +
      session.account.address.toLowerCase()
    );
  }

  async function sendGroupMessage():
    Promise<void> {
    if (pending) {
      setError(
        "Your previous Group message is still being confirmed.",
      );
      return;
    }

    if (
      !roomId ||
      !session ||
      !group ||
      !groupKey ||
      !messagingIdentity ||
      !draft.trim()
    ) {
      return;
    }

    const storageKey =
      pendingStorageKey();

    if (!storageKey) return;

    const body =
      draft.trim();

    const sentAt =
      new Date().toISOString();

    setBusy(true);
    setError(null);

    let preparedLocator:
      | string
      | null = null;

    try {
      const payload:
        MessagePayload = {
        kind: "text",
        scope: "group",
        groupId: group.id,
        body,
        senderIdentity: {
          address:
            session.account.address,
          messagingPublicKey:
            messagingIdentity.publicKey,
        },
        sentAt,
      };

      const result =
        await sendMessage(
          session.account,
          groupKey,
          payload,
          undefined,
          (prepared) => {
            preparedLocator =
              prepared.actionLocator.toString(
                16,
              );

            pendingBodyRef.current =
              body;

            setPending(true);

            // Persist only non-plaintext recovery metadata.
            window.localStorage.setItem(
              storageKey,
              JSON.stringify({
                actionLocator:
                  preparedLocator,
                sentAt,
                createdAt:
                  Date.now(),
              }),
            );

            setEntries(
              (previous) => [
                ...previous.filter(
                  (entry) =>
                    entry.actionLocator !==
                    preparedLocator,
                ),
                {
                  id: `group:${group.id}:${preparedLocator}`,
                  kind: "message",
                  summary: body,
                  transactionHash:
                    "",
                  actionLocator:
                    preparedLocator!,
                  sentAt,
                  scope: "group",
                  groupId:
                    group.id,
                  senderAddress:
                    session.account
                      .address,
                },
              ],
            );

            setDraft("");
          },
        );

      window.localStorage.removeItem(
        storageKey,
      );

      pendingBodyRef.current =
        null;

      setPending(false);

      const confirmedLocator =
        result.actionLocator.toString(
          16,
        );

      setEntries((previous) =>
        previous.map((entry) =>
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
    } catch (err) {
      console.error(
        "[VINSS GROUP SEND ERROR]",
        err,
      );

      const raw =
        err instanceof Error
          ? err.message
          : String(err);

      const definitelyFailed =
        /USER_REFUSED|INVALID_REQUEST_PAYLOAD|NOT_REGISTERED|INSUFFICIENT_PRIVATE_BALANCE|PRIVACY_LEAK/i.test(
          raw,
        );

      if (
        definitelyFailed &&
        preparedLocator
      ) {
        window.localStorage.removeItem(
          storageKey,
        );

        setPending(false);

        setEntries((previous) =>
          previous.filter(
            (entry) =>
              entry.actionLocator !==
              preparedLocator,
          ),
        );

        pendingBodyRef.current =
          null;

        setDraft(body);

        setError(
          humanizeError(
            err,
            "Group message could not be sent.",
          ),
        );

        return;
      }

      if (preparedLocator) {
        setError(
          "Group message is being confirmed in the background.",
        );
      } else {
        pendingBodyRef.current =
          null;

        setDraft(body);

        setError(
          humanizeError(
            err,
            "Group message could not be sent.",
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !session ||
      !group
    ) {
      return;
    }

    const storageKey =
      pendingStorageKey();

    if (!storageKey) return;

    let stopped = false;

    const checkPending = () => {
      if (stopped) return;

      const raw =
        window.localStorage.getItem(
          storageKey,
        );

      if (!raw) {
        setPending(false);
        return;
      }

      let pendingRecord: {
        actionLocator: string;
        createdAt: number;
      };

      try {
        pendingRecord =
          JSON.parse(raw);
      } catch {
        window.localStorage.removeItem(
          storageKey,
        );
        setPending(false);
        return;
      }

      setPending(true);

      const locator =
        pendingRecord.actionLocator
          .replace(/^0x/, "")
          .toLowerCase();

      const recovered =
        entries.find(
          (entry) =>
            entry.actionLocator
              .replace(/^0x/, "")
              .toLowerCase() ===
              locator &&
            Boolean(
              entry.transactionHash,
            ),
        );

      if (recovered) {
        window.localStorage.removeItem(
          storageKey,
        );

        pendingBodyRef.current =
          null;

        setPending(false);
        setError(null);
        return;
      }

      if (
        Date.now() -
          pendingRecord.createdAt >
        60_000
      ) {
        window.localStorage.removeItem(
          storageKey,
        );

        setPending(false);

        setEntries((previous) =>
          previous.filter(
            (entry) =>
              entry.actionLocator
                .replace(/^0x/, "")
                .toLowerCase() !==
              locator,
          ),
        );

        const body =
          pendingBodyRef.current;

        pendingBodyRef.current =
          null;

        if (body) {
          setDraft((current) =>
            current.trim()
              ? current
              : body,
          );
        }

        setError(
          "Group message was not confirmed. Review it and try again.",
        );
      }
    };

    checkPending();

    const timer =
      window.setInterval(
        checkPending,
        2_000,
      );

    return () => {
      stopped = true;
      window.clearInterval(
        timer,
      );
    };
  }, [
    active,
    roomId,
    group?.id,
    session?.account.address,
    entries,
  ]);

  useEffect(() => {
    if (
      !active ||
      !roomId ||
      !group ||
      !groupKey ||
      !session
    ) {
      return;
    }

    let stopped = false;
    let running = false;

    const sync = async () => {
      if (
        stopped ||
        running
      ) {
        return;
      }

      running = true;

      try {
        await refreshGroup(
          true,
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
        2500,
      );

    const onVisible = () => {
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
    group?.id,
    groupKey,
    session?.account.address,
    messagingIdentity?.publicKey,
  ]);

  useEffect(() => {
    if (
      !active ||
      entries.length === 0
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        chatEndRef.current
          ?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
      }, 80);

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    entries.length,
    active,
  ]);

  return {
    entries,
    draft,
    setDraft,
    chatEndRef,
    sendGroupMessage,
    refreshGroup,
  };
}
