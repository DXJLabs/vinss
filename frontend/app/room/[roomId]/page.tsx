"use client";

import { useParams, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { StatusBadge } from "@/components/StatusBadge";
import { useWallet } from "@/components/providers/WalletProvider";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { sendMessage, discoverMessages } from "@/lib/vinss-sdk/messaging";
import { createOffer, discoverOfferActions } from "@/lib/vinss-sdk/offer";
import {
  sendEscrowCoordinationAction,
  generateEscrowSecrets,
  generateCustodyCommitment,
  computeReleaseCommitment,
  computeRefundCommitment,
  depositEscrow,
} from "@/lib/vinss-sdk/escrow";
import { deriveChannelKeyFromRoomSecret } from "@/lib/vinss-sdk/channelKey";
import {
  deriveDirectMessageKey,
  getOrCreateMessagingIdentity,
  type MessagingIdentity,
  type RoomParticipant,
} from "@/lib/vinss-sdk/participantKeys";
import type { MessagePayload, OfferActionPayload, DealType } from "@/lib/vinss-sdk/types";
import type { MessageRoute } from "@/lib/vinss-sdk/messageRouting";
import { BACKEND_URL, NETWORK } from "@/lib/starknet/constants";
import { AgentPanel } from "@/components/AgentPanel";
import type { AgentProposal } from "@/lib/agent";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import {
  createInviteToken,
  getInviteOnchainState,
} from "@/lib/vinss-sdk/invite";

type Tab = "timeline" | "offer" | "escrow" | "loyalty";

interface TimelineEntry {
  id: string;
  kind: "message" | "offer";
  summary: string;
  transactionHash: string;
  actionLocator: string;
  sentAt: string;
  senderAddress?: string;
}

interface LocalRoom {
  id: string;
  label: string;
  roomSecret: string;
  createdAt: string;
}


function humanizeError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");

  console.error("[VINSS]", raw);

  if (
    raw.includes("NEXT_PUBLIC_") ||
    raw.includes(".env") ||
    raw.includes("messageHelper")
  ) {
    return "Private messaging is temporarily unavailable. Please try again in a moment.";
  }

  if (
    raw.toLowerCase().includes("rpc") ||
    raw.toLowerCase().includes("network") ||
    raw.toLowerCase().includes("wallet")
  ) {
    return "We couldn't complete that request. Please check your wallet connection and try again.";
  }

  return fallback;
}

function loadRoom(roomId: string): LocalRoom | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("vinss:local-rooms");
    const rooms = raw ? (JSON.parse(raw) as LocalRoom[]) : [];
    return rooms.find((r) => r.id === roomId) ?? null;
  } catch {
    return null;
  }
}

