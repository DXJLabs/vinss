"use client";

import {
  useEffect,
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
import type { MessagingIdentity } from "@/lib/privacy/participantKeys";
import type { MessagePayload } from "@/types/deal-room";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { humanizeError } from "@/lib/errors/uiError";

interface UseGroupConversationOptions {
  roomId: string | null;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  messagingIdentity: MessagingIdentity | null;
  active: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

interface UseGroupConversationResult {
  entries: ConversationEntry[];
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  chatEndRef: MutableRefObject<HTMLDivElement | null>;
  sendGroupMessage: () => Promise<void>;
  refreshGroup: (silent?: boolean) => Promise<void>;
}

function locatorHex(value: string): string {
  return BigInt(value).toString(16);
}

export function useGroupConversation({
  roomId,
  session,
  channelKey,
  messagingIdentity,
  active,
  setBusy,
  setError,
}: UseGroupConversationOptions): UseGroupConversationResult {
  const [entries, setEntries] =
    useState<ConversationEntry[]>([]);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  const chatEndRef =
    useRef<HTMLDivElement | null>(null);

  async function refreshGroup(
    silent = false,
  ): Promise<void> {
    if (!channelKey) return;

    if (!silent) {
      setBusy(true);
      setError(null);
    }

    try {
      const discovered = await discoverMessages(
        BACKEND_URL,
        channelKey,
      );

      const incoming: ConversationEntry[] =
        discovered
          .filter(
            (item) =>
              (item.message.scope ?? "group") ===
              "group",
          )
          .map((item) => ({
            id: `group:${locatorHex(
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
            scope: "group",
            senderAddress:
              item.message.senderIdentity?.address,
          }));

      setEntries((previous) => {
        const byLocator = new Map(
          previous.map((entry) => [
            entry.actionLocator,
            entry,
          ]),
        );

        for (const entry of incoming) {
          byLocator.set(entry.actionLocator, {
            ...byLocator.get(
              entry.actionLocator,
            ),
            ...entry,
          });
        }

        return [...byLocator.values()].sort(
          (left, right) =>
            new Date(left.sentAt).getTime() -
            new Date(right.sentAt).getTime(),
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
            "We couldn't refresh the group chat.",
          ),
        );
      }
    } finally {
      if (!silent) {
        setBusy(false);
      }
    }
  }

  async function sendGroupMessage(): Promise<void> {
    if (pending) {
      setError(
        "Your previous group message is still being confirmed.",
      );
      return;
    }

    if (
      !roomId ||
      !session ||
      !channelKey ||
      !messagingIdentity ||
      !draft.trim()
    ) {
      return;
    }

    const body = draft.trim();
    const sentAt = new Date().toISOString();

    const storageKey =
      `vinss:pending-group-message:${roomId}:` +
      session.account.address.toLowerCase();

    setBusy(true);
    setError(null);

    let preparedLocator: string | null = null;

    try {
      const payload: MessagePayload = {
        kind: "text",
        scope: "group",
        body,
        senderIdentity: {
          address: session.account.address,
          messagingPublicKey:
            messagingIdentity.publicKey,
        },
        sentAt,
      };

      const result = await sendMessage(
        session.account,
        channelKey,
        payload,
        undefined,
        (prepared) => {
          preparedLocator =
            prepared.actionLocator.toString(16);

          setPending(true);

          window.localStorage.setItem(
            storageKey,
            JSON.stringify({
              actionLocator:
                preparedLocator,
              body,
              sentAt,
              createdAt: Date.now(),
            }),
          );

          setEntries((previous) => [
            ...previous.filter(
              (entry) =>
                entry.actionLocator !==
                preparedLocator,
            ),
            {
              id: `group:${preparedLocator}`,
              kind: "message",
              summary: body,
              transactionHash: "",
              actionLocator:
                preparedLocator!,
              sentAt,
              scope: "group",
              senderAddress:
                session.account.address,
            },
          ]);

          setDraft("");
        },
      );

      window.localStorage.removeItem(
        storageKey,
      );
      setPending(false);

      const confirmedLocator =
        result.actionLocator.toString(16);

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
        // An interrupted wallet callback may still have landed on-chain.
        // Give discovery a short, bounded recovery window.
        setError(
          "Group message is being confirmed in the background.",
        );
      } else {
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
    if (!roomId || !session) return;

    const storageKey =
      `vinss:pending-group-message:${roomId}:` +
      session.account.address.toLowerCase();

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
        body?: string;
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

        if (pendingRecord.body) {
          setDraft((current) =>
            current.trim()
              ? current
              : pendingRecord.body!,
          );
        }

        setError(
          "Group message was not confirmed. Review it and try again.",
        );
      }
    };

    checkPending();

    const timer = window.setInterval(
      checkPending,
      2_000,
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [
    roomId,
    session?.account.address,
    entries,
  ]);

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
        await refreshGroup(true);
      } finally {
        running = false;
      }
    };

    void sync();

    const timer = window.setInterval(() => {
      void sync();
    }, 2500);

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
  }, [entries.length, active]);

  return {
    entries,
    draft,
    setDraft,
    chatEndRef,
    sendGroupMessage,
    refreshGroup,
  };
}
