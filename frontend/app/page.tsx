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
  },
  {
    number: "02",
    label: "OFFER",
    title: "Structured agreement",
  },
  {
    number: "03",
    label: "REKBER",
    title: "Secure payment",
  },
  {
    number: "04",
    label: "SETTLE",
    title: "Release or refund",
  },
  {
    number: "05",
    label: "CERTIFICATE",
    title: "Optional public proof",
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
    "inline-flex h-8 w-8 items-center justify-center text-paper/38 transition hover:text-signal [&_svg]:h-[18px] [&_svg]:w-[18px]";

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
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-y border-wire/75 py-3 sm:gap-4">
          <a className="group min-w-0" href="#top">
            <div className="font-display text-base tracking-[0.22em] text-paper transition group-hover:text-signal sm:text-lg">
              VINSS
            </div>
            <p className="mt-1 truncate font-display text-[6px] uppercase tracking-[0.2em] text-paper/28 sm:text-[7px]">
              Private Deal Room · Starknet
            </p>
          </a>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden font-display text-[7px] uppercase tracking-[0.16em] text-paper/30 sm:inline">
              {NETWORK}
            </span>
            <span className="shrink-0" data-guide="wallet">
              <WalletConnectButton showCapability={false} />
            </span>
          </div>
        </header>

        <section
          className="scroll-mt-6 border-b border-wire/80 pb-6 pt-10 sm:py-14 lg:py-16"
          id="top"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(290px,.75fr)] lg:items-end lg:gap-14">
            <div>
              <p className="font-display text-[9px] uppercase tracking-[0.3em] text-signal sm:text-[10px]">
                Private Deal Room on Starknet
              </p>

              <h1 className="mt-4 max-w-4xl text-[2.2rem] font-medium leading-[1.04] tracking-[-0.035em] text-paper sm:mt-5 sm:text-5xl lg:text-[4.15rem]">
                Negotiate privately.
                <br />
                <span className="text-paper/48">Settle with confidence.</span>
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-6 text-paper/50 sm:mt-6 sm:text-base sm:leading-7">
                VINSS keeps conversation, structured Offers, and deal context
                inside a private room—and is built to carry an accepted
                agreement through Rekber, settlement, and verifiable evidence.
              </p>

              <p className="mt-4 font-display text-[8px] uppercase leading-4 tracking-[0.13em] text-paper/26">
                Deals do not begin with a transaction. They begin with trust.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <a
                  className="inline-flex min-h-11 items-center justify-center border border-signal bg-signal px-5 font-display text-[8px] uppercase tracking-[0.17em] text-ink transition hover:bg-transparent hover:text-signal"
                  href="#rooms"
                >
                  {session ? "Open workspace →" : "Open workspace ↓"}
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
              className="overflow-hidden border border-wire/80 bg-[#090c0f]/78"
              data-guide="privacy"
              id="privacy-model"
            >
              <header className="flex items-center justify-between border-b border-wire/60 px-3.5 py-2.5 sm:px-4 sm:py-3">
                <span className="font-display text-[8px] uppercase tracking-[0.2em] text-paper/38">
                  Privacy boundary
                </span>
                <span className="flex items-center gap-2 font-display text-[8px] uppercase tracking-[0.15em] text-signal">
                  <span className="vinss-live-dot h-1.5 w-1.5 rounded-full bg-signal" />
                  Active
                </span>
              </header>

              <div className="grid grid-cols-2 gap-px bg-wire/55 lg:grid-cols-1 xl:grid-cols-2">
                <div className="min-w-0 bg-[#0a0d10] p-3.5 sm:p-4">
                  <p className="font-display text-[8px] uppercase tracking-[0.17em] text-signal/75">
                    Hidden
                  </p>
                  <p className="mt-2 text-[11px] leading-[1.55] text-paper/46 sm:mt-3 sm:text-xs sm:leading-5">
                    Messages, Offer terms, deal notes, room secrets
                  </p>
                </div>
                <div className="min-w-0 bg-[#0a0d10] p-3.5 sm:p-4">
                  <p className="font-display text-[8px] uppercase tracking-[0.17em] text-amber/75">
                    Visible
                  </p>
                  <p className="mt-2 text-[11px] leading-[1.55] text-paper/46 sm:mt-3 sm:text-xs sm:leading-5">
                    Transaction timing, commitments, public proofs, optional NFT owner
                  </p>
                </div>
              </div>

              <p className="border-t border-wire/60 px-3.5 py-2.5 text-[9px] leading-4 text-paper/26 sm:px-4 sm:py-3 sm:text-[10px]">
                Public-observer privacy is not the same as hiding every piece of
                blockchain metadata.
              </p>
            </aside>
          </div>
        </section>

        <section
          className="py-5 sm:py-8"
          data-guide="workflow"
          id="workflow"
        >
          <div className="mb-3 flex items-center gap-3 sm:mb-4">
            <p className="font-display text-[8px] uppercase tracking-[0.22em] text-paper/35">
              Deal lifecycle
            </p>
            <span className="h-px flex-1 bg-wire/70" />
            <p className="hidden font-display text-[7px] uppercase tracking-[0.15em] text-paper/22 sm:block">
              Conversation → Agreement → Rekber → Settlement → Evidence
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px border border-wire/75 bg-wire/65 lg:grid-cols-5">
            {LIFECYCLE.map((item, index) => (
              <article className="relative min-h-[118px] bg-[#090c0f] p-3.5 last:col-span-2 sm:p-4 lg:min-h-0 lg:last:col-span-1 lg:p-5" key={item.label}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-[8px] text-paper/22">
                    {item.number}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-[10px] uppercase tracking-[0.15em] text-paper/82 sm:text-[11px] lg:mt-7 lg:text-xs">
                  {item.label}
                </h2>
                <p className="mt-1.5 text-[10px] leading-4 text-paper/34 sm:text-[11px]">{item.title}</p>
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



                        <footer className="mt-6 border-t border-wire/75 sm:mt-8">
          <div className="py-3.5">
            <p className="font-display text-[8px] uppercase tracking-[0.22em] text-paper/38">
              Resources
            </p>

            <nav
              aria-label="VINSS resources"
              className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 font-display text-[7px] uppercase tracking-[0.12em]"
            >
              <a
                className="text-paper/35 transition hover:text-signal"
                href={`${GITHUB_URL}#how-it-works`}
                rel="noreferrer"
                target="_blank"
              >
                How VINSS works ↗
              </a>

              <a
                className="text-paper/35 transition hover:text-signal"
                href={`${GITHUB_URL}/blob/main/STRK20_INTEGRATION_PLAN.md`}
                rel="noreferrer"
                target="_blank"
              >
                Technical docs ↗
              </a>

              <a
                className="text-paper/35 transition hover:text-signal"
                href={`${GITHUB_URL}/blob/main/TEST_REPORT.md`}
                rel="noreferrer"
                target="_blank"
              >
                Test evidence ↗
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3 py-2.5">
            <SocialLink href={TELEGRAM_URL} label="VINSS Telegram">
              <TelegramIcon />
            </SocialLink>

            <SocialLink href={X_URL} label="VINSS on X">
              <XIcon />
            </SocialLink>

            <SocialLink href={GITHUB_URL} label="VINSS GitHub">
              <GithubIcon />
            </SocialLink>
          </div>

          <div className="flex items-center justify-between gap-4 pb-3 pt-1">
            <p className="text-[11px] text-paper/32">
              © 2026 VINSS
            </p>

            <Link
              className="text-[11px] text-paper/32 transition hover:text-signal"
              href="/terms"
            >
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>

      <GuidedDeal
        onClose={() => setGuideOpen(false)}
        open={guideOpen}
      />
    </main>
  );
}
