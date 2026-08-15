"use client";

import Link from "next/link";

import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useWallet } from "@/components/providers/WalletProvider";
import { VisibilitySplit } from "@/components/StatusBadge";

export default function HomePage() {
  const { session } = useWallet();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
      {/* NAV */}
      <header className="flex items-center justify-between gap-6">
        <div>
          <div className="font-display text-xl tracking-[0.18em] text-paper sm:text-2xl">
            VINSS
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-paper/40">
            Private Deal Rooms
          </p>
        </div>

        <WalletConnectButton />
      </header>

      {/* HERO */}
      <section className="relative mt-16 overflow-hidden border-y border-wire py-14 sm:mt-20 sm:py-20 lg:mt-24 lg:py-24">
        <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-signal/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-signal/5 blur-3xl" />

        <div className="relative grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-20">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.32em] text-signal">
              Private coordination infrastructure
            </p>

            <h1 className="mt-6 max-w-4xl font-display text-4xl font-medium leading-[1.08] tracking-tight text-paper sm:text-5xl lg:text-7xl">
              Negotiate privately.
              <br />
              <span className="text-signal">Settle with confidence.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-paper/65 sm:text-lg sm:leading-8">
              VINSS gives counterparties a private room to negotiate terms,
              coordinate payments, and manage settlement without turning
              sensitive deal information into a public conversation.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {session ? (
                <Link
                  href="/rooms"
                  className="inline-flex min-h-12 items-center justify-center border border-signal bg-signal px-6 font-display text-xs uppercase tracking-[0.18em] text-ink transition hover:bg-transparent hover:text-signal"
                >
                  Open a Deal Room →
                </Link>
              ) : (
                <div className="inline-flex min-h-12 items-center justify-center border border-signal bg-signal px-6 font-display text-xs uppercase tracking-[0.18em] text-ink">
                  Connect Wallet to Start
                </div>
              )}

              <Link
                href="/rooms"
                className="inline-flex min-h-12 items-center justify-center border border-wire px-6 font-display text-xs uppercase tracking-[0.18em] text-paper/70 transition hover:border-paper/40 hover:text-paper"
              >
                Explore Rooms
              </Link>
            </div>
          </div>

          {/* PRODUCT SIGNAL */}
          <div className="lg:pb-2">
            <div className="rounded-2xl border border-wire bg-vault/40 p-5 sm:p-6">
              <div className="mb-6 flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-[0.22em] text-paper/40">
                  Privacy model
                </span>
                <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-signal">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_10px_rgba(94,234,212,.7)]" />
                  Active
                </span>
              </div>

              <VisibilitySplit
                hidden="Messages, offer terms, deal notes"
                visible="Transaction timing, commitments, public proofs"
              />

              <div className="mt-6 border-t border-wire pt-5">
                <p className="text-sm leading-6 text-paper/50">
                  Sensitive deal information stays within the private
                  coordination layer while required blockchain evidence
                  remains verifiable.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVE SESSION */}
      {session && (
        <section className="mt-8 rounded-2xl border border-signal/20 bg-signal/[0.025] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
                Wallet connected
              </p>
              <p className="mt-2 font-display text-sm text-paper/70">
                {session.address.slice(0, 8)}…{session.address.slice(-6)}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/rooms"
                className="inline-flex min-h-11 items-center justify-center border border-signal bg-signal px-5 font-display text-xs uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal"
              >
                Open Rooms →
              </Link>

              <Link
                href="/wallet"
                className="inline-flex min-h-11 items-center justify-center border border-wire px-5 font-display text-xs uppercase tracking-[0.16em] text-paper/60 transition hover:border-paper/40 hover:text-paper"
              >
                Wallet
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* PRODUCT PRINCIPLES */}
      <section className="mt-20 grid gap-px border border-wire bg-wire sm:grid-cols-3 lg:mt-28">
        <div className="bg-ink p-6 sm:p-7">
          <p className="font-display text-xs uppercase tracking-[0.22em] text-signal">
            01
          </p>
          <h2 className="mt-4 font-display text-lg text-paper">
            Private negotiation
          </h2>
          <p className="mt-3 text-sm leading-6 text-paper/50">
            Keep messages, offers, and sensitive deal context inside the room.
          </p>
        </div>

        <div className="bg-ink p-6 sm:p-7">
          <p className="font-display text-xs uppercase tracking-[0.22em] text-signal">
            02
          </p>
          <h2 className="mt-4 font-display text-lg text-paper">
            Verifiable settlement
          </h2>
          <p className="mt-3 text-sm leading-6 text-paper/50">
            Coordinate payment and escrow while preserving the evidence needed
            to verify the transaction.
          </p>
        </div>

        <div className="bg-ink p-6 sm:p-7">
          <p className="font-display text-xs uppercase tracking-[0.22em] text-signal">
            03
          </p>
          <h2 className="mt-4 font-display text-lg text-paper">
            One room, one deal
          </h2>
          <p className="mt-3 text-sm leading-6 text-paper/50">
            Every room is centered around a specific agreement, not an endless
            chat feed.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-20 flex flex-col gap-3 border-t border-wire pt-6 text-[11px] leading-5 text-paper/30 sm:mt-28 sm:flex-row sm:items-center sm:justify-between">
        <span>VINSS — Private Deal Rooms</span>
        <span>Early development · Privacy claims are capability-dependent</span>
      </footer>
    </main>
  );
}