export default function DealRoomPage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const showAccessDetails = searchParams.get("access") === "1";
  const { session } = useWallet();
  const [tab, setTab] = useState<Tab>("timeline");
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [draft, setDraft] = useState("");
  const chatEndRef =
    useRef<HTMLDivElement | null>(null);
  const [messagePending, setMessagePending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<LocalRoom | null>(null);
  const [channelKey, setChannelKey] = useState<Uint8Array | null>(null);

  const [messagingIdentity, setMessagingIdentity] =
    useState<MessagingIdentity | null>(null);

  const [participants, setParticipants] =
    useState<RoomParticipant[]>([]);

  const [messageTarget, setMessageTarget] =
    useState<string>("group");

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(null);
  const [inviteCommitment, setInviteCommitment] =
    useState<string | null>(null);
  const [inviteNow, setInviteNow] = useState(Date.now());
  const [inviteCopied, setInviteCopied] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [inviteCompleted, setInviteCompleted] = useState(false);
  const [inviteJoinedNotice, setInviteJoinedNotice] = useState(false);

  const [agentOfferDraft, setAgentOfferDraft] = useState<
    Extract<
      AgentProposal,
      { type: "draft_offer" | "draft_counter_offer" }
    > | null
  >(null);

  const [agentEscrowDraft, setAgentEscrowDraft] = useState<
    Extract<AgentProposal, { type: "prepare_escrow" }> | null
  >(null);


  useEffect(() => {
    const r = loadRoom(params.roomId);
    setRoom(r);
    if (r) {
      deriveChannelKeyFromRoomSecret(r.roomSecret).then(async (key) => {
        setChannelKey(key);

        const digest = new Uint8Array(
          await crypto.subtle.digest("SHA-256", Uint8Array.from(key).buffer),
        );

        const fingerprint = Array.from(digest.slice(0, 6))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        console.log("[VINSS CHANNEL FINGERPRINT]", fingerprint);
      });
    }
  }, [params.roomId]);

  useEffect(() => {
    if (!room) return;

    const completed =
      window.localStorage.getItem(
        `vinss:invite-completed:${room.id}`,
      ) === "1";

    setInviteCompleted(completed);

    if (completed) {
      setInviteLink(null);
      setInviteExpiresAt(null);
      setInviteCommitment(null);
      setInvitePending(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(
        `vinss:invite:${room.id}`,
      );

      if (!raw) return;

      const saved = JSON.parse(raw) as {
        link?: string;
        expiresAt?: string;
        commitment?: string;
        status?: "pending" | "ready";
      };

      if (
        saved.link &&
        saved.expiresAt &&
        Date.parse(saved.expiresAt) > Date.now()
      ) {
        setInviteLink(saved.link);
        setInviteExpiresAt(saved.expiresAt);
        setInviteCommitment(saved.commitment ?? null);
        setInvitePending(saved.status === "pending");
        setInviteNow(Date.now());
      } else {
        window.localStorage.removeItem(
          `vinss:invite:${room.id}`,
        );
      }
    } catch {
      window.localStorage.removeItem(
        `vinss:invite:${room.id}`,
      );
    }
  }, [room]);

  useEffect(() => {
    if (!room || !session) {
      setMessagingIdentity(null);
      return;
    }

    let cancelled = false;

    getOrCreateMessagingIdentity(
      room.id,
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
  }, [room, session]);

  async function createInviteLink() {
    if (!room) return;

    setError(null);

    if (!session) {
      setError("Connect your wallet before creating an invite.");
      return;
    }

    // A new invitation must not inherit stale/expired/completed state.
    setInviteLink(null);
    setInviteExpiresAt(null);
    setInviteCommitment(null);
    setInviteCopied(false);
    setInvitePending(false);
    setInviteCompleted(false);
    setInviteJoinedNotice(false);
    setInviteNow(Date.now());

    window.localStorage.removeItem(
      `vinss:invite:${room.id}`,
    );

    window.localStorage.removeItem(
      `vinss:invite-completed:${room.id}`,
    );

    let preparedLink: string | null = null;
    let preparedCommitment: string | null = null;
    let preparedExpiresAt: string | null = null;

    try {
      const invite = await createInviteToken(
        session.account,
        {
          roomId: room.id,
          roomSecret: room.roomSecret,
          label: room.label,
        },
        (prepared) => {
          // IMPORTANT: this runs BEFORE Ready X is opened.
          const link =
            `${window.location.origin}/invite/${prepared.token}` +
            `#k=${prepared.key}`;

          preparedLink = link;
          preparedCommitment = prepared.commitment;
          preparedExpiresAt = prepared.expiresAt;

          setInviteLink(link);
          setInviteExpiresAt(prepared.expiresAt);
          setInviteCommitment(prepared.commitment);
          setInvitePending(true);
          setInviteNow(Date.now());

          window.localStorage.setItem(
            `vinss:invite:${room.id}`,
            JSON.stringify({
              link,
              expiresAt: prepared.expiresAt,
              commitment: prepared.commitment,
              status: "pending",
            }),
          );
        },
      );

      const link =
        preparedLink ??
        `${window.location.origin}/invite/${invite.token}` +
          `#k=${invite.key}`;

      setInviteLink(link);
      setInviteExpiresAt(invite.expiresAt);
      setInviteCommitment(invite.commitment);
      setInvitePending(false);
      setInviteNow(Date.now());

      window.localStorage.setItem(
        `vinss:invite:${room.id}`,
        JSON.stringify({
          link,
          expiresAt: invite.expiresAt,
          commitment: invite.commitment,
          status: "ready",
        }),
      );
    } catch (err) {
      console.error("[VINSS INVITE CREATE]", err);

      // Wallet callbacks can fail/disappear after mobile app switching
      // even when the chain transaction actually landed. Recover using
      // the commitment created before Ready X was opened.
      if (
        preparedCommitment &&
        preparedLink &&
        preparedExpiresAt
      ) {
        try {
          const state =
            await getInviteOnchainState(
              preparedCommitment,
            );

          if (state.exists) {
            setInviteLink(preparedLink);
            setInviteExpiresAt(preparedExpiresAt);
            setInviteCommitment(preparedCommitment);
            setInvitePending(false);
            setInviteNow(Date.now());

            window.localStorage.setItem(
              `vinss:invite:${room.id}`,
              JSON.stringify({
                link: preparedLink,
                expiresAt: preparedExpiresAt,
                commitment: preparedCommitment,
                status: "ready",
              }),
            );

            return;
          }
        } catch {
          // Fall through to real failure cleanup.
        }
      }

      setInviteLink(null);
      setInviteExpiresAt(null);
      setInviteCommitment(null);
      setInvitePending(false);

      window.localStorage.removeItem(
        `vinss:invite:${room.id}`,
      );

      setError(
        "Could not create the private invitation.",
      );
    }
  }

  useEffect(() => {
    if (!inviteExpiresAt) return;

    const timer = window.setInterval(() => {
      setInviteNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [inviteExpiresAt]);

  const inviteRemainingMs = inviteExpiresAt
    ? Math.max(0, Date.parse(inviteExpiresAt) - inviteNow)
    : 0;

  const inviteExpired =
    Boolean(inviteExpiresAt) && inviteRemainingMs <= 0;

  const inviteRemainingSeconds =
    Math.ceil(inviteRemainingMs / 1000);

  const inviteMinutes =
    Math.floor(inviteRemainingSeconds / 60);

  const inviteSeconds =
    inviteRemainingSeconds % 60;

  const inviteCountdown =
    `${inviteMinutes}:${inviteSeconds.toString().padStart(2, "0")}`;

  useEffect(() => {
    if (
      !room ||
      participants.length === 0 ||
      inviteCompleted
    ) {
      return;
    }

    setInviteCompleted(true);
    setInviteJoinedNotice(true);
    setInviteLink(null);
    setInviteExpiresAt(null);
    setInviteCommitment(null);

    window.localStorage.setItem(
      `vinss:invite-completed:${room.id}`,
      "1",
    );

    window.localStorage.removeItem(
      `vinss:invite:${room.id}`,
    );

  }, [room, participants.length, inviteCompleted]);

  useEffect(() => {
    if (
      !inviteLink ||
      inviteExpired ||
      !channelKey ||
      !session ||
      participants.length > 0
    ) {
      return;
    }

    let cancelled = false;

    const checkCounterparty = async () => {
      try {
        const messages = await discoverMessages(
          BACKEND_URL,
          channelKey,
        );

        const map = new Map<string, RoomParticipant>();

        for (const item of messages) {
          const sender = item.message.senderIdentity;

          if (
            !sender?.address ||
            !sender.messagingPublicKey
          ) {
            continue;
          }

          if (
            sender.address.toLowerCase() ===
            session.account.address.toLowerCase()
          ) {
            continue;
          }

          map.set(sender.address.toLowerCase(), {
            address: sender.address,
            publicKey: sender.messagingPublicKey,
          });
        }

        if (!cancelled && map.size > 0) {
          setParticipants([...map.values()]);
        }
      } catch (err) {
        console.debug(
          "[VINSS INVITE PARTICIPANT CHECK]",
          err,
        );
      }
    };

    void checkCounterparty();

    const timer = window.setInterval(() => {
      void checkCounterparty();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    inviteLink,
    inviteExpired,
    channelKey,
    session,
    participants.length,
  ]);

  useEffect(() => {
    if (
      !room ||
      !inviteCommitment ||
      inviteExpired ||
      inviteCompleted
    ) {
      return;
    }

    let cancelled = false;

    const checkConsumed = async () => {
      try {
        const state =
          await getInviteOnchainState(inviteCommitment);

        if (
          cancelled ||
          !state.exists ||
          !state.consumed
        ) {
          return;
        }

        setInviteCompleted(true);
        setInviteJoinedNotice(true);

        setInviteLink(null);
        setInviteExpiresAt(null);
        setInviteCommitment(null);

        window.localStorage.setItem(
          `vinss:invite-completed:${room.id}`,
          "1",
        );

        window.localStorage.removeItem(
          `vinss:invite:${room.id}`,
        );
      } catch (err) {
        console.debug(
          "[VINSS INVITE CONSUMED CHECK]",
          err,
        );
      }
    };

    void checkConsumed();

    const timer = window.setInterval(() => {
      void checkConsumed();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    room,
    inviteCommitment,
    inviteExpired,
    inviteCompleted,
  ]);

  useEffect(() => {
    if (!inviteJoinedNotice) return;

    const timer = window.setTimeout(() => {
      setInviteJoinedNotice(false);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [inviteJoinedNotice]);

  useEffect(() => {
    if (
      !room ||
      !invitePending ||
      !inviteCommitment ||
      inviteExpired
    ) {
      return;
    }

    let cancelled = false;

    const recoverPendingInvite = async () => {
      try {
        const state =
          await getInviteOnchainState(
            inviteCommitment,
          );

        if (
          cancelled ||
          !state.exists
        ) {
          return;
        }

        setInvitePending(false);

        const raw =
          window.localStorage.getItem(
            `vinss:invite:${room.id}`,
          );

        if (!raw) return;

        const saved = JSON.parse(raw) as {
          link?: string;
          expiresAt?: string;
          commitment?: string;
        };

        window.localStorage.setItem(
          `vinss:invite:${room.id}`,
          JSON.stringify({
            ...saved,
            status: "ready",
          }),
        );
      } catch (err) {
        console.debug(
          "[VINSS INVITE PENDING RECOVERY]",
          err,
        );
      }
    };

    void recoverPendingInvite();

    const timer = window.setInterval(() => {
      void recoverPendingInvite();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    room,
    invitePending,
    inviteCommitment,
    inviteExpired,
  ]);

  async function copyInviteLink() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
    } catch {
      setError("Could not copy the invite link.");
    }
  }

  async function shareInviteLink() {
    if (!inviteLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `VINSS — ${room?.label ?? "Private room"}`,
          text: "You're invited to a private VINSS deal room.",
          url: inviteLink,
        });
      } catch {
        // User cancelled native sharing.
      }
      return;
    }

    await copyInviteLink();
  }

  async function handleAgentProposal(
    proposal: AgentProposal,
  ) {
    switch (proposal.type) {
      case "draft_message":
        setDraft(proposal.payload.body);
        setTab("timeline");
        return;

      case "draft_offer":
      case "draft_counter_offer":
        setAgentOfferDraft(proposal);
        setTab("offer");
        return;

      case "prepare_escrow":
        setAgentEscrowDraft(proposal);
        setTab("escrow");
        return;

      case "review_rekber":
        setTab("escrow");
        return;
    }
  }

  useEffect(() => {
    if (
      !room ||
      !session ||
      !channelKey ||
      !messagingIdentity
    ) {
      return;
    }

    const storageKey =
      `vinss:pending-message:${room.id}:` +
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
              room.id,
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
        console.debug(
          "[VINSS MESSAGE RECOVERY]",
          err,
        );
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
    room,
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
      !room ||
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
      `vinss:pending-message:${room.id}:` +
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
          room.id,
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
        setError(raw || "Message could not be sent.");
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
      setError(raw || "Unknown send error");
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
        room &&
        session &&
        messagingIdentity &&
        discoveredParticipants.length > 0
      ) {
        const routes: MessageRoute[] = [];

        for (const participant of discoveredParticipants) {
          const directKey = await deriveDirectMessageKey(
            room.id,
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

      const offers = await discoverOfferActions(
        BACKEND_URL,
        channelKey,
      ).catch(() => []);

      console.log("[VINSS DISCOVERY]", {
        groupMessages,
        directMessages,
        participants: discoveredParticipants,
        offers,
      });

      const messageEntries: TimelineEntry[] =
        messages.map((m) => ({
          id: crypto.randomUUID(),
          kind: "message",
          summary: m.message.body,
          transactionHash: m.transactionHash,
          actionLocator:
            m.actionLocator.replace(/^0x/, ""),
          sentAt: m.message.sentAt,
          senderAddress:
            m.message.senderIdentity?.address,
        }));

      const offerEntries: TimelineEntry[] = offers.map(
        (o) => ({
          id: crypto.randomUUID(),
          kind: "offer",
          summary: `${o.action.kind} — ${o.action.amount} ${o.action.asset}`,
          transactionHash: o.transactionHash,
          actionLocator:
            o.actionLocator.replace(/^0x/, ""),
          sentAt: new Date(
            o.blockNumber * 1000,
          ).toISOString(),
        }),
      );

      setEntries((prev) => {
        const incoming = [
          ...messageEntries,
          ...offerEntries,
        ];

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
        console.debug(
          "[VINSS LIVE SYNC]",
          err,
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
      tab !== "timeline" ||
      !room ||
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
    tab,
    room?.id,
    channelKey,
    session?.account.address,
    messagingIdentity?.publicKey,
  ]);

  // [VINSS CHAT AUTO SCROLL]
  useEffect(() => {
    if (
      tab !== "timeline" ||
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
  }, [entries.length, tab]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <div className="mb-8 border-b border-wire pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <Link
              href="/rooms"
              className="text-xs text-paper/40 transition hover:text-signal"
            >
              ← Rooms
            </Link>

            <h1 className="mt-2 font-display text-xl tracking-tight text-paper">
              {room?.label ?? "Deal Room"}{" "}
              <span className="text-paper/30">
                #{params.roomId.slice(0, 8)}
              </span>
            </h1>
          </div>

          <div className="shrink-0">
            <WalletConnectButton />
          </div>
        </div>
      </div>

      {!room && (
        <p className="mb-6 border border-danger/40 px-4 py-3 text-xs text-danger">
          Room ini tidak ditemukan di perangkat Anda. Buat atau gabung room
          dulu dari halaman Rooms.
        </p>
      )}

      {!session && room && (
        <p className="mb-6 border border-wire px-4 py-3 text-xs text-paper/50">
          Connect your wallet to start messaging, making offers, or funding
          escrow in this room.
        </p>
      )}

      <nav className="mb-6 flex gap-1 border-b border-wire">
        {(["timeline", "offer", "escrow", "loyalty"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-display text-xs uppercase tracking-widest ${
              tab === t
                ? "border-b-2 border-signal text-signal"
                : "text-paper/40 hover:text-paper/70"
            }`}
          >
            {
              t === "timeline"
                ? "Chat"
                : t === "offer"
                  ? "Deal"
                  : t === "escrow"
                    ? "Escrow"
                    : "Loyalty"
            }
          </button>
        ))}
      </nav>

      {error && (
        <p className="mb-4 border border-danger/40 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {showAccessDetails &&
        room &&
        (!inviteCompleted || inviteJoinedNotice) && (
          <section
            className="mb-6 border border-signal/25 bg-signal/[0.025] p-5 sm:p-6"
            data-testid="access-details"
          >
            {inviteJoinedNotice ? (
              <div className="flex min-h-[130px] flex-col items-center justify-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-signal/30 bg-signal/10 text-lg text-signal">
                  ✓
                </div>

                <p className="mt-4 font-display text-[10px] uppercase tracking-[0.22em] text-signal">
                  Counterparty joined
                </p>

                <h2 className="mt-2 text-lg text-paper">
                  Private room is ready.
                </h2>

                <p className="mt-2 text-xs text-paper/35">
                  Invitation completed successfully.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
                      {inviteLink
                        ? "Invitation ready"
                        : "Private invitation"}
                    </p>

                    <h2 className="mt-2 text-lg text-paper">
                      {inviteLink
                        ? "Private link created"
                        : "Invite your counterparty"}
                    </h2>

                    <p className="mt-2 max-w-xl text-xs leading-relaxed text-paper/40">
                      {inviteLink
                        ? "Share this private link with your counterparty. VINSS will detect when they join the room."
                        : "Create one private link. Your counterparty can open it and join this room without entering credentials manually."}
                    </p>
                  </div>

                  <Link
                    href={`/room/${room.id}`}
                    className="shrink-0 text-xs text-paper/35 transition hover:text-signal"
                  >
                    Close
                  </Link>
                </div>

                {!inviteLink ? (
                  <button
                    type="button"
                    onClick={createInviteLink}
                    className="mt-6 flex h-11 w-full items-center justify-center border border-signal bg-signal px-4 font-display text-xs uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal sm:w-auto"
                  >
                    Create invite link →
                  </button>
                ) : (
                  <div className="mt-6">
                    <div className="border border-signal/20 bg-signal/[0.035] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-[9px] uppercase tracking-[0.18em] text-signal">
                          Private invite link
                        </p>

                        <span className="font-display text-[9px] uppercase tracking-widest text-signal/70">
                          ✓ Ready
                        </span>
                      </div>

                      <p
                        className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-paper/55"
                        title={inviteLink}
                      >
                        {inviteLink.length > 58
                          ? `${inviteLink.slice(0, 38)}…${inviteLink.slice(-16)}`
                          : inviteLink}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={copyInviteLink}
                        disabled={invitePending}
                        className="flex h-10 flex-1 items-center justify-center border border-signal bg-signal px-4 font-display text-[10px] uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal"
                      >
                        {invitePending
                          ? "Finalizing..."
                          : inviteCopied
                            ? "✓ Copied"
                            : "Copy private link"}
                      </button>

                      <button
                        type="button"
                        onClick={shareInviteLink}
                        disabled={invitePending}
                        className="flex h-10 flex-1 items-center justify-center border border-wire px-4 font-display text-[10px] uppercase tracking-[0.16em] text-paper/60 transition hover:border-paper/40 hover:text-paper"
                      >
                        Share
                      </button>
                    </div>

                    <div className="mt-4 border-t border-wire/60 pt-4">
                      {!inviteExpired && (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
                          <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/45">
                            {invitePending
                              ? "Finalizing invitation..."
                              : "Waiting for counterparty..."}
                          </p>
                        </div>
                      )}

                      <p className="mt-3 text-[10px] uppercase tracking-widest text-paper/30">
                        {inviteExpired
                          ? "Invite expired"
                          : `Expires in ${inviteCountdown}`}
                      </p>

                      <button
                        type="button"
                        onClick={() => void createInviteLink()}
                        className="mt-3 text-[10px] text-paper/30 transition hover:text-signal"
                      >
                        {inviteExpired
                          ? "Generate new private link →"
                          : "Regenerate invitation"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

      <div className="mb-6">
        <AgentPanel
          roomLabel={room?.label}
          timeline={entries.map((entry) => ({
            kind: entry.kind,
            summary: entry.summary,
            sentAt: entry.sentAt,
            actionLocator: entry.actionLocator,
          }))}
          onApproveProposal={handleAgentProposal}
        />
      </div>

      {tab === "timeline" && (
        <section className="space-y-5">

          {/* CHAT HEADER */}
          <div className="flex items-center justify-between border border-wire bg-vault/30 px-4 py-3.5">
            <div>
              <div className="flex items-center gap-3">
                <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
                  Private conversation
                </p>

                <span className="flex items-center gap-1.5 font-display text-[8px] uppercase tracking-[0.14em] text-signal/65">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
                  Live
                </span>
              </div>

              <p className="mt-1.5 text-[11px] text-paper/35">
                End-to-end encrypted · auto-sync
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleRefresh(false)}
              disabled={!channelKey || busy}
              className="border border-wire px-3 py-2 font-display text-[9px] uppercase tracking-[0.14em] text-paper/35 transition hover:border-signal/50 hover:text-signal disabled:opacity-30"
              title="Force room sync"
            >
              {busy ? "Syncing…" : "Sync"}
            </button>
          </div>

          {/* CHAT AREA */}
          <div className="min-h-[420px] max-h-[58vh] overflow-y-auto border-x border-b border-wire bg-black/10">
            {entries.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
                  <span className="text-lg text-signal">✦</span>
                </div>

                <h3 className="font-display text-sm text-paper/70">
                  Start the conversation
                </h3>

                <p className="mt-2 max-w-xs text-xs leading-relaxed text-paper/35">
                  Private messages appear here automatically once they are
                  recorded and decrypted on your device.
                </p>

                <div className="mt-5 flex items-center gap-2 font-display text-[8px] uppercase tracking-[0.16em] text-paper/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal/70" />
                  Live encrypted channel
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col justify-end">
                <ul className="space-y-5 p-4 sm:p-5">
                  {[...entries]
                    .sort(
                      (a, b) =>
                        new Date(a.sentAt).getTime() -
                        new Date(b.sentAt).getTime(),
                    )
                    .map((entry) => {
                      const isOwnMessage =
                        entry.kind === "message" &&
                        Boolean(
                          entry.senderAddress &&
                            session &&
                            entry.senderAddress.toLowerCase() ===
                              session.account.address.toLowerCase(),
                        );

                      const isPeerMessage =
                        entry.kind === "message" &&
                        Boolean(
                          entry.senderAddress &&
                            session &&
                            entry.senderAddress.toLowerCase() !==
                              session.account.address.toLowerCase(),
                        );

                      const voyagerUrl =
                        NETWORK === "mainnet"
                          ? `https://voyager.online/tx/${entry.transactionHash}`
                          : `https://sepolia.voyager.online/tx/${entry.transactionHash}`;

                      return (
                        <li
                          key={`${entry.kind}:${entry.actionLocator}`}
                          className="group"
                        >
                          {entry.kind === "message" ? (
                            <div
                              className={
                                isPeerMessage
                                  ? "flex justify-start"
                                  : "flex justify-end"
                              }
                            >
                              <div className="max-w-[82%]">
                                <div
                                  className={
                                    isOwnMessage
                                      ? "mb-1 text-right font-display text-[8px] uppercase tracking-[0.14em] text-signal/55"
                                      : "mb-1 text-left font-display text-[8px] uppercase tracking-[0.14em] text-paper/30"
                                  }
                                >
                                  {isOwnMessage
                                    ? "You"
                                    : "Counterparty"}
                                </div>

                                <div
                                  className={
                                    isOwnMessage
                                      ? "rounded-lg rounded-br-sm border border-signal/30 bg-signal/[0.07] px-4 py-3 shadow-[0_0_30px_rgba(45,212,191,0.025)]"
                                      : "rounded-lg rounded-bl-sm border border-wire bg-vault/45 px-4 py-3"
                                  }
                                >
                                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-paper/85">
                                    {entry.summary}
                                  </p>
                                </div>

                                <div
                                  className={
                                    isOwnMessage
                                      ? "mt-1.5 flex justify-end"
                                      : "mt-1.5 flex justify-start"
                                  }
                                >
                                  <span className="text-[9px] text-paper/25">
                                    {new Date(
                                      entry.sentAt,
                                    ).toLocaleTimeString(
                                      "en-US",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                    {" · "}
                                    Encrypted
                                    {" · "}
                                    {!entry.transactionHash ? (
                                      <span
                                        className="inline-flex h-3 w-3 items-center justify-center"
                                        title="Recording on Starknet"
                                        aria-label="Recording on Starknet"
                                      >
                                        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-paper/15 border-t-signal/70" />
                                      </span>
                                    ) : (
                                      <span
                                        className="text-signal/55"
                                        title="Recorded on Starknet"
                                        aria-label="Recorded on Starknet"
                                      >
                                        ✓
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mx-auto max-w-[92%] rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                              <div className="mb-1 flex items-center justify-between gap-4">
                                <span className="font-display text-[9px] uppercase tracking-[0.16em] text-amber-400/70">
                                  Deal update
                                </span>

                                <span className="text-[9px] text-paper/25">
                                  {new Date(
                                    entry.sentAt,
                                  ).toLocaleTimeString(
                                    "en-US",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                              </div>

                              <p className="text-sm text-paper/70">
                                {entry.summary}
                              </p>
                            </div>
                          )}

                          <details
                            className={
                              !entry.transactionHash
                                ? "hidden"
                                : entry.kind === "message"
                                  ? isPeerMessage
                                    ? "mt-2 max-w-[82%]"
                                    : "ml-auto mt-2 max-w-[82%]"
                                  : "mx-auto mt-2 max-w-[92%]"
                            }
                          >
                            <summary
                              className={
                                entry.kind === "message" &&
                                !isPeerMessage
                                  ? "cursor-pointer list-none text-right font-display text-[8px] uppercase tracking-[0.14em] text-paper/20 transition hover:text-signal/70"
                                  : "cursor-pointer list-none text-left font-display text-[8px] uppercase tracking-[0.14em] text-paper/20 transition hover:text-signal/70"
                              }
                            >
                              Proof on-chain ↓
                            </summary>

                            <div className="mt-2 border border-wire bg-vault/60 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-display text-[8px] uppercase tracking-[0.16em] text-signal/60">
                                  Starknet proof
                                </p>

                                <span className="font-display text-[8px] uppercase tracking-[0.12em] text-signal/45">
                                  ✓ Recorded
                                </span>
                              </div>

                              <div className="mt-3 space-y-2 font-mono text-[9px] text-paper/35">
                                <div>
                                  <p className="mb-1 font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                                    Transaction
                                  </p>
                                  <p className="break-all">
                                    {entry.transactionHash}
                                  </p>
                                </div>

                                <div>
                                  <p className="mb-1 font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                                    Action locator
                                  </p>
                                  <p className="break-all">
                                    0x{entry.actionLocator}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-3 text-[9px] leading-relaxed text-paper/25">
                                The transaction proves this encrypted action
                                was recorded on Starknet. Message plaintext is
                                not exposed on-chain.
                              </p>

                              <a
                                href={voyagerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 flex h-9 items-center justify-center border border-signal/25 font-display text-[8px] uppercase tracking-[0.15em] text-signal/65 transition hover:border-signal hover:bg-signal hover:text-ink"
                              >
                                Open in Voyager ↗
                              </a>
                            </div>
                          </details>
                        </li>
                      );
                    })}

                  <div
                    ref={chatEndRef}
                    className="h-px"
                    aria-hidden="true"
                  />
                </ul>
              </div>
            )}
          </div>

          {/* MESSAGE COMPOSER */}
          <div className="border border-wire bg-vault/20 p-2">

            <div className="mb-2 flex items-center gap-2 border-b border-wire/60 px-2 pb-2">
              <span className="font-display text-[9px] uppercase tracking-widest text-paper/30">
                To
              </span>

              <select
                value={messageTarget}
                onChange={(e) => setMessageTarget(e.target.value)}
                disabled={!session || busy}
                className="min-w-0 flex-1 bg-transparent text-xs text-paper/65 outline-none"
              >
                <option value="group">
                  Group · everyone in this room
                </option>

                {participants.map((participant) => (
                  <option
                    key={participant.address}
                    value={participant.address}
                  >
                    Direct · {participant.address.slice(0, 8)}…
                    {participant.address.slice(-6)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder={
                  session
                    ? "Write an encrypted message…"
                    : "Connect your wallet to start chatting…"
                }
                disabled={!session || !channelKey || busy}
                rows={1}
                className="min-h-[46px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 disabled:opacity-40"
              />

              <button
                onClick={handleSendMessage}
                disabled={!session || !channelKey || busy || !draft.trim()}
                className="flex h-[46px] min-w-[72px] items-center justify-center border border-signal bg-signal px-4 font-display text-[10px] uppercase tracking-widest text-ink transition hover:bg-transparent hover:text-signal disabled:border-wire disabled:bg-transparent disabled:text-paper/20"
              >
                {busy ? "…" : "Send →"}
              </button>

            </div>

          </div>

          {/* ENCRYPTION NOTE */}
          <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.16em] text-paper/25">
            <span className="text-signal/60">●</span>
            End-to-end encrypted
          </div>

        </section>
      )}

      {tab === "offer" && (
        <OfferPanel
          session={session}
          channelKey={channelKey}
          onSent={(entry) => setEntries((prev) => [entry, ...prev])}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
          agentDraft={agentOfferDraft}
        />
      )}

      {tab === "escrow" && (
        <EscrowPanel
          session={session}
          channelKey={channelKey}
          onSent={(entry) => setEntries((prev) => [entry, ...prev])}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
          agentDraft={agentEscrowDraft}
        />
      )}

      {tab === "loyalty" && (
        <section className="space-y-6">
          <div className="border border-wire bg-vault/30 p-6">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
              VINSS Loyalty
            </p>

            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-widest text-paper/35">
                Your rewards
              </p>

              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-4xl text-paper">
                  0
                </span>
                <span className="font-display text-xs uppercase tracking-widest text-paper/35">
                  points
                </span>
              </div>
            </div>
          </div>

          <div className="border border-wire">
            <div className="border-b border-wire px-4 py-3">
              <p className="font-display text-[10px] uppercase tracking-widest text-paper/40">
                Earn points
              </p>
            </div>

            <div className="divide-y divide-wire">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-paper/70">Send message</span>
                <span className="font-display text-xs text-signal">+1</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-paper/70">Create offer</span>
                <span className="font-display text-xs text-signal">+25</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-paper/70">Offer accepted</span>
                <span className="font-display text-xs text-signal">+50</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-paper/70">Start escrow</span>
                <span className="font-display text-xs text-signal">+50</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-paper/70">Fund escrow</span>
                <span className="font-display text-xs text-signal">+100</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-paper/70">Complete deal</span>
                <span className="font-display text-xs text-signal">+250</span>
              </div>
            </div>
          </div>

          <div className="border border-wire bg-vault/20 p-4">
            <p className="font-display text-[10px] uppercase tracking-widest text-paper/40">
              Reward path
            </p>

            <div className="mt-4 flex items-center justify-center gap-3 text-xs">
              <span className="border border-wire px-3 py-2 text-paper/60">
                POINTS
              </span>
              <span className="text-signal">→</span>
              <span className="border border-wire px-3 py-2 text-paper/60">
                VINSS
              </span>
              <span className="text-signal">→</span>
              <span className="border border-signal/40 px-3 py-2 text-signal">
                DXJ
              </span>
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-paper/30">
              Earn points through activity in this Deal Room.
              Rewards can later be redeemed through the VINSS and DXJ ecosystem.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

function OfferPanel({
  session,
  channelKey,
  onSent,
  busy,
  setBusy,
  setError,
  agentDraft,
}: {
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  onSent: (entry: TimelineEntry) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  agentDraft?: Extract<
    AgentProposal,
    { type: "draft_offer" | "draft_counter_offer" }
  > | null;
}) {
  const [dealType, setDealType] = useState<DealType>("otc");
  const [asset, setAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    if (!agentDraft) return;

    setAsset(agentDraft.payload.asset);
    setAmount(agentDraft.payload.amount);
    setTerms(agentDraft.payload.paymentTerms);
  }, [agentDraft]);

  async function handleCreateOffer() {
    if (!session || !channelKey || !asset.trim() || !amount.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const payload: Omit<OfferActionPayload, "kind"> = {
        dealType,
        asset: asset.trim(),
        amount: amount.trim(),
        paymentTerms: terms.trim() || "Tidak ditentukan",
      };

      const result = await createOffer(session.account, channelKey, payload);

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: `Create offer — ${amount} ${asset}`,
        transactionHash: result.transactionHash,
        actionLocator: result.actionLocator.toString(16),
        sentAt: new Date().toISOString(),
      });

      setAsset("");
      setAmount("");
      setTerms("");
    } catch (err) {
      setError(humanizeError(err, "We couldn't create the offer. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const canCreate =
    Boolean(session) &&
    Boolean(channelKey) &&
    !busy &&
    Boolean(asset.trim()) &&
    Boolean(amount.trim());

  return (
    <section className="border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs uppercase tracking-widest text-signal">
              Offer
            </p>
            <h3 className="mt-1 text-sm text-paper">
              Create a proposal for this deal
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              Set the asset, amount and payment terms. You will review the
              offer before it is created.
            </p>
          </div>

          <span className="shrink-0 text-[10px] uppercase tracking-wider text-paper/30">
            Step 1 · Create
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Deal type — encrypted inside the Offer payload */}
        <div>
          <label
            htmlFor="offer-deal-type"
            className="mb-2 block font-display text-[10px] uppercase tracking-widest text-paper/40"
          >
            Deal type
          </label>

          <select
            id="offer-deal-type"
            value={dealType}
            onChange={(e) => setDealType(e.target.value as DealType)}
            disabled={!session || !channelKey || busy}
            className="w-full border border-wire bg-vault px-3 py-3 text-sm text-paper outline-none focus:border-signal disabled:opacity-40"
          >
            <option value="otc">OTC / Token trade</option>
            <option value="freelance">Freelance / Service</option>
            <option value="goods">Physical goods</option>
            <option value="digital_goods">Digital goods / License</option>
            <option value="bounty">Bounty / Task</option>
            <option value="nft">NFT deal</option>
            <option value="other">Other</option>
          </select>

          <p className="mt-1.5 text-[10px] leading-relaxed text-paper/25">
            Deal type is encrypted with the offer and is not exposed publicly on-chain.
          </p>
        </div>

        {/* Asset */}
        <div>
          <label
            htmlFor="offer-asset"
            className="mb-2 block font-display text-[10px] uppercase tracking-widest text-paper/40"
          >
            Asset
          </label>

          <input
            id="offer-asset"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            placeholder="e.g. STRK, USDC"
            disabled={!session || !channelKey || busy}
            autoComplete="off"
            className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        {/* Amount */}
        <div>
          <label
            htmlFor="offer-amount"
            className="mb-2 block font-display text-[10px] uppercase tracking-widest text-paper/40"
          >
            Amount
          </label>

          <div className="flex border border-wire focus-within:border-signal">
            <input
              id="offer-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              disabled={!session || !channelKey || busy}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-lg text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
            />

            {asset.trim() && (
              <span className="flex items-center px-3 font-display text-xs uppercase tracking-widest text-paper/35">
                {asset.trim()}
              </span>
            )}
          </div>
        </div>

        {/* Payment terms */}
        <div>
          <label
            htmlFor="offer-terms"
            className="mb-2 flex items-center justify-between"
          >
            <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
              Payment terms
            </span>

            <span className="text-[10px] text-paper/25">Optional</span>
          </label>

          <input
            id="offer-terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="e.g. Net 7 days"
            disabled={!session || !channelKey || busy}
            className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        {/* Financial summary */}
        <div className="border-t border-wire pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
              Deal summary
            </span>

            <span className="text-[10px] text-paper/25">
              Estimated
            </span>
          </div>

          <div className="border border-wire bg-vault/50 px-3 py-3 text-xs">
            <div className="flex justify-between text-paper/50">
              <span>Deal value</span>
              <span>
                {amount || "0"} {asset || ""}
              </span>
            </div>

            <div className="mt-1 flex justify-between text-paper/50">
              <span>Private offer action fee</span>
              <span>1 STRK</span>
            </div>
          </div>
        </div>

        {/* Review boundary */}
        <div className="border border-wire bg-paper/[0.015] p-3">
          <div className="flex gap-2">
            <span className="mt-0.5 text-signal">◆</span>

            <p className="text-[10px] leading-relaxed text-paper/40">
              Review the deal terms before creating the offer. Creating an offer
              charges a flat 1 STRK private action fee and does not fund
              Escrow Rekber.
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateOffer}
          disabled={!canCreate}
          className="flex w-full items-center justify-center gap-2 border border-signal px-4 py-3 font-display text-xs uppercase tracking-widest text-signal transition-colors hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? "Creating offer…" : "Review Offer →"}
        </button>
      </div>
    </section>
  );
}

function EscrowPanel({
  session,
  channelKey,
  onSent,
  busy,
  setBusy,
  setError,
  agentDraft,
}: {
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  onSent: (entry: TimelineEntry) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  agentDraft?: Extract<
    AgentProposal,
    { type: "prepare_escrow" }
  > | null;
}) {
  const [dealOfferLocator, setDealOfferLocator] = useState("");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [refundHours, setRefundHours] = useState("24");

  useEffect(() => {
    if (!agentDraft) return;

    if (agentDraft.payload.dealOfferLocator) {
      setDealOfferLocator(
        agentDraft.payload.dealOfferLocator,
      );
    }

    if (agentDraft.payload.refundHours) {
      setRefundHours(agentDraft.payload.refundHours);
    }
  }, [agentDraft]);
  const [agreedCustodyCommitment, setAgreedCustodyCommitment] = useState<bigint | null>(null);
  const [lastSecrets, setLastSecrets] = useState<{
    custodyCommitment: bigint;
    releaseSecret: bigint;
    refundSecret: bigint;
  } | null>(null);

  async function handleCreateCoordination() {
    if (!session || !channelKey || !dealOfferLocator.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const custodyCommitment = generateCustodyCommitment();

      const result = await sendEscrowCoordinationAction(session.account, channelKey, {
        kind: "create",
        dealOfferLocator: dealOfferLocator.trim(),
        custodyCommitment: custodyCommitment.toString(),
      });

      setAgreedCustodyCommitment(custodyCommitment);

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: `Escrow ready — custody 0x${custodyCommitment.toString(16).slice(0, 10)}…`,
        transactionHash: result.transactionHash,
        actionLocator: result.actionLocator.toString(16),
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(humanizeError(err, "We couldn't start the escrow process. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeposit() {
    if (!session || !agreedCustodyCommitment || !token.trim() || !amount.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const secrets = generateEscrowSecrets();
      const custodyCommitment = agreedCustodyCommitment;
      const releaseCommitment = computeReleaseCommitment(
        custodyCommitment,
        secrets.releaseSecret
      );
      const refundCommitment = computeRefundCommitment(
        custodyCommitment,
        secrets.refundSecret
      );
      const refundAfter =
        Math.floor(Date.now() / 1000) + Number(refundHours || "24") * 3600;

      const result = await depositEscrow(session.account, {
        custodyCommitment,
        releaseCommitment,
        refundCommitment,
        refundAfter,
        token: token.trim(),
        amount: BigInt(amount.trim()),
      });

      setLastSecrets({ custodyCommitment, ...secrets });

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: `Escrow deposit — ${amount} token ${token.slice(0, 10)}…`,
        transactionHash: result.transactionHash,
        actionLocator: custodyCommitment.toString(16),
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(humanizeError(err, "We couldn't fund the escrow. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const canCoordinate =
    Boolean(session) &&
    Boolean(channelKey) &&
    !busy &&
    Boolean(dealOfferLocator.trim());

  const canDeposit =
    Boolean(session) &&
    !busy &&
    Boolean(agreedCustodyCommitment) &&
    Boolean(token.trim()) &&
    Boolean(amount.trim());

  return (
    <section className="border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <p className="font-display text-xs uppercase tracking-widest text-signal">
          VINSS Escrow Rekber
        </p>

        <h3 className="mt-1 text-sm text-paper">
          Secure the accepted deal
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-paper/35">
          Connect the accepted offer first, then lock the agreed payment in Rekber.
        </p>
      </div>

      <div className="p-4">
        {/* Progress */}
        <div className="mb-6 grid grid-cols-2 border border-wire">
          <div className="border-r border-wire bg-paper/[0.025] p-3">
            <div className="font-display text-[9px] tracking-widest text-paper/25">
              01
            </div>

            <div className="mt-1 text-[10px] uppercase tracking-wider text-signal">
              Connect offer
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-paper/30">
              Link the accepted offer to escrow.
            </p>
          </div>

          <div className={`p-3 ${agreedCustodyCommitment ? "bg-paper/[0.025]" : ""}`}>
            <div className="font-display text-[9px] tracking-widest text-paper/25">
              02
            </div>

            <div
              className={`mt-1 text-[10px] uppercase tracking-wider ${
                agreedCustodyCommitment ? "text-signal" : "text-paper/35"
              }`}
            >
              Fund escrow
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-paper/30">
              Deposit the agreed amount on-chain.
            </p>
          </div>
        </div>

        {/* Step 1 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-[10px] uppercase tracking-widest text-paper/45">
                Step 1
              </p>

              <h4 className="mt-1 text-sm text-paper">
                Connect the accepted offer
              </h4>
            </div>

            <span
              className={`text-[10px] uppercase tracking-wider ${
                agreedCustodyCommitment ? "text-signal" : "text-paper/30"
              }`}
            >
              {agreedCustodyCommitment ? "Ready" : "Waiting"}
            </span>
          </div>

          <div className="border border-wire p-3">
            <label
              htmlFor="escrow-offer-locator"
              className="mb-2 block text-xs text-paper/55"
            >
              Offer reference
            </label>

            <div className="flex gap-2">
              <input
                id="escrow-offer-locator"
                value={dealOfferLocator}
                onChange={(e) => setDealOfferLocator(e.target.value)}
                placeholder="Paste the offer reference"
                disabled={
                  !session ||
                  !channelKey ||
                  busy ||
                  Boolean(agreedCustodyCommitment)
                }
                className="min-w-0 flex-1 border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
              />

              <button
                onClick={handleCreateCoordination}
                disabled={!canCoordinate || Boolean(agreedCustodyCommitment)}
                className="border border-signal px-4 py-2 font-display text-[10px] uppercase tracking-widest text-signal transition-colors hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? "Connecting…" : "Connect"}
              </button>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-paper/25">
              Use the reference from the offer you accepted. VINSS uses it to
              establish the shared escrow coordination.
            </p>
          </div>
        </div>

        {/* Coordination status */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-wire" />

          <div
            className={`flex items-center gap-2 text-[10px] uppercase tracking-wider ${
              agreedCustodyCommitment ? "text-signal" : "text-paper/25"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                agreedCustodyCommitment ? "bg-signal" : "bg-paper/20"
              }`}
            />

            {agreedCustodyCommitment
              ? "Custody coordinated"
              : "Awaiting coordination"}
          </div>

          <div className="h-px flex-1 bg-wire" />
        </div>

        {/* Step 2 */}
        <div className={agreedCustodyCommitment ? "" : "opacity-45"}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-[10px] uppercase tracking-widest text-paper/45">
                Step 2
              </p>

              <h4 className="mt-1 text-sm text-paper">
                Fund the escrow
              </h4>
            </div>

            <span className="text-[10px] uppercase tracking-wider text-paper/30">
              ERC-20
            </span>
          </div>

          <div className="space-y-4 border border-wire p-3">
            {/* Token */}
            <div>
              <label
                htmlFor="escrow-token"
                className="mb-2 block text-xs text-paper/55"
              >
                Token contract
              </label>

              <input
                id="escrow-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="0x…"
                disabled={!session || busy || !agreedCustodyCommitment}
                className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
              />

              <p className="mt-1.5 text-[10px] text-paper/25">
                The current Rekber contract locks ERC-20 payment assets. The deal itself
                may represent OTC, freelance work, goods, NFT purchases, bounty,
                or another privately negotiated transaction.
              </p>
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="escrow-amount"
                className="mb-2 block text-xs text-paper/55"
              >
                Deposit amount
              </label>

              <input
                id="escrow-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                disabled={!session || busy || !agreedCustodyCommitment}
                className="w-full border border-wire bg-transparent px-3 py-3 text-lg text-paper outline-none placeholder:text-paper/20 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
              />

              <p className="mt-1.5 text-[10px] leading-relaxed text-paper/25">
                Enter the token amount using the token's required unit.
              </p>
            </div>

            {/* Refund window */}
            <div>
              <label
                htmlFor="escrow-refund"
                className="mb-2 flex items-center justify-between"
              >
                <span className="text-xs text-paper/55">
                  Refund window
                </span>

                <span className="text-[10px] text-paper/25">
                  Default: 24 hours
                </span>
              </label>

              <div className="flex items-center border border-wire">
                <input
                  id="escrow-refund"
                  value={refundHours}
                  onChange={(e) => setRefundHours(e.target.value)}
                  inputMode="numeric"
                  disabled={!session || busy || !agreedCustodyCommitment}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-paper outline-none focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
                />

                <span className="px-3 text-xs text-paper/30">
                  hours
                </span>
              </div>

              <p className="mt-1.5 text-[10px] leading-relaxed text-paper/25">
                Determines when the refund path becomes available.
              </p>
            </div>

            {/* Summary */}
            <div className="border-t border-wire pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
                  Deposit summary
                </span>

                <span className="text-[10px] text-paper/25">
                  Estimated
                </span>
              </div>

              <FeeBreakdown
                amount={amount}
                label="VINSS escrow service fee"
                feeBps={100}
              />
            </div>

            {/* Public notice */}
            <div className="border border-amber/30 bg-amber/[0.025] p-3">
              <div className="flex gap-2">
                <span className="text-amber">!</span>

                <div>
                  <p className="text-xs text-paper/65">
                    Public on-chain deposit
                  </p>

                  <p className="mt-1 text-[10px] leading-relaxed text-paper/35">
                    The token and amount of this deposit are publicly visible
                    on-chain. Your private deal messages and negotiation
                    context remain separate from the ERC-20 deposit.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={!canDeposit}
              className="w-full border border-amber px-4 py-3 font-display text-xs uppercase tracking-widest text-amber transition-colors hover:bg-amber hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy ? "Funding escrow…" : "Review Deposit →"}
            </button>
          </div>
        </div>

        {/* Advanced details */}
        <details className="border-t border-wire pt-4">
          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-paper/25 hover:text-paper/45">
            Advanced escrow details
          </summary>

          <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-paper/30">
            <p>
              <span className="text-paper/45">Offer locator:</span>{" "}
              {dealOfferLocator || "—"}
            </p>

            <p>
              <span className="text-paper/45">Custody commitment:</span>{" "}
              {agreedCustodyCommitment
                ? `0x${agreedCustodyCommitment.toString(16)}`
                : "Not established"}
            </p>

            <p>
              <span className="text-paper/45">Token:</span>{" "}
              {token || "—"}
            </p>
          </div>
        </details>

        {/* Secrets */}
        {lastSecrets && (
          <div className="border border-danger/40 bg-danger/[0.025] p-4">
            <p className="mb-2 font-display text-[10px] uppercase tracking-widest text-danger">
              Save your escrow secrets
            </p>

            <p className="mb-3 text-[10px] leading-relaxed text-paper/45">
              These secrets are required to release or refund the escrow.
              Store them securely. They cannot be recovered if lost.
            </p>

            <div className="space-y-1.5 font-mono text-[10px] text-paper/50">
              <p className="break-all">
                custody: 0x{lastSecrets.custodyCommitment.toString(16)}
              </p>

              <p className="break-all">
                releaseSecret: 0x{lastSecrets.releaseSecret.toString(16)}
              </p>

              <p className="break-all">
                refundSecret: 0x{lastSecrets.refundSecret.toString(16)}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

