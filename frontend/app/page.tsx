"use client";

import Link from "next/link";
import { useState } from "react";

import { WalletConnectButton } from "@/components/WalletConnectButton";
import { GuidedDeal } from "@/components/home/GuidedDeal";
import { HomeWorkspace } from "@/components/home/HomeWorkspace";
import { useWallet } from "@/components/providers/WalletProvider";
import { NETWORK } from "@/lib/starknet/constants";

const GITHUB_URL =
  process.env.NEXT_PUBLIC_VINSS_GITHUB_URL ??
  "https://github.com/DXJLabs/vinss";
const TELEGRAM_URL = process.env.NEXT_PUBLIC_VINSS_TELEGRAM_URL ?? "";
const X_URL = process.env.NEXT_PUBLIC_VINSS_X_URL ?? "";

const LIFECYCLE = [
  {
    number: "01",
    label: "CHAT",
    title: "Private conversation",
    status: "Testnet verified",
    tone: "signal",
  },
  {
    number: "02",
    label: "OFFER",
    title: "Structured agreement",
    status: "Testnet verified",
    tone: "signal",
  },
  {
    number: "03",
    label: "REKBER",
    title: "Two-party custody setup",
    status: "Testnet gate",
    tone: "amber",
  },
  {
    number: "04",
    label: "SETTLE",
    title: "Release or timeout refund",
    status: "Testnet gate",
    tone: "amber",
  },
  {
    number: "05",
    label: "CERTIFICATE",
    title: "Optional public NFT proof",
    status: "Testnet gate",
    tone: "muted",
  },
] as const;

function TelegramIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M20.4 4.2 3.8 10.6c-1.1.4-1.1 1.1-.2 1.4l4.2 1.3 1.6 4.9c.2.5.1.7.7.7.4 0 .7-.2.9-.4l2.1-2 4.4 3.2c.8.4 1.4.2 1.6-.8l2.8-13.3c.3-1.2-.5-1.8-1.5-1.4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="m8 13.2 9.8-6.1-7.7 7.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 4.5h3.8l10.2 15h-3.8L5 4.5Zm13.6 0-5.2 6.1M10.7 13.7 5.4 19.5"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 3.5a8.5 8.5 0 0 0-2.7 16.6c.4.1.6-.2.6-.4v-1.6c-2.4.5-3-1-3-1-.4-1-.9-1.3-.9-1.3-.8-.5 0-.5 0-.5.9.1 1.3.9 1.3.9.8 1.3 2 1 2.6.8.1-.6.3-1 .6-1.2-1.9-.2-4-1-4-4.2 0-.9.4-1.7 1-2.3-.1-.2-.4-1.1.1-2.3 0 0 .8-.3 2.4.9a8.4 8.4 0 0 1 4.4 0c1.6-1.2 2.4-.9 2.4-.9.5 1.2.2 2.1.1 2.3.7.6 1 1.4 1 2.3 0 3.3-2 4-4 4.2.4.3.7.9.7 1.7v2.2c0 .2.2.5.6.4A8.5 8.5 0 0 0 12 3.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const classes =
    "flex h-10 w-10 items-center justify-center border border-wire text-paper/42 transition hover:border-signal/50 hover:text-signal [&_svg]:h-4 [&_svg]:w-4";

  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${label} link pending`}
        className={`${classes} cursor-not-allowed opacity-35`}
        title={`${label} link belum dikonfigurasi`}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      aria-label={label}
      className={classes}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

export default function HomePage() {
  const { session } = useWallet();
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <main className="vinss-home relative min-h-screen overflow-hidden">
      <div aria-hidden="true" className="vinss-home-grid pointer-events-none fixed inset-0" />

      <div className="relative z-10 mx-auto w-full max-w-[1220px] px-4 pb-10 pt-4 sm:px-7 sm:pb-14 sm:pt-6 lg:px-10">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y border-wire/75 py-3">
          <a className="group min-w-0" href="#top">
            <div className="font-display text-base tracking-[0.22em] text-paper transition group-hover:text-signal sm:text-lg">
              VINSS
            </div>
            <p className="mt-1 truncate font-display text-[6px] uppercase tracking-[0.2em] text-paper/28 sm:text-[7px]">
              Private Deal Room · Starknet
            </p>
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              className="min-h-9 border border-wire px-2.5 font-display text-[7px] uppercase tracking-[0.15em] text-paper/52 transition hover:border-signal/50 hover:text-signal sm:px-3.5 sm:text-[8px]"
              onClick={() => setGuideOpen(true)}
              type="button"
            >
              Get started
            </button>
            <span className="hidden font-display text-[7px] uppercase tracking-[0.16em] text-paper/30 sm:inline">
              {NETWORK}
            </span>
            <span data-guide="wallet">
              <WalletConnectButton showCapability={false} />
            </span>
          </div>
        </header>

        <section
          className="scroll-mt-6 border-b border-wire/80 py-14 sm:py-16 lg:py-20"
          id="top"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(290px,.75fr)] lg:items-end lg:gap-16">
            <div>
              <p className="font-display text-[9px] uppercase tracking-[0.3em] text-signal sm:text-[10px]">
                Private Deal Room on Starknet
              </p>

              <h1 className="mt-5 max-w-4xl text-[2.35rem] font-medium leading-[1.04] tracking-[-0.035em] text-paper sm:text-5xl lg:text-[4.15rem]">
                Negotiate privately.
                <br />
                <span className="text-paper/48">Settle with confidence.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-sm leading-6 text-paper/50 sm:text-base sm:leading-7">
                VINSS keeps conversation, structured Offers, and deal context
                inside a private room—and is built to carry an accepted
                agreement through Rekber, settlement, and verifiable evidence.
              </p>

              <p className="mt-4 font-display text-[8px] uppercase leading-4 tracking-[0.13em] text-paper/26">
                Deals do not begin with a transaction. They begin with trust.
              </p>

              <div className="mt-8 flex flex-wrap gap-2.5">
                <a
                  className="inline-flex min-h-11 items-center justify-center border border-signal bg-signal px-5 font-display text-[8px] uppercase tracking-[0.17em] text-ink transition hover:bg-transparent hover:text-signal"
                  href="#rooms"
                >
                  {session ? "Open workspace →" : "Explore private rooms ↓"}
                </a>
                <button
                  className="inline-flex min-h-11 items-center justify-center border border-wire px-5 font-display text-[8px] uppercase tracking-[0.17em] text-paper/50 transition hover:border-paper/40 hover:text-paper"
                  onClick={() => setGuideOpen(true)}
                  type="button"
                >
                  How it works
                </button>
              </div>

              {session && (
                <p className="mt-4 font-display text-[7px] uppercase tracking-[0.15em] text-signal/60">
                  Wallet connected · {session.address.slice(0, 7)}…{session.address.slice(-5)}
                </p>
              )}
            </div>

            <aside
              className="border border-wire/85 bg-[#090c0f]/78"
              data-guide="privacy"
              id="privacy-model"
            >
              <header className="flex items-center justify-between border-b border-wire/65 px-4 py-3">
                <span className="font-display text-[8px] uppercase tracking-[0.2em] text-paper/38">
                  Privacy boundary
                </span>
                <span className="flex items-center gap-2 font-display text-[8px] uppercase tracking-[0.15em] text-signal">
                  <span className="vinss-live-dot h-1.5 w-1.5 rounded-full bg-signal" />
                  Active
                </span>
              </header>

              <div className="grid gap-px bg-wire/60 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="bg-[#0a0d10] p-4">
                  <p className="font-display text-[8px] uppercase tracking-[0.17em] text-signal/75">
                    Hidden
                  </p>
                  <p className="mt-3 text-xs leading-5 text-paper/50">
                    Messages, Offer terms, deal notes, room secrets
                  </p>
                </div>
                <div className="bg-[#0a0d10] p-4">
                  <p className="font-display text-[8px] uppercase tracking-[0.17em] text-amber/75">
                    Visible
                  </p>
                  <p className="mt-3 text-xs leading-5 text-paper/50">
                    Transaction timing, commitments, public proofs, optional NFT owner
                  </p>
                </div>
              </div>

              <p className="border-t border-wire/65 px-4 py-3 text-[10px] leading-4 text-paper/28">
                Public-observer privacy is not the same as hiding every piece of
                blockchain metadata.
              </p>
            </aside>
          </div>
        </section>

        <section
          className="py-7 sm:py-9"
          data-guide="workflow"
          id="workflow"
        >
          <div className="mb-4 flex items-center gap-3">
            <p className="font-display text-[8px] uppercase tracking-[0.22em] text-paper/35">
              Deal lifecycle
            </p>
            <span className="h-px flex-1 bg-wire/70" />
            <p className="hidden font-display text-[7px] uppercase tracking-[0.15em] text-paper/22 sm:block">
              Conversation → Agreement → Rekber → Settlement → Evidence
            </p>
          </div>

          <div className="grid gap-px border border-wire/80 bg-wire/70 sm:grid-cols-2 lg:grid-cols-5">
            {LIFECYCLE.map((item, index) => (
              <article className="relative bg-[#090c0f] p-4 sm:p-5" key={item.label}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-[8px] text-paper/22">
                    {item.number}
                  </span>
                  <span
                    className={`font-display text-[7px] uppercase tracking-[0.12em] ${
                      item.tone === "signal"
                        ? "text-signal/70"
                        : item.tone === "amber"
                          ? "text-amber/70"
                          : "text-paper/25"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <h2 className="mt-7 font-display text-xs uppercase tracking-[0.16em] text-paper/85">
                  {item.label}
                </h2>
                <p className="mt-2 text-[11px] text-paper/34">{item.title}</p>
                {index < LIFECYCLE.length - 1 && (
                  <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 bg-[#090c0f] px-1 font-display text-[8px] text-signal/55 lg:block">
                    →
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>

        <HomeWorkspace />

        <section className="mt-12 grid gap-px border border-wire/80 bg-wire/65 sm:grid-cols-3">
          <details className="group bg-[#090c0f] p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-[8px] uppercase tracking-[0.18em] text-paper/55">
              Privacy model
              <span className="text-signal/55 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-4 text-[11px] leading-5 text-paper/35">
              Encryption protects private deal context. Pool interaction,
              timing, commitments, and settlement results can remain public.
            </p>
          </details>

          <details className="group bg-[#090c0f] p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-[8px] uppercase tracking-[0.18em] text-paper/55">
              Verification status
              <span className="text-signal/55 transition group-open:rotate-45">+</span>
            </summary>
            <ul className="mt-4 space-y-2 font-display text-[7px] uppercase leading-4 tracking-[0.1em] text-paper/35">
              <li><span className="text-signal">●</span> Message · Testnet verified</li>
              <li><span className="text-signal">●</span> Offer · Testnet verified</li>
              <li><span className="text-amber">●</span> Rekber V2 · Testnet gate</li>
              <li><span className="text-amber">●</span> Release/refund · Testnet gate</li>
              <li><span className="text-paper/20">●</span> Certificate · Testnet gate</li>
              <li><span className="text-paper/20">●</span> Mainnet · Pending</li>
            </ul>
          </details>

          <details className="group bg-[#090c0f] p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-[8px] uppercase tracking-[0.18em] text-paper/55">
              Documentation
              <span className="text-signal/55 transition group-open:rotate-45">+</span>
            </summary>
            <div className="mt-4 flex flex-col gap-2 font-display text-[7px] uppercase tracking-[0.12em]">
              <a className="text-paper/35 transition hover:text-signal" href={`${GITHUB_URL}#how-it-works`} rel="noreferrer" target="_blank">
                How VINSS works →
              </a>
              <a className="text-paper/35 transition hover:text-signal" href={`${GITHUB_URL}/blob/main/STRK20_INTEGRATION_PLAN.md`} rel="noreferrer" target="_blank">
                Technical architecture →
              </a>
              <a className="text-paper/35 transition hover:text-signal" href={`${GITHUB_URL}/blob/main/TEST_REPORT.md`} rel="noreferrer" target="_blank">
                Test evidence →
              </a>
            </div>
          </details>
        </section>

        <footer className="mt-12 border-t border-wire/75 pt-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-[9px] uppercase tracking-[0.2em] text-paper/55">
                VINSS — Private Deal Rooms
              </p>
              <p className="mt-2 text-[10px] leading-4 text-paper/25">
                Capability-dependent privacy · Network: {NETWORK}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SocialLink href={TELEGRAM_URL} label="VINSS Telegram">
                <TelegramIcon />
              </SocialLink>
              <SocialLink href={X_URL} label="VINSS on X">
                <XIcon />
              </SocialLink>
              <SocialLink href={GITHUB_URL} label="VINSS GitHub">
                <GithubIcon />
              </SocialLink>
              <Link
                className="flex h-10 items-center justify-center border border-wire px-3 font-display text-[7px] uppercase tracking-[0.14em] text-paper/42 transition hover:border-signal/50 hover:text-signal"
                href="/loyalty"
              >
                Loyalty
              </Link>
              <Link
                className="flex h-10 items-center justify-center border border-wire px-3 font-display text-[7px] uppercase tracking-[0.14em] text-paper/42 transition hover:border-signal/50 hover:text-signal"
                href="/terms"
              >
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </div>

      <GuidedDeal onClose={() => setGuideOpen(false)} open={guideOpen} />
    </main>
  );
}
