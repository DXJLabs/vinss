"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { GuidedDeal } from "@/components/home/GuidedDeal";
import { HomeWorkspace } from "@/components/home/HomeWorkspace";
import { useWallet } from "@/components/providers/WalletProvider";
import { NETWORK } from "@/lib/starknet/constants";
import styles from "./home-premium.module.css";

const GITHUB_URL =
  process.env.NEXT_PUBLIC_VINSS_GITHUB_URL ??
  "https://github.com/DXJLabs/vinss";
const TELEGRAM_URL = process.env.NEXT_PUBLIC_VINSS_TELEGRAM_URL ?? "";
const X_URL = process.env.NEXT_PUBLIC_VINSS_X_URL ?? "";

const LIFECYCLE = [
  { number: "01", label: "CHAT", title: "Private conversation" },
  { number: "02", label: "OFFER", title: "Structured agreement" },
  { number: "03", label: "REKBER", title: "Secure payment" },
  { number: "04", label: "SETTLE", title: "Release or refund" },
  { number: "05", label: "CERTIFICATE", title: "Optional public proof" },
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

function ShieldIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 3.2 19 6v5.2c0 4.5-2.7 7.8-7 9.6-4.3-1.8-7-5.1-7-9.6V6l7-2.8Z" stroke="currentColor" strokeWidth="1.45" />
      <path d="m8.8 12 2.1 2 4.5-4.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect height="10" rx="1.8" stroke="currentColor" strokeWidth="1.4" width="14" x="5" y="10" />
      <path d="M8.2 10V7.8a3.8 3.8 0 1 1 7.6 0V10" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M2.8 12s3.3-5.2 9.2-5.2S21.2 12 21.2 12s-3.3 5.2-9.2 5.2S2.8 12 2.8 12Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="2.35" stroke="currentColor" strokeWidth="1.4" />
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
  const classes = styles.socialLink;

  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${label} link pending`}
        className={`${classes} ${styles.socialLinkDisabled}`}
        title={`${label} link belum dikonfigurasi`}
      >
        {children}
      </span>
    );
  }

  return (
    <a aria-label={label} className={classes} href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

export default function HomePage() {
  const { session } = useWallet();
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <main className={`${styles.page} vinss-home relative min-h-screen overflow-hidden`}>
      <div aria-hidden="true" className={styles.ambient} />
      <div aria-hidden="true" className={styles.grid} />

      <div className="relative z-10 mx-auto w-full max-w-[1220px] px-4 pb-10 pt-4 sm:px-7 sm:pb-14 sm:pt-6 lg:px-10">
        <header className={styles.header}>
          <a className={styles.brand} href="#top" aria-label="VINSS home">
            <span className={styles.logoMark}>
              <Image
                alt="VINSS"
                className={styles.logo}
                height={319}
                priority
                src="/vinss-logo.png"
                width={640}
              />
            </span>
            <span className={styles.brandDivider} />
            <span className={styles.brandCopy}>
              Private Deal Room <b>·</b> {NETWORK}
            </span>
          </a>

          <span className={styles.walletShell} data-guide="wallet">
            <WalletConnectButton showCapability={false} />
          </span>

          <span aria-hidden="true" className={styles.headerScan} />
        </header>

        <section className={styles.hero} id="top">
          <div aria-hidden="true" className={styles.heroArt}>
            <span className={styles.orbitOne} />
            <span className={styles.orbitTwo} />
            <span className={styles.silverShardOne} />
            <span className={styles.goldSlash} />
            <span className={styles.silverShardTwo} />
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Private Deal Room on Starknet</p>

            <h1 className={styles.title}>
              Negotiate privately.
              <br />
              <span>Settle with confidence.</span>
            </h1>

            <p className={styles.lead}>
              VINSS keeps conversation, structured Offers, and deal context
              inside a private room—and is built to carry an accepted agreement
              through Rekber, settlement, and verifiable evidence.
            </p>

            <div className={styles.trustCard}>
              <span className={styles.trustIcon}><ShieldIcon /></span>
              <p>Deals do not begin with a transaction. They begin with trust.</p>
            </div>

            <div className={styles.actions}>
              <a className={styles.primaryAction} href="#rooms">
                <span>Open workspace</span>
                <span aria-hidden="true">→</span>
              </a>
              <button
                className={styles.secondaryAction}
                onClick={() => setGuideOpen(true)}
                type="button"
              >
                <span className={styles.playIcon} aria-hidden="true">▶</span>
                <span>How it works</span>
              </button>
            </div>

            {session && (
              <p className={styles.connectedLine}>
                <span aria-hidden="true" />
                Wallet connected · {session.address.slice(0, 7)}…{session.address.slice(-5)}
              </p>
            )}
          </div>
        </section>

        <aside className={styles.privacyCard} data-guide="privacy" id="privacy-model">
          <header className={styles.privacyHeader}>
            <span>Privacy boundary</span>
            <span className={styles.activeState}>
              <i aria-hidden="true" />
              Active
            </span>
          </header>

          <div className={styles.privacyGrid}>
            <div className={styles.privacyCell}>
              <span className={`${styles.privacyIcon} ${styles.hiddenIcon}`}><LockIcon /></span>
              <div>
                <p className={styles.hiddenLabel}>Hidden</p>
                <p>Messages · Offers · Terms · Deal notes · Room secrets</p>
              </div>
            </div>

            <div className={styles.privacyCell}>
              <span className={`${styles.privacyIcon} ${styles.visibleIcon}`}><EyeIcon /></span>
              <div>
                <p className={styles.visibleLabel}>Visible</p>
                <p>Timing · Commitments · Proofs · Optional certificate owner</p>
              </div>
            </div>
          </div>

          <p className={styles.privacyNote}>
            Public-observer privacy is not the same as hiding every piece of blockchain metadata.
          </p>
        </aside>

        <section className={styles.lifecycle} data-guide="workflow" id="workflow">
          <div className={styles.sectionLabel}>
            <p>Deal lifecycle</p>
            <span />
            <small>Conversation → Agreement → Rekber → Settlement → Evidence</small>
          </div>

          <div className={styles.lifecycleGrid}>
            {LIFECYCLE.map((item, index) => (
              <article className={styles.lifecycleItem} key={item.label}>
                <span className={styles.lifecycleNumber}>{item.number}</span>
                <h2>{item.label}</h2>
                <p>{item.title}</p>
                {index < LIFECYCLE.length - 1 && <i aria-hidden="true">→</i>}
              </article>
            ))}
          </div>
        </section>

        <div className={styles.workspaceStage}>
          <span aria-hidden="true" className={styles.workspaceBeam} />
          <span aria-hidden="true" className={styles.workspaceGlow} />
          <HomeWorkspace />
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerScan} aria-hidden="true" />

          <div className={styles.footerTop}>
            <p className={styles.footerTitle}>Documentation</p>
            <nav aria-label="VINSS documentation" className={styles.resourceNav}>
              <a className={styles.resourceLink} href={`${GITHUB_URL}/tree/main/docs/product`} rel="noreferrer" target="_blank">Product docs ↗</a>
              <a className={styles.resourceLink} href={`${GITHUB_URL}/tree/main/docs/technical`} rel="noreferrer" target="_blank">Technical docs ↗</a>
              <a className={styles.resourceLink} href={`${GITHUB_URL}/blob/main/TEST_REPORT.md`} rel="noreferrer" target="_blank">Test report ↗</a>
            </nav>
          </div>

          <div className={styles.footerBottom}>
            <div className={styles.socialRow}>
              <SocialLink href={TELEGRAM_URL} label="VINSS Telegram"><TelegramIcon /></SocialLink>
              <SocialLink href={X_URL} label="VINSS on X"><XIcon /></SocialLink>
              <SocialLink href={GITHUB_URL} label="VINSS GitHub"><GithubIcon /></SocialLink>
            </div>

            <div className={styles.footerMeta}>
              <p>© 2026 VINSS</p>
              <Link className={styles.termsLink} href="/terms">Terms of Service</Link>
            </div>
          </div>
        </footer>
      </div>

      <GuidedDeal onClose={() => setGuideOpen(false)} open={guideOpen} />
    </main>
  );
}
