"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BACKEND_URL,
  NETWORK,
  STRK_ADDRESS,
  USDC_ADDRESS,
} from "@/lib/starknet/constants";
import { formatUnits } from "@/lib/utils/units";

type ActivityKind =
  | "message"
  | "offer"
  | "escrow"
  | "rekber_funded"
  | "rekber_released"
  | "rekber_refunded";

interface ActivityItem {
  network: "sepolia" | "mainnet";
  kind: ActivityKind;
  contractAddress: string;
  actionLocator: string;
  blockNumber: number;
  transactionHash: string;
  indexedAt: string;
  rekber?: {
    amount?: string;
    token?: string;
  };
}

interface ActivityResponse {
  items?: unknown;
}

export interface ActivitySnapshot {
  count: number;
  online: boolean;
  lastUpdated: string | null;
}

interface LiveTxFeedProps {
  onSnapshot?: (snapshot: ActivitySnapshot) => void;
}

const COMPACT_COUNT = 5;

const ACTIVITY_LABELS: Record<
  ActivityKind,
  { label: string; accent: string; target: string }
> = {
  message: {
    label: "MESSAGE",
    accent: "text-paper/70",
    target: "VINSS MESSAGE",
  },
  offer: {
    label: "OFFER · ACTION",
    accent: "text-signal",
    target: "VINSS OFFER",
  },
  escrow: {
    label: "REKBER · START",
    accent: "text-amber",
    target: "VINSS REKBER",
  },
  rekber_funded: {
    label: "REKBER · FUND",
    accent: "text-signal",
    target: "VINSS REKBER",
  },
  rekber_released: {
    label: "REKBER · RELEASE",
    accent: "text-signal",
    target: "VINSS REKBER",
  },
  rekber_refunded: {
    label: "REKBER · REFUND",
    accent: "text-amber",
    target: "VINSS REKBER",
  },
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

function formatRelativeTime(value: string, now: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || now <= 0) return "NOW";

  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1_000));

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function sameAddress(left: string | undefined, right: string) {
  if (!left || !right) return false;

  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

function formatActivityAmount(item: ActivityItem) {
  const amount = item.rekber?.amount;
  const token = item.rekber?.token;

  if (!amount || !token) return null;

  try {
    if (sameAddress(token, STRK_ADDRESS)) {
      return `${formatUnits(BigInt(amount), 18)} STRK`;
    }

    if (sameAddress(token, USDC_ADDRESS)) {
      return `${formatUnits(BigInt(amount), 6)} USDC`;
    }
  } catch {
    return null;
  }

  return null;
}

function explorerUrl(transactionHash: string) {
  return NETWORK === "mainnet"
    ? `https://voyager.online/tx/${transactionHash}`
    : `https://sepolia.voyager.online/tx/${transactionHash}`;
}

export function LiveTxFeed({ onSnapshot }: LiveTxFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "offline">(
    "loading",
  );
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(0);

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
        const response = await fetch(
          `${BACKEND_URL.replace(/\/$/, "")}/activity?limit=50`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Activity request failed: ${response.status}`);
        }

        const payload = (await response.json()) as ActivityResponse;
        const seen = new Set<string>();
        const nextItems = Array.isArray(payload.items)
          ? payload.items
              .filter(isActivityItem)
              .filter((item) => {
                const key = `${item.transactionHash}:${item.actionLocator}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              })
          : [];

        if (disposed) return;

        knownCount = nextItems.length;
        setItems(nextItems);
        setStatus("live");
        onSnapshot?.({
          count: nextItems.length,
          online: true,
          lastUpdated: new Date().toISOString(),
        });
      } catch {
        if (disposed || controller.signal.aborted) return;

        setStatus("offline");
        onSnapshot?.({
          count: knownCount,
          online: false,
          lastUpdated: null,
        });
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

  const visibleItems = useMemo(
    () => (expanded ? items : items.slice(0, COMPACT_COUNT)),
    [expanded, items],
  );

  const amountByCustody = useMemo(() => {
    const amounts = new Map<string, string>();

    for (const item of items) {
      const amount = formatActivityAmount(item);

      if (amount) {
        amounts.set(item.actionLocator, amount);
      }
    }

    return amounts;
  }, [items]);

  return (
    <section className="overflow-hidden border border-wire/90 bg-[#090c0f]/95 lg:sticky lg:top-5">
      <header className="relative border-b border-wire/70 px-4 py-4 sm:px-5">
        <div className="vinss-network-scan pointer-events-none absolute inset-x-0 top-0 h-px" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[9px] uppercase tracking-[0.26em] text-paper/42">
              VINSS
            </p>
            <h2 className="mt-1 font-display text-base uppercase tracking-[0.16em] text-paper/88">
              LIVE TX
            </h2>
            <p className="mt-1.5 font-display text-[7px] uppercase tracking-[0.18em] text-paper/28 sm:text-[8px]">
              STARKNET · {NETWORK.toUpperCase()}
            </p>
          </div>

          <span
            className={`flex items-center gap-2 font-display text-[9px] uppercase tracking-[0.18em] ${
              status === "offline" ? "text-amber" : "text-signal"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "live"
                  ? "vinss-live-dot bg-signal"
                  : status === "offline"
                    ? "bg-amber"
                    : "vinss-live-dot bg-paper/30"
              }`}
            />
            {status === "live"
              ? "Live"
              : status === "offline"
                ? "Retrying"
                : "Syncing"}
          </span>
        </div>
      </header>

      <div aria-live="polite" className="max-h-[610px] overflow-y-auto lg:max-h-[760px]">
        {status === "loading" && items.length === 0 && (
          <div className="divide-y divide-wire/55 px-4 sm:px-5">
            {[0, 1, 2, 3].map((item) => (
              <div className="py-3" key={item}>
                <div className="h-2 w-28 animate-pulse bg-paper/10" />
                <div className="mt-3 h-2 w-40 animate-pulse bg-paper/[0.055]" />
              </div>
            ))}
          </div>
        )}

        {status === "offline" && items.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-amber">
              Stream reconnecting
            </p>
            <p className="mt-2 text-xs leading-5 text-paper/30">
              Rooms remain available locally while the public index reconnects.
            </p>
          </div>
        )}

        {status === "live" && items.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-paper/45">
              Listening for activity
            </p>
            <p className="mt-2 text-xs text-paper/25">
              New public proofs will appear here.
            </p>
          </div>
        )}

        {visibleItems.map((item, index) => {
          const meta = ACTIVITY_LABELS[item.kind];
          const amount =
            formatActivityAmount(item) ??
            amountByCustody.get(item.actionLocator);

          return (
            <article
              className="vinss-feed-entry group relative border-b border-wire/55 px-4 py-4 transition hover:bg-paper/[0.022] sm:px-5"
              key={`${item.transactionHash}:${item.actionLocator}`}
              style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`min-w-0 truncate font-display text-[9px] uppercase tracking-[0.13em] sm:text-[10px] ${meta.accent}`}
                >
                  <span className="mr-2 text-paper/55">&gt;</span>
                  {meta.label}
                </p>
                <time className="shrink-0 font-display text-[8px] tracking-[0.08em] text-paper/25">
                  {formatRelativeTime(item.indexedAt, now)}
                </time>
              </div>

              {amount && (
                <p className="mt-3 font-display text-xs tracking-[0.05em] text-paper/76">
                  {amount}
                </p>
              )}

              <dl className="mt-3 space-y-1.5 font-display text-[7px] uppercase tracking-[0.12em] sm:text-[8px]">
                <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
                  <dt className="text-paper/20">FROM</dt>
                  <dd className="text-danger/62">[PRIVATE]</dd>
                </div>
                <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-2">
                  <dt className="text-paper/20">TO</dt>
                  <dd
                    className="truncate text-paper/42"
                    title={item.contractAddress}
                  >
                    {meta.target}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-wire/35 pt-3">
                <p className="min-w-0 truncate font-display text-[7px] uppercase tracking-[0.12em] text-paper/30 sm:text-[8px]">
                  TX&nbsp;&nbsp;{shortHash(item.transactionHash)}
                </p>

                <a
                  className="shrink-0 font-display text-[7px] uppercase tracking-[0.14em] text-paper/45 transition hover:text-signal sm:text-[8px]"
                  href={explorerUrl(item.transactionHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  View &gt;&gt;
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {items.length > COMPACT_COUNT && (
        <button
          className="flex w-full items-center justify-between border-t border-wire/70 px-4 py-3 font-display text-[8px] uppercase tracking-[0.18em] text-paper/30 transition hover:text-signal sm:px-5"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span>{expanded ? "Compact log" : "Expand log"}</span>
          <span>{expanded ? "↑" : `+${items.length - COMPACT_COUNT}`}</span>
        </button>
      )}

      <footer className="border-t border-wire/70 px-4 py-3 font-display text-[7px] uppercase leading-4 tracking-[0.16em] text-paper/20 sm:px-5">
        Public metadata only · No room ID · No plaintext
      </footer>
    </section>
  );
}
