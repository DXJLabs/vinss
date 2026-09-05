"use client";

import { useEffect, useMemo, useState } from "react";
import { hash } from "starknet";

import {
  BACKEND_URL,
  CONTRACTS,
  NETWORK,
  RPC_URL,
} from "@/lib/starknet/constants";

type ActivityKind =
  | "message"
  | "offer"
  | "escrow"
  | "invite_created"
  | "invite_consumed"
  | "rekber_funded"
  | "rekber_fulfillment_submitted"
  | "rekber_fulfillment_confirmed"
  | "rekber_revision_requested"
  | "rekber_dispute_opened"
  | "rekber_resolution_authorized"
  | "rekber_resolution_claimed"
  | "rekber_released"
  | "rekber_refunded"
  | "rekber_resolved"
  | "certificate_issued";

interface ActivityItem {
  network: "sepolia" | "mainnet";
  kind: ActivityKind;
  contractAddress: string;
  actionLocator: string;
  blockNumber: number;
  transactionHash: string;
  indexedAt: string;
  rekber?: { amount?: string; token?: string };
  certificate?: {
    tokenId: string;
    recipient: string;
    custodyCommitment: string;
    role: 1 | 2;
    settledAt: number;
    issuedAt: number;
  };
}

interface ActivityResponse { items?: unknown; }
interface PublicTxMeta { senderAddress: string | null; }

export interface ActivitySnapshot {
  count: number;
  online: boolean;
  lastUpdated: string | null;
}

interface LiveTxFeedProps {
  onSnapshot?: (snapshot: ActivitySnapshot) => void;
}

const COMPACT_COUNT = 5;

const ACTIVITY_LABELS: Record<ActivityKind, { label: string; accent: string; target: string }> = {
  message: { label: "MESSAGE", accent: "text-paper/78", target: "VINSS MESSAGE" },
  offer: { label: "OFFER · ACTION", accent: "text-paper/78", target: "VINSS OFFER" },
  // Generic encrypted Rekber coordination is not equivalent to opening custody.
  // Public lifecycle events below are the authoritative labels for fund,
  // dispute, resolution, claim, release, and refund state changes.
  escrow: { label: "REKBER · COORDINATION", accent: "text-paper/52", target: "VINSS REKBER" },
  invite_created: { label: "INVITE · CREATE", accent: "text-paper/78", target: "VINSS INVITE" },
  invite_consumed: { label: "INVITE · JOIN", accent: "text-signal/82", target: "VINSS INVITE" },
  rekber_funded: { label: "REKBER · FUND", accent: "text-signal/82", target: "VINSS REKBER" },
  rekber_fulfillment_submitted: { label: "REKBER · SUBMIT WORK", accent: "text-signal/82", target: "VINSS REKBER" },
  rekber_fulfillment_confirmed: { label: "REKBER · CONFIRM", accent: "text-signal/82", target: "VINSS REKBER" },
  rekber_revision_requested: { label: "REKBER · REVISION", accent: "text-amber/82", target: "VINSS REKBER" },
  rekber_dispute_opened: { label: "REKBER · DISPUTE", accent: "text-amber/82", target: "VINSS REKBER" },
  rekber_resolution_authorized: { label: "REKBER · RESOLUTION", accent: "text-amber/82", target: "VINSS REKBER" },
  rekber_resolution_claimed: { label: "REKBER · CLAIM", accent: "text-signal/82", target: "VINSS REKBER" },
  rekber_released: { label: "REKBER · RELEASE", accent: "text-signal/82", target: "VINSS REKBER" },
  rekber_refunded: { label: "REKBER · REFUND", accent: "text-amber/82", target: "VINSS REKBER" },
  rekber_resolved: { label: "REKBER · RESOLVED", accent: "text-signal/82", target: "VINSS REKBER" },
  certificate_issued: { label: "CERTIFICATE", accent: "text-amber/82", target: "VINSS CERTIFICATE" },
};

function isActivityItem(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ActivityItem>;
  return (
    (item.network === "sepolia" || item.network === "mainnet") &&
    typeof item.kind === "string" &&
    item.kind in ACTIVITY_LABELS &&
    typeof item.contractAddress === "string" &&
    typeof item.actionLocator === "string" &&
    typeof item.blockNumber === "number" &&
    typeof item.transactionHash === "string" &&
    typeof item.indexedAt === "string"
  );
}

