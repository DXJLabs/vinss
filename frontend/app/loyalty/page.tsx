"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getLoyaltyLevel,
  type LoyaltyEntry,
} from "@/lib/loyalty";

const STORAGE_KEY = "vinss:loyalty";

const DEMO_ENTRIES: LoyaltyEntry[] = [
  {
    id: "demo-1",
    event: "deal_completed",
    points: 250,
    createdAt: new Date().toISOString(),
    label: "Deal completed",
  },
  {
    id: "demo-2",
    event: "escrow_funded",
    points: 100,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    label: "Escrow funded",
  },
  {
    id: "demo-3",
    event: "offer_created",
    points: 25,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    label: "Offer created",
  },
];

function loadEntries(): LoyaltyEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEMO_ENTRIES;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEMO_ENTRIES;
  } catch {
    return DEMO_ENTRIES;
  }
}

export default function LoyaltyPage() {
  const [entries, setEntries] = useState<LoyaltyEntry[]>([]);
  const [redeemed, setRedeemed] = useState(false);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const points = useMemo(
    () => entries.reduce((total, entry) => total + entry.points, 0),
    [entries],
  );

  const { current, next } = getLoyaltyLevel(points);

  const progress = next
    ? Math.min(
        100,
        Math.max(
          0,
          ((points - current.min) / (next.min - current.min)) * 100,
        ),
      )
    : 100;

  const estimatedVins = points / 10;

  function handleRedeem() {
    if (points <= 0) return;
    setRedeemed(true);
  }

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        <header className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="font-display text-xs uppercase tracking-widest text-paper/45 hover:text-signal"
          >
            ← VINSS
          </Link>

          <nav className="flex items-center gap-5 text-xs">
            <Link href="/rooms" className="text-paper/45 hover:text-signal">
              Rooms
            </Link>
            <span className="text-signal">Loyalty</span>
            <Link href="/wallet" className="text-paper/45 hover:text-signal">
              Wallet
            </Link>
          </nav>
        </header>

        <section className="mb-8">
          <p className="mb-2 font-display text-[10px] uppercase tracking-[0.25em] text-signal">
            VINSS Loyalty
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Contribute. Earn. Redeem.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper/45">
            Earn points from activity across your private deal rooms.
            Redeem eligible points toward VINS and the DXJ ecosystem.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.35fr_1fr]">
          <div className="border border-wire bg-vault/50 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-[10px] uppercase tracking-widest text-paper/35">
                  Your contribution
                </p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-5xl tracking-tight">
                    {points.toLocaleString()}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-paper/35">
                    points
                  </span>
                </div>
              </div>

              <div className="border border-signal/40 px-3 py-2 text-right">
                <p className="font-display text-[9px] uppercase tracking-widest text-paper/35">
                  Level
                </p>
                <p className="mt-1 font-display text-xs tracking-widest text-signal">
                  {current.name}
                </p>
                <p className="mt-1 text-[10px] text-paper/35">
                  {current.multiplier.toFixed(2)}×
                </p>
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-2 flex justify-between text-[10px] text-paper/35">
                <span>{current.name}</span>
                <span>
                  {next ? `${points.toLocaleString()} / ${next.min.toLocaleString()}` : "MAX LEVEL"}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden bg-paper/10">
                <div
                  className="h-full bg-signal transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {next && (
                <p className="mt-2 text-[10px] text-paper/30">
                  {(next.min - points).toLocaleString()} points to {next.name}
                </p>
              )}
            </div>
          </div>

          <div className="border border-wire bg-vault/50 p-6">
            <p className="font-display text-[10px] uppercase tracking-widest text-paper/35">
              Reward path
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs">
              <span className="border border-wire px-3 py-2">Points</span>
              <span className="text-paper/25">→</span>
              <span className="border border-wire px-3 py-2">VINS</span>
              <span className="text-paper/25">→</span>
              <span className="border border-signal/40 px-3 py-2 text-signal">
                DXJ
              </span>
            </div>

            <p className="mt-5 text-[11px] leading-relaxed text-paper/35">
              VINSS Loyalty ends at DXJ. What you do with DXJ afterward is
              controlled by you.
            </p>
          </div>
        </section>

        <section className="mt-8 border border-wire">
          <div className="border-b border-wire px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xs uppercase tracking-widest">
                Earn points
              </h2>
              <span className="text-[10px] text-paper/30">
                Every valid activity counts
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2">
            {[
              ["Message sent", "+1"],
              ["Create offer", "+25"],
              ["Offer accepted", "+50"],
              ["Escrow created", "+50"],
              ["Escrow funded", "+100"],
              ["Deal completed", "+250"],
              ["Invite user", "+100"],
              ["Successful referral", "+500"],
            ].map(([label, reward]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-wire px-5 py-4 last:border-b-0 sm:nth-[odd]:border-r"
              >
                <span className="text-sm text-paper/65">{label}</span>
                <span className="font-display text-xs tracking-widest text-signal">
                  {reward}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 border border-wire">
          <div className="border-b border-wire px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xs uppercase tracking-widest">
                Recent activity
              </h2>
              <span className="text-[10px] text-paper/30">
                {entries.length} events
              </span>
            </div>
          </div>

          <div>
            {entries.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-paper/35">
                Your loyalty activity will appear here.
              </div>
            ) : (
              entries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b border-wire px-5 py-4 last:border-b-0"
                >
                  <div>
                    <p className="text-sm text-paper/70">{entry.label}</p>
                    <p className="mt-1 text-[10px] text-paper/25">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <span className="font-display text-xs text-signal">
                    +{entry.points}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-8 border border-signal/30 bg-signal/[0.025] p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-[10px] uppercase tracking-widest text-paper/35">
                Redeem
              </p>
              <p className="mt-2 font-display text-2xl">
                {points.toLocaleString()} Points
              </p>
              <p className="mt-1 text-xs text-paper/35">
                Estimated {estimatedVins.toLocaleString()} VINS
              </p>
              <p className="mt-3 text-[10px] leading-relaxed text-paper/30">
                Final conversion is determined at redemption.
                VINSS does not handle DXJ → STRK or cash conversion.
              </p>
            </div>

            <button
              onClick={handleRedeem}
              disabled={points <= 0 || redeemed}
              className="border border-signal px-6 py-3 font-display text-xs uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              {redeemed ? "Redemption requested" : "Redeem to DXJ →"}
            </button>
          </div>
        </section>

        <footer className="mt-10 border-t border-wire pt-5 text-[10px] leading-relaxed text-paper/25">
          Loyalty points are an internal VINSS reward unit. Redemption,
          eligibility, conversion rates, and token settlement may be subject
          to the applicable VINSS program rules.
        </footer>
      </div>
    </main>
  );
}
