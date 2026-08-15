"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
import type { MessagePayload, OfferActionPayload } from "@/lib/vinss-sdk/types";
import { BACKEND_URL } from "@/lib/starknet/constants";
import { AgentPanel } from "@/components/AgentPanel";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { createInviteToken } from "@/lib/vinss-sdk/invite";

type Tab = "timeline" | "offer" | "escrow" | "loyalty";

interface TimelineEntry {
  id: string;
  kind: "message" | "offer";
  summary: string;
  transactionHash: string;
  actionLocator: string;
  sentAt: string;
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
    raw.includes("channelHelper")
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<LocalRoom | null>(null);
  const [channelKey, setChannelKey] = useState<Uint8Array | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);


  useEffect(() => {
    const r = loadRoom(params.roomId);
    setRoom(r);
    if (r) {
      deriveChannelKeyFromRoomSecret(r.roomSecret).then(setChannelKey);
    }
  }, [params.roomId]);

  function createInviteLink() {
    if (!room) return;

    const token = createInviteToken({
      v: 1,
      roomId: room.id,
      roomSecret: room.roomSecret,
      label: room.label,
    });

    const link = `${window.location.origin}/invite/${token}`;
    setInviteLink(link);
    setInviteCopied(false);
  }

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

  async function handleSendMessage() {
    if (!session || !channelKey || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload: MessagePayload = {
        kind: "text",
        body: draft.trim(),
        sentAt: new Date().toISOString(),
      };
      const result = await sendMessage(session.account, channelKey, payload);
      setEntries((prev) => [
        {
          id: crypto.randomUUID(),
          kind: "message",
          summary: draft.trim(),
          transactionHash: result.transactionHash,
          actionLocator: result.actionLocator.toString(16),
          sentAt: payload.sentAt,
        },
        ...prev,
      ]);
      setDraft("");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error("[VINSS SEND ERROR]", err);
      setError(raw || "Unknown send error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    if (!channelKey) return;
    setBusy(true);
    setError(null);
    try {
      const [messages, offers] = await Promise.all([
        discoverMessages(BACKEND_URL, channelKey).catch(() => []),
        discoverOfferActions(BACKEND_URL, channelKey).catch(() => []),
      ]);

      const messageEntries: TimelineEntry[] = messages.map((m) => ({
        id: crypto.randomUUID(),
        kind: "message",
        summary: m.message.body,
        transactionHash: m.transactionHash,
        actionLocator: m.actionLocator.replace(/^0x/, ""),
        sentAt: m.message.sentAt,
      }));
      const offerEntries: TimelineEntry[] = offers.map((o) => ({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: `${o.action.kind} — ${o.action.amount} ${o.action.asset}`,
        transactionHash: o.transactionHash,
        actionLocator: o.actionLocator.replace(/^0x/, ""),
        sentAt: new Date(o.blockNumber * 1000).toISOString(),
      }));

      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.actionLocator));
        const fresh = [...messageEntries, ...offerEntries].filter(
          (e) => !seen.has(e.actionLocator),
        );
        return [...fresh, ...prev].sort(
          (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
        );
      });
    } catch (err) {
      setError(
        humanizeError(
          err,
          "We couldn't refresh the room. Please try again in a moment.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

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

      {showAccessDetails && room && (
        <section
          className="mb-6 border border-signal/25 bg-signal/[0.025] p-5 sm:p-6"
          data-testid="access-details"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
                Private invitation
              </p>

              <h2 className="mt-2 text-lg text-paper">
                Invite your counterparty
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-relaxed text-paper/40">
                Create one private link. Your counterparty can open it and
                join this room without entering credentials manually.
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
              <div className="border border-wire bg-ink/40 p-3">
                <p className="mb-2 text-[9px] uppercase tracking-widest text-paper/25">
                  Private invite link
                </p>

                <p className="break-all font-mono text-[11px] leading-relaxed text-paper/60">
                  {inviteLink}
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="flex h-10 flex-1 items-center justify-center border border-signal bg-signal px-4 font-display text-[10px] uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal"
                >
                  {inviteCopied ? "Copied ✓" : "Copy invite link"}
                </button>

                <button
                  type="button"
                  onClick={shareInviteLink}
                  className="flex h-10 flex-1 items-center justify-center border border-wire px-4 font-display text-[10px] uppercase tracking-[0.16em] text-paper/60 transition hover:border-paper/40 hover:text-paper"
                >
                  Share
                </button>
              </div>

              <p className="mt-4 border-t border-wire/60 pt-3 text-[10px] leading-relaxed text-paper/25">
                Anyone with this link can join this private room. Share it
                only with your intended counterparty.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="mb-6">
        <AgentPanel
          roomLabel={room?.label}
          timeline={entries.map((entry) => ({ kind: entry.kind, summary: entry.summary, sentAt: entry.sentAt }))}
        />
      </div>

      {tab === "timeline" && (
        <section className="space-y-5">

          {/* CHAT HEADER */}
          <div className="flex items-center justify-between border border-wire bg-vault/30 px-4 py-3">
            <div>
              <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
                Private conversation
              </p>
              <p className="mt-1 text-xs text-paper/40">
                End-to-end encrypted
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={!channelKey || busy}
              className="border border-wire px-3 py-2 font-display text-[10px] uppercase tracking-widest text-paper/50 transition hover:border-signal/50 hover:text-signal disabled:opacity-30"
              title="Load the latest encrypted messages"
            >
              {busy ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* CHAT AREA */}
          <div className="min-h-[360px] border border-wire bg-black/10">

            {entries.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">

                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-signal/20 bg-signal/5">
                  <span className="text-lg text-signal">✦</span>
                </div>

                <h3 className="font-display text-sm text-paper/70">
                  Start the conversation
                </h3>

                <p className="mt-2 max-w-sm text-xs leading-relaxed text-paper/35">
                  Messages in this room are encrypted before they leave your
                  device.
                </p>

              </div>
            ) : (
              <ul className="space-y-4 p-4">

                {entries.map((entry) => (
                  <li key={entry.id} className="group">

                    {entry.kind === "message" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[86%]">

                          <div className="border border-signal/20 bg-signal/5 px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper/85">
                              {entry.summary}
                            </p>
                          </div>

                          <div className="mt-1 flex justify-end">
                            <span className="text-[9px] text-paper/25">
                              {new Date(entry.sentAt).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                              {" · "}
                              Encrypted
                            </span>
                          </div>

                        </div>
                      </div>
                    ) : (
                      <div className="mx-auto max-w-[92%] border border-amber-500/20 bg-amber-500/5 px-4 py-3">

                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-display text-[9px] uppercase tracking-[0.16em] text-amber-400/70">
                            Deal update
                          </span>

                          <span className="text-[9px] text-paper/25">
                            {new Date(entry.sentAt).toLocaleTimeString(
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

                    {/* Technical details stay available, but hidden from
                        the normal conversation view. */}
                    <details className="mt-1 opacity-0 transition group-hover:opacity-100">
                      <summary className="cursor-pointer text-right text-[8px] uppercase tracking-widest text-paper/20">
                        Technical details
                      </summary>

                      <div className="mt-1 text-right text-[8px] text-paper/20">
                        tx {entry.transactionHash} · locator 0x{entry.actionLocator}
                      </div>
                    </details>

                  </li>
                ))}

              </ul>
            )}

          </div>

          {/* MESSAGE COMPOSER */}
          <div className="border border-wire bg-vault/20 p-2">

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
                {busy ? "…" : "Send"}
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
}: {
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  onSent: (entry: TimelineEntry) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const [asset, setAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");

  async function handleCreateOffer() {
    if (!session || !channelKey || !asset.trim() || !amount.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const payload: Omit<OfferActionPayload, "kind"> = {
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

          <FeeBreakdown amount={amount} />
        </div>

        {/* Review boundary */}
        <div className="border border-wire bg-paper/[0.015] p-3">
          <div className="flex gap-2">
            <span className="mt-0.5 text-signal">◆</span>

            <p className="text-[10px] leading-relaxed text-paper/40">
              Review the deal value and service fee before creating the offer.
              Creating an offer does not automatically fund escrow.
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
}: {
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  onSent: (entry: TimelineEntry) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const [dealOfferLocator, setDealOfferLocator] = useState("");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [refundHours, setRefundHours] = useState("24");
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
          Escrow
        </p>

        <h3 className="mt-1 text-sm text-paper">
          Fund this deal securely
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-paper/35">
          Connect the accepted offer first, then deposit the agreed funds.
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
                The token address is used for the on-chain ERC-20 deposit.
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