function shortHash(value: string) {
  if (value.length <= 15) return value;
  return `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function shortAddress(value: string) {
  if (value.length <= 17) return value;
  return `${value.slice(0, 8)}…${value.slice(-5)}`;
}

function formatRelativeTime(value: string, now: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || now <= 0) return "NOW";
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function explorerUrl(transactionHash: string) {
  return NETWORK === "mainnet"
    ? `https://voyager.online/tx/${transactionHash}`
    : `https://sepolia.voyager.online/tx/${transactionHash}`;
}

const INVITE_ACTIVITY_BLOCK_WINDOW = 5_000;
const inviteCreatedSelector =
  hash.getSelectorFromName("InviteCreated");
const inviteConsumedSelector =
  hash.getSelectorFromName("InviteConsumed");

const inviteBlockTimeCache =
  new Map<number, string>();

async function rpcCall<T>(
  method: string,
  params: unknown[],
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${method}:${Date.now()}`,
      method,
      params,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `RPC ${method} failed: ${response.status}`,
    );
  }

  const payload =
    (await response.json()) as {
      result?: T;
      error?: unknown;
    };

  if (
    payload.error ||
    payload.result === undefined
  ) {
    throw new Error(
      `RPC ${method} returned an error`,
    );
  }

  return payload.result;
}

async function inviteBlockTime(
  blockNumber: number,
  signal: AbortSignal,
): Promise<string> {
  const cached =
    inviteBlockTimeCache.get(blockNumber);

  if (cached) {
    return cached;
  }

  const block =
    await rpcCall<{
      timestamp?: number;
    }>(
      "starknet_getBlockWithTxHashes",
      [
        {
          block_number: blockNumber,
        },
      ],
      signal,
    );

  const timestamp =
    Number(block.timestamp ?? 0);

  const value =
    timestamp > 0
      ? new Date(timestamp * 1_000).toISOString()
      : new Date().toISOString();

  inviteBlockTimeCache.set(
    blockNumber,
    value,
  );

  return value;
}

async function loadInviteActivity(
  signal: AbortSignal,
): Promise<ActivityItem[]> {
  if (!CONTRACTS.invite) {
    return [];
  }

  const latest =
    await rpcCall<number>(
      "starknet_blockNumber",
      [],
      signal,
    );

  const fromBlock =
    Math.max(
      0,
      latest -
        INVITE_ACTIVITY_BLOCK_WINDOW,
    );

  const page =
    await rpcCall<{
      events?: Array<{
        keys?: string[];
        block_number?: number;
        transaction_hash?: string;
      }>;
    }>(
      "starknet_getEvents",
      [
        {
          from_block: {
            block_number: fromBlock,
          },
          to_block: {
            block_number: latest,
          },
          address: CONTRACTS.invite,
          keys: [
            [
              inviteCreatedSelector,
              inviteConsumedSelector,
            ],
          ],
          chunk_size: 50,
        },
      ],
      signal,
    );

  const events =
    page.events ?? [];

  return Promise.all(
    events.map(async (event) => {
      const selector =
        event.keys?.[0];

      const kind: ActivityKind =
        selector &&
        BigInt(selector) ===
          BigInt(
            inviteConsumedSelector,
          )
          ? "invite_consumed"
          : "invite_created";

      const blockNumber =
        event.block_number ?? latest;

      const transactionHash =
        event.transaction_hash ?? "0x0";

      return {
        network: NETWORK,
        kind,
        contractAddress:
          CONTRACTS.invite,
        actionLocator:
          event.keys?.[1] ??
          transactionHash,
        blockNumber,
        transactionHash,
        indexedAt:
          await inviteBlockTime(
            blockNumber,
            signal,
          ),
      } satisfies ActivityItem;
    }),
  );
}

function TransactionIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 7h9.5M14 4.5 16.5 7 14 9.5M17 17H7.5M10 14.5 7.5 17 10 19.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function LiveTxFeed({ onSnapshot }: LiveTxFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "offline">("loading");
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(0);
  const [txMeta, setTxMeta] = useState<Record<string, PublicTxMeta>>({});

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let knownCount = 0;

    async function loadActivity() {
      try {
        const [response, inviteItems] =
          await Promise.all([
            fetch(
              `${BACKEND_URL.replace(/\/$/, "")}/activity?limit=50`,
              {
                cache: "no-store",
                signal:
                  controller.signal,
              },
            ),
            loadInviteActivity(
              controller.signal,
            ).catch(() => []),
          ]);

        if (!response.ok) {
          throw new Error(
            `Activity request failed: ${response.status}`,
          );
        }

        const payload =
          (await response.json()) as ActivityResponse;

        const backendItems =
          Array.isArray(payload.items)
            ? payload.items.filter(
                isActivityItem,
              )
            : [];

        const seen =
          new Set<string>();

        const nextItems = [
          ...backendItems,
          ...inviteItems,
        ]
          .sort((left, right) => {
            if (
              left.blockNumber !==
              right.blockNumber
            ) {
              return (
                right.blockNumber -
                left.blockNumber
              );
            }

            return left.transactionHash <
              right.transactionHash
              ? 1
              : -1;
          })
          .filter((item) => {
            const key =
              `${item.transactionHash}:${item.actionLocator}:${item.kind}`;

            if (seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          })
          .slice(0, 50);
        if (disposed) return;
        knownCount = nextItems.length;
        setItems(nextItems);
        setStatus("live");
        onSnapshot?.({ count: nextItems.length, online: true, lastUpdated: new Date().toISOString() });
      } catch {
        if (disposed || controller.signal.aborted) return;
        setStatus("offline");
        onSnapshot?.({ count: knownCount, online: false, lastUpdated: null });
      }
    }

    void loadActivity();
    const timer = window.setInterval(loadActivity, 20_000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [onSnapshot]);

  /*
   * Compact LOG TX should surface authoritative public lifecycle events instead
   * of letting encrypted Rekber coordination packets dominate the five visible
   * rows. Coordination remains available in the expanded audit view.
   *
   * This keeps DISPUTE / RESOLUTION / CLAIM visible when those on-chain events
   * exist, while retaining the complete chronological stream under Expand log.
   */
  const compactItems = useMemo(() => {
    const semanticItems =
      items.filter(
        (item) =>
          item.kind !== "escrow",
      );

    return (
      semanticItems.length > 0
        ? semanticItems
        : items
    ).slice(0, COMPACT_COUNT);
  }, [items]);

  const visibleItems = useMemo(
    () =>
      expanded
        ? items
        : compactItems,
    [expanded, items, compactItems],
  );

  useEffect(() => {
    let disposed = false;
    const missing = visibleItems.filter((item) => !txMeta[item.transactionHash]);
    if (missing.length === 0) return;

    async function loadTxMeta() {
      const results = await Promise.all(
        missing.map(async (item) => {
          try {
            const response = await fetch(RPC_URL, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: item.transactionHash,
                method: "starknet_getTransactionByHash",
                params: [item.transactionHash],
              }),
            });
            if (!response.ok) throw new Error(`RPC ${response.status}`);
            const payload = (await response.json()) as { result?: { sender_address?: string } };
            return {
              hash: item.transactionHash,
              meta: { senderAddress: payload.result?.sender_address ?? null } satisfies PublicTxMeta,
            };
          } catch {
            return {
              hash: item.transactionHash,
              meta: { senderAddress: null } satisfies PublicTxMeta,
            };
          }
        }),
      );
      if (disposed) return;
      setTxMeta((previous) => {
        const next = { ...previous };
        for (const result of results) next[result.hash] = result.meta;
        return next;
      });
    }

    void loadTxMeta();
    return () => { disposed = true; };
  }, [visibleItems, txMeta]);

  return (
    <section className="relative overflow-hidden rounded-xl border border-[#315069]/70 bg-[linear-gradient(180deg,rgba(6,14,20,.97),rgba(4,9,13,.96))] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_28px_80px_rgba(0,0,0,.18)] lg:sticky lg:top-5">
      <div className="vinss-network-scan pointer-events-none absolute inset-x-0 top-0 h-px" />

      <header className="relative border-b border-[#294255]/70 px-4 py-3.5 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-signal/15 bg-signal/[0.035] text-signal/70 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              <TransactionIcon />
            </div>
            <div>
              <h2 className="font-display text-sm uppercase tracking-[0.2em] text-paper/88 sm:text-base">LOG TX</h2>
              <p className="mt-1 font-display text-[7px] uppercase tracking-[0.15em] text-paper/24">Public activity</p>
            </div>
          </div>

          <span className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 font-display text-[8px] uppercase tracking-[0.16em] ${
            status === "offline"
              ? "border-amber/25 bg-amber/[0.035] text-amber"
              : "border-signal/20 bg-signal/[0.025] text-signal"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              status === "live" ? "vinss-live-dot bg-signal" : status === "offline" ? "bg-amber" : "vinss-live-dot bg-paper/30"
            }`} />
            {status === "live" ? "Live" : status === "offline" ? "Retrying" : "Syncing"}
          </span>
        </div>
      </header>

      <div aria-live="polite" className="max-h-[500px] overflow-y-auto lg:max-h-[720px]">
        {status === "loading" && items.length === 0 && (
          <div className="divide-y divide-wire/45 px-4 sm:px-5">
            {[0, 1, 2].map((item) => (
              <div className="py-4" key={item}>
                <div className="h-2 w-28 animate-pulse rounded bg-paper/10" />
                <div className="mt-2.5 h-2 w-40 animate-pulse rounded bg-paper/[0.055]" />
              </div>
            ))}
          </div>
        )}

        {status === "offline" && items.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-amber">Stream reconnecting</p>
            <p className="mt-2 text-xs leading-5 text-paper/30">Rooms remain available locally while the public index reconnects.</p>
          </div>
        )}

        {status === "live" && items.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-paper/45">Listening for activity</p>
            <p className="mt-2 text-xs text-paper/25">New public proofs will appear here.</p>
          </div>
        )}

        {visibleItems.map((item, index) => {
          const meta = ACTIVITY_LABELS[item.kind];
          const displayLabel = item.kind === "certificate_issued" && item.certificate
            ? `CERTIFICATE · ${item.certificate.role === 1 ? "PAYER" : "PAYEE"}`
            : meta.label;
          const publicTx = txMeta[item.transactionHash];

          return (
            <article
              className="vinss-feed-entry group relative border-b border-[#233744]/60 px-4 py-3.5 transition hover:bg-signal/[0.018] sm:px-5"
              key={`${item.transactionHash}:${item.actionLocator}:${item.kind}`}
              style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal/70 shadow-[0_0_10px_rgba(94,234,212,.5)]" />
                  <p className={`min-w-0 truncate font-display text-[9px] uppercase tracking-[0.13em] sm:text-[10px] ${meta.accent}`}>
                    {displayLabel}
                  </p>
                </div>
                <time className="shrink-0 rounded-full bg-paper/[0.025] px-2 py-1 font-display text-[7px] tracking-[0.08em] text-paper/28">
                  {formatRelativeTime(item.indexedAt, now)}
                </time>
              </div>

              <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-[7px] uppercase tracking-[0.11em] text-paper/24 sm:text-[8px]">
                    FROM&nbsp;&nbsp;
                    <span className="text-paper/52" title={publicTx?.senderAddress ?? undefined}>
                      {publicTx?.senderAddress ? shortAddress(publicTx.senderAddress) : "LOADING…"}
                    </span>
                  </p>
                  <p className="mt-1 truncate font-display text-[7px] uppercase tracking-[0.11em] text-paper/22 sm:text-[8px]">
                    TX&nbsp;&nbsp;<span className="text-paper/42">{shortHash(item.transactionHash)}</span>
                  </p>
                </div>

                <a
                  className="inline-flex min-h-8 items-center rounded-md border border-wire/55 bg-black/15 px-2.5 font-display text-[7px] uppercase tracking-[0.13em] text-paper/46 transition hover:border-signal/35 hover:text-signal sm:text-[8px]"
                  href={explorerUrl(item.transactionHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  View ↗
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {items.length > COMPACT_COUNT && (
        <button
          className="flex w-full items-center justify-between border-t border-[#294255]/70 px-4 py-3 font-display text-[8px] uppercase tracking-[0.18em] text-paper/32 transition hover:bg-signal/[0.02] hover:text-signal sm:px-5"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span>{expanded ? "Compact log" : "Expand log"}</span>
          <span>{expanded ? "↑" : `+${items.length - COMPACT_COUNT}`}</span>
        </button>
      )}

      <footer className="border-t border-[#294255]/60 px-4 py-3 font-display text-[7px] uppercase leading-4 tracking-[0.15em] text-paper/20 sm:px-5">
        Public metadata only · No room ID · No plaintext
      </footer>
    </section>
  );
}
