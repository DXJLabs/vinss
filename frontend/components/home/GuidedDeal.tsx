"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

type View =
  | "ready-activate"
  | "ready-shield"
  | "create-room"
  | "message"
  | "invite"
  | "chat"
  | "offer"
  | "rekber"
  | "settlement"
  | "certificate";

interface Step {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  view: View;
}

const STEPS: Step[] = [
  {
    key: "ready-activate",
    label: "READY X",
    eyebrow: "Before VINSS · 1 of 2",
    title: "Activate your private account in Ready X.",
    body:
      "Open Ready X → Shield. If private tokens are not active yet, Ready X asks you to activate the account first.",
    view: "ready-activate",
  },
  {
    key: "ready-shield",
    label: "SHIELD",
    eyebrow: "Before VINSS · 2 of 2",
    title: "Make sure you have shielded STRK.",
    body:
      "Still in Ready X, choose STRK, enter the amount you want to shield, review it, and confirm. Keep enough shielded balance for the full deal flow.",
    view: "ready-shield",
  },
  {
    key: "create-room",
    label: "ROOM",
    eyebrow: "VINSS · Start the deal",
    title: "Create a private room.",
    body:
      "Return to VINSS. Create one room for the deal, then VINSS opens that room.",
    view: "create-room",
  },
  {
    key: "message",
    label: "MESSAGE",
    eyebrow: "VINSS Room · Messages",
    title: "Enter Message.",
    body:
      "A new room starts with no counterparty. Open Message and start a private chat by inviting one person.",
    view: "message",
  },
  {
    key: "invite",
    label: "INVITE",
    eyebrow: "VINSS Room · Private access",
    title: "Invite your counterparty.",
    body:
      "Create the one-time private invite, then copy, share, or show its QR. After the other party joins, return to Messages.",
    view: "invite",
  },
  {
    key: "chat",
    label: "CHAT",
    eyebrow: "VINSS Room · Negotiate",
    title: "Chat privately.",
    body:
      "Open the admitted counterparty and discuss scope, amount, delivery, and expectations in the encrypted conversation.",
    view: "chat",
  },
  {
    key: "offer",
    label: "OFFER",
    eyebrow: "VINSS Room · Agreement",
    title: "Create and agree on the Offer.",
    body:
      "Use Actions → Offer. The other party can Counter, Reject, or Accept. The accepted Offer becomes the agreement Rekber protects.",
    view: "offer",
  },
  {
    key: "rekber",
    label: "REKBER",
    eyebrow: "VINSS Room · Protect payment",
    title: "Secure payment with Rekber.",
    body:
      "Payer prepares the Rekber agreement, Payee approves it, then Payer secures the agreed payment.",
    view: "rekber",
  },
  {
    key: "settlement",
    label: "SETTLE",
    eyebrow: "VINSS Room · After funding",
    title: "Complete, refund, or dispute.",
    body:
      "After payment is secured, the deal follows the appropriate settlement path. These are alternatives, not steps you must perform in sequence.",
    view: "settlement",
  },
  {
    key: "certificate",
    label: "CERT",
    eyebrow: "VINSS · Final proof",
    title: "Claim your Settlement Certificate.",
    body:
      "After an eligible settlement is complete, each party can independently claim its optional Settlement Certificate.",
    view: "certificate",
  },
];

interface GuidedDealProps {
  open: boolean;
  onClose: () => void;
}

function ReadyShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[430px]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-display text-[8px] uppercase tracking-[0.18em] text-paper/30">
            External wallet setup
          </p>
          <p className="mt-1 text-sm font-medium text-paper/75">
            Ready X
          </p>
        </div>

        <span className="rounded-full border border-amber/25 bg-amber/[0.045] px-2.5 py-1 font-display text-[7px] uppercase tracking-[0.13em] text-amber">
          Not in VINSS
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-wire/60 bg-[#101315] shadow-[0_24px_70px_rgba(0,0,0,.35)]">
        <div className="flex items-center justify-between border-b border-wire/45 bg-[#181b1d] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-paper text-[11px] font-bold text-ink">
              X
            </div>

            <div>
              <p className="text-[12px] font-medium text-paper/80">
                Ready X
              </p>
              <p className="text-[8px] text-paper/25">
                Wallet app
              </p>
            </div>
          </div>

          <span className="text-lg text-paper/35">
            ×
          </span>
        </div>

        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-lg text-paper/60">
              ←
            </span>
            <p className="text-[15px] font-semibold text-paper/85">
              Shield
            </p>
            <span className="text-lg text-paper/45">
              ×
            </span>
          </div>

          <p className="mt-4 text-sm font-medium text-paper/75">
            Shield
          </p>

          {children}
        </div>
      </div>
    </div>
  );
}

function RoomHeader() {
  return (
    <header className="mb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vault/55 text-lg text-paper/55 ring-1 ring-wire/60">
          ←
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-[8px] uppercase tracking-[0.17em] text-signal/55">
            Private Deal Room
          </p>

          <p className="mt-0.5 truncate text-[18px] font-medium tracking-tight text-paper">
            Project Aurora
          </p>

          <p className="mt-0.5 truncate font-mono text-[8px] text-paper/18">
            tutorial-room
          </p>
        </div>

        <div className="shrink-0">
          <p className="font-mono text-[8px] text-paper/45">
            0x12A…9B
          </p>

          <p className="mt-1 flex items-center justify-end gap-1 text-[7px] text-signal/65">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            STRK20 · Shielded
          </p>
        </div>
      </div>
    </header>
  );
}

function RoomTabs() {
  return (
    <nav className="mb-3 rounded-2xl bg-vault/35 p-1 ring-1 ring-wire/65">
      <div className="grid grid-cols-4 gap-1">
        <div className="rounded-xl bg-signal/[0.09] px-2 py-2.5 text-center text-[10px] font-medium text-signal ring-1 ring-signal/15">
          Message
        </div>

        <div className="px-2 py-2.5 text-center text-[10px] font-medium text-paper/38">
          Group
        </div>

        <div className="px-2 py-2.5 text-center text-[10px] font-medium text-paper/38">
          Activity
        </div>

        <div className="px-2 py-2.5 text-center text-[10px] font-medium text-paper/38">
          Royalty
        </div>
      </div>
    </nav>
  );
}

function RoomShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <RoomHeader />
      <RoomTabs />
      {children}
    </div>
  );
}

function Bubble({
  own = false,
  children,
}: {
  own?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        own
          ? "flex justify-end"
          : "flex justify-start"
      }
    >
      <div className="max-w-[88%] sm:max-w-[78%]">
        <div
          className={
            own
              ? "rounded-2xl rounded-br-md bg-signal/[0.075] px-3.5 py-2.5 ring-1 ring-signal/22"
              : "rounded-2xl rounded-bl-md bg-vault/45 px-3.5 py-2.5 ring-1 ring-wire/55"
          }
        >
          <p className="text-[14px] leading-relaxed text-paper/88">
            {children}
          </p>

          <div
            className={
              own
                ? "mt-1.5 flex items-center justify-end gap-1.5 text-[9px] text-paper/28"
                : "mt-1.5 flex items-center gap-1.5 text-[9px] text-paper/28"
            }
          >
            <span>
              20:19
            </span>
            <span>
              ·
            </span>
            <span className="text-signal/55">
              ◇
            </span>

            {own && (
              <span className="text-signal/70">
                ✓✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettlementProgress({
  stage,
}: {
  stage: number;
}) {
  const items = [
    "Agreement",
    "Approval",
    "Funded",
    "Review",
    "Proof",
  ];

  return (
    <div className="px-1 pb-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-paper/30">
          Settlement progress
        </p>

        <span className="text-[9px] text-signal/55">
          Private · On-chain
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {items.map(
          (
            label,
            index,
          ) => {
            const done =
              index < stage;
            const active =
              index === stage;

            return (
              <div
                className="min-w-0"
                key={label}
              >
                <div
                  className={
                    done
                      ? "h-1 rounded-full bg-signal"
                      : active
                        ? "h-1 rounded-full bg-signal/45"
                        : "h-1 rounded-full bg-paper/8"
                  }
                />

                <p
                  className={
                    done ||
                    active
                      ? "mt-1.5 truncate text-[8px] font-medium text-paper/70"
                      : "mt-1.5 truncate text-[8px] text-paper/35"
                  }
                >
                  {done
                    ? "✓ "
                    : ""}
                  {label}
                </p>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function Preview({
  view,
}: {
  view: View;
}) {
  if (
    view ===
    "ready-activate"
  ) {
    return (
      <ReadyShell>
        <p className="mt-3 text-[12px] font-medium text-paper/72">
          Shield
        </p>

        <div className="mt-3 rounded-2xl bg-[#1a1e21] p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#30343a] px-3 py-2 text-[12px] font-semibold text-paper/82">
              STRK⌄
            </span>

            <span className="text-2xl font-semibold text-paper">
              70
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-[24px] border border-white/[0.05] bg-[#1d2225] p-4 text-center shadow-[0_16px_38px_rgba(0,0,0,.42)]">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full border-[4px] border-danger text-xl font-bold text-danger">
            !
          </div>

          <p className="mx-auto mt-3 max-w-[250px] text-[18px] font-semibold leading-tight text-paper">
            Please activate your account first
          </p>

          <p className="mx-auto mt-2 max-w-[270px] text-[11px] leading-4 text-paper/48">
            You need to activate your account before you can use private tokens.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-full bg-paper/[0.09] px-3 py-2.5 text-[11px] font-semibold text-paper/58">
              Cancel
            </div>

            <div className="rounded-full bg-paper px-3 py-2.5 text-[11px] font-semibold text-ink">
              Activate
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-signal/15 bg-signal/[0.035] px-3 py-2.5">
          <p className="text-[10px] leading-4 text-paper/48">
            Tap <span className="font-medium text-signal">Activate</span>, finish Ready X setup, then continue to Shield STRK.
          </p>
        </div>
      </ReadyShell>
    );
  }

  if (
    view ===
    "ready-shield"
  ) {
    return (
      <ReadyShell>
        <p className="mt-3 text-[12px] font-medium text-paper/72">
          Shield
        </p>

        <div className="mt-3 rounded-2xl bg-[#1a1e21] p-4">
          <div className="flex items-start justify-between">
            <span className="rounded-full bg-[#30343a] px-3 py-2 text-[12px] font-semibold text-paper/82">
              STRK⌄
            </span>

            <span className="text-3xl font-semibold text-paper">
              100
            </span>
          </div>

          <div className="mt-4 flex items-center gap-4 text-[10px] text-paper/42">
            <span>25%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-paper/[0.07] px-3 py-2.5">
          <p className="text-[10px] leading-4 text-paper/52">
            Enter the amount you want to shield. Keep enough shielded STRK for the deal and its private actions.
          </p>
        </div>

        <div className="mt-4 rounded-full bg-paper px-4 py-3 text-center text-[12px] font-semibold text-ink">
          Review shield
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-signal/65">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          After confirmation, return to VINSS
        </div>
      </ReadyShell>
    );
  }

  if (
    view ===
    "create-room"
  ) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />

            <p className="font-display text-[9px] uppercase tracking-[0.28em] text-signal">
              Local workspace
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-[1.25rem] uppercase tracking-[0.13em] text-paper">
                Private rooms
              </p>

              <p className="mt-2 text-xs text-paper/40">
                One private room for each deal.
              </p>
            </div>

            <div className="rounded-lg bg-signal px-4 py-3 font-display text-[8px] uppercase tracking-[0.16em] text-ink">
              + New room
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-wire/70 bg-vault/20">
          <div className="border-b border-wire/60 px-4 py-3">
            <p className="font-display text-[8px] uppercase tracking-[0.2em] text-paper/48">
              Create room
            </p>
          </div>

          <div className="p-4">
            <label className="block">
              <span className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/30">
                Room label
              </span>

              <div className="mt-2 rounded-lg border border-signal/30 bg-black/10 px-3 py-3 text-sm text-paper/75">
                Project Aurora
              </div>
            </label>

            <button
              className="mt-4 w-full rounded-lg bg-signal px-4 py-3.5 text-sm font-medium text-ink"
              type="button"
            >
              Create room →
            </button>

            <p className="mt-3 text-center text-[9px] text-paper/25">
              Room label and secret stay on this device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    view === "message"
  ) {
    return (
      <RoomShell>
        <section>
          <div className="rounded-t-2xl border border-b-0 border-wire/70 bg-vault/22">
            <div className="px-4 py-3">
              <p className="text-[13px] font-medium text-paper/72">
                Private messages
              </p>

              <p className="mt-1 text-[10px] text-paper/30">
                E2E protected
              </p>
            </div>
          </div>

          <div className="flex min-h-[245px] flex-col items-center justify-center rounded-b-2xl border border-t-0 border-wire/70 bg-black/[0.08] px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal/[0.07] text-xl text-signal/80 ring-1 ring-signal/15">
              ◇
            </div>

            <p className="mt-4 text-base font-medium text-paper/75">
              Start a private chat
            </p>

            <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-paper/35">
              Invite one person to begin an encrypted 1-to-1 conversation.
            </p>

            <div className="mt-5 rounded-xl bg-signal px-4 py-2.5 text-[11px] font-semibold text-ink">
              Invite person
            </div>
          </div>
        </section>
      </RoomShell>
    );
  }

  if (
    view === "invite"
  ) {
    return (
      <RoomShell>
        <article className="rounded-2xl border border-wire/55 bg-vault/15 p-3.5">
          <div>
            <p className="font-display text-[8px] uppercase tracking-[0.16em] text-signal/70">
              Private Chat invite
            </p>

            <p className="mt-2 text-xs leading-5 text-paper/40">
              Create one private, one-time invitation for your counterparty.
            </p>
          </div>

          <div className="mt-4 border border-signal/15 bg-signal/[0.025] p-3">
            <div className="flex items-center justify-between">
              <p className="font-display text-[8px] uppercase tracking-[0.15em] text-paper/30">
                One-time link
              </p>

              <span className="font-display text-[8px] uppercase tracking-widest text-signal/65">
                ✓ Ready
              </span>
            </div>

            <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] text-paper/45">
              vinss-nu.vercel.app/invite/••••••#k=••••
            </p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="h-10 bg-signal px-3 font-display text-[9px] uppercase tracking-[0.14em] text-ink"
              type="button"
            >
              Copy link
            </button>

            <button
              className="h-10 border border-wire px-3 font-display text-[9px] uppercase tracking-[0.14em] text-paper/50"
              type="button"
            >
              Share
            </button>
          </div>

          <button
            className="mt-2 h-10 w-full border border-signal/30 font-display text-[8px] uppercase tracking-[0.12em] text-signal"
            type="button"
          >
            Show / Share QR
          </button>

          <div className="mt-4 flex items-center gap-2 border border-signal/20 bg-signal/[0.035] px-3 py-2.5 text-xs text-signal/70">
            <span>
              ✓
            </span>
            <span>
              Private Chat invite accepted.
            </span>
          </div>
        </article>
      </RoomShell>
    );
  }

  if (
    view === "chat"
  ) {
    return (
      <RoomShell>
        <div className="overflow-hidden rounded-2xl border border-wire/70 bg-black/[0.08]">
          <div className="border-b border-wire/55 px-4 py-3">
            <p className="text-sm font-medium text-paper/72">
              Bob
            </p>

            <p className="mt-1 text-[9px] text-signal/55">
              Private · E2E protected
            </p>
          </div>

          <div className="space-y-3 px-3 py-4">
            <Bubble>
              Can you deliver the project tomorrow?
            </Bubble>

            <Bubble own>
              Yes. Final delivery after review.
            </Bubble>

            <Bubble>
              Great. Send the Offer for 10 STRK.
            </Bubble>
          </div>

          <div className="border-x border-t border-wire/60 bg-[#070c10]/95 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-signal/70" />
              <span className="font-display text-[8px] uppercase tracking-[0.16em] text-paper/36">
                Actions
              </span>
            </div>

            <div className="mt-2 flex gap-2 overflow-hidden">
              <div className="rounded-xl border border-wire/60 bg-vault/35 px-3 py-2.5 text-[10px] text-paper/62">
                File
              </div>

              <div className="rounded-xl border border-wire/60 bg-vault/35 px-3 py-2.5 text-[10px] text-paper/62">
                Offer
              </div>

              <div className="rounded-xl border border-wire/60 bg-vault/35 px-3 py-2.5 text-[10px] text-paper/62">
                Escrow
              </div>
            </div>
          </div>

          <div className="border border-wire/70 p-3">
            <div className="rounded-xl bg-vault/35 px-3 py-3 text-[13px] text-paper/25">
              Write a private message…
            </div>
          </div>
        </div>
      </RoomShell>
    );
  }

  if (
    view === "offer"
  ) {
    return (
      <RoomShell>
        <div className="space-y-3 rounded-2xl border border-wire/70 bg-black/[0.08] p-3">
          <Bubble>
            Here are the final terms.
          </Bubble>

          <div className="mr-auto w-[88%] max-w-sm">
            <div className="border border-wire border-l-2 border-l-amber-400/60 bg-vault/35 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-[8px] uppercase tracking-[0.16em] text-amber-300/70">
                  Offer · Received
                </span>

                <span className="text-[9px] text-paper/30">
                  Response needed
                </span>
              </div>

              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-paper/72">
                    Project Aurora
                  </p>

                  <p className="mt-1.5 text-[16px] font-medium text-paper/82">
                    10 STRK
                  </p>
                </div>

                <span className="rounded-md border border-wire/65 px-2 py-1 font-display text-[7px] uppercase tracking-[0.12em] text-paper/32">
                  Freelance
                </span>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-wire/55 pt-3 text-[10px]">
                <p>
                  <span className="text-paper/27">
                    Deadline
                  </span>
                  <span className="px-1.5 text-paper/18">
                    ·
                  </span>
                  <span className="text-paper/55">
                    1 day
                  </span>
                </p>

                <p>
                  <span className="text-paper/27">
                    Deliverables
                  </span>
                  <span className="px-1.5 text-paper/18">
                    ·
                  </span>
                  <span className="text-paper/55">
                    Final project delivery
                  </span>
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-wire/60 pt-3">
                <div className="rounded-xl border border-wire py-2.5 text-center text-[10px] text-paper/40">
                  Reject
                </div>

                <div className="rounded-xl border border-wire py-2.5 text-center text-[10px] text-paper/55">
                  Counter
                </div>

                <div className="rounded-xl bg-signal py-2.5 text-center text-[10px] font-medium text-ink">
                  Accept
                </div>
              </div>
            </div>
          </div>

          <p className="px-1 text-[9px] leading-relaxed text-paper/27">
            Accepting the Offer agrees the terms. Funds do not move yet.
          </p>
        </div>
      </RoomShell>
    );
  }

  if (
    view === "rekber"
  ) {
    return (
      <RoomShell>
        <div className="overflow-hidden rounded-2xl border border-wire/60 bg-black/[0.06] p-3">
          <SettlementProgress
            stage={2}
          />

          <div className="space-y-3 px-1 pt-2">
            <div className="rounded-xl bg-signal/[0.045] p-4 ring-1 ring-signal/15">
              <p className="text-[9px] uppercase tracking-[0.12em] text-signal/70">
                Rekber agreement
              </p>

              <p className="mt-1 text-sm font-medium text-paper/80">
                Payer prepared ✓
              </p>

              <p className="mt-1 text-xs text-paper/40">
                Payee approved ✓
              </p>
            </div>

            <div className="rounded-xl bg-paper/[0.025] p-4">
              <div className="flex justify-between gap-3">
                <span className="text-[10px] text-paper/30">
                  Agreed amount
                </span>

                <span className="text-sm font-medium text-paper/75">
                  10 STRK
                </span>
              </div>
            </div>

            <div className="rounded-lg border-l-2 border-amber/45 bg-amber/[0.025] px-3 py-3">
              <p className="text-[9px] uppercase tracking-[0.13em] text-amber/75">
                Payer
              </p>

              <p className="mt-1 text-xs leading-relaxed text-paper/38">
                Both wallet approvals match. Payment can now be secured.
              </p>
            </div>

            <button
              className="w-full rounded-xl bg-amber px-4 py-3.5 text-sm font-medium text-ink"
              type="button"
            >
              Secure payment →
            </button>
          </div>
        </div>
      </RoomShell>
    );
  }

  if (
    view === "settlement"
  ) {
    return (
      <RoomShell>
        <div className="overflow-hidden rounded-2xl border border-wire/60 bg-black/[0.06] p-3">
          <SettlementProgress
            stage={3}
          />

          <div className="rounded-xl bg-signal/[0.065] p-4 ring-1 ring-signal/15">
            <p className="text-[9px] uppercase tracking-[0.13em] text-signal">
              Payment secured
            </p>

            <p className="mt-2 text-3xl font-semibold text-paper">
              10
              <span className="ml-2 text-base text-paper/45">
                STRK
              </span>
            </p>
          </div>

          <p className="mt-4 font-display text-[8px] uppercase tracking-[0.15em] text-paper/28">
            Choose the path that matches the deal
          </p>

          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-signal/18 bg-signal/[0.025] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-paper/72">
                    Normal completion
                  </p>

                  <p className="mt-1 text-[9px] leading-relaxed text-paper/34">
                    Work submitted → reviewed → release available.
                  </p>
                </div>

                <span className="text-[8px] uppercase text-signal/65">
                  NORMAL
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-signal px-3 py-2.5 text-center text-[10px] font-medium text-ink">
                Payee · Claim payment →
              </div>
            </div>

            <div className="rounded-xl border border-wire/55 bg-paper/[0.018] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-paper/65">
                    Refund
                  </p>

                  <p className="mt-1 text-[9px] leading-relaxed text-paper/32">
                    If the valid refund condition is available, the Payer can recover the eligible payment.
                  </p>
                </div>

                <span className="text-[8px] uppercase text-paper/30">
                  REFUND
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-wire px-3 py-2.5 text-center text-[10px] text-paper/55">
                Refund →
              </div>
            </div>

            <div className="rounded-xl border border-amber/25 bg-amber/[0.035] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-paper/70">
                    Dispute
                  </p>

                  <p className="mt-1 text-[9px] leading-relaxed text-paper/34">
                    Something wrong? Open dispute → both sides confirm → resolution.
                  </p>
                </div>

                <span className="text-[8px] uppercase text-amber">
                  DISPUTE
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-paper/[0.025] p-3">
                <div>
                  <p className="text-[8px] uppercase text-paper/25">
                    Payer
                  </p>
                  <p className="mt-1 text-sm font-medium text-paper/75">
                    50%
                  </p>
                </div>

                <div>
                  <p className="text-[8px] uppercase text-paper/25">
                    Payee
                  </p>
                  <p className="mt-1 text-sm font-medium text-paper/75">
                    50%
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-signal/35 px-3 py-2.5 text-center text-[10px] font-medium text-signal">
                Claim my share →
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[8px] leading-relaxed text-paper/22">
            Normal, Refund, and Dispute are alternative settlement paths.
          </p>
        </div>
      </RoomShell>
    );
  }

  return (
    <RoomShell>
      <div className="overflow-hidden rounded-2xl border border-wire/60 bg-black/[0.06] p-3">
        <SettlementProgress
          stage={4}
        />

        <div className="rounded-xl bg-signal/[0.05] p-4 ring-1 ring-signal/15">
          <p className="text-[9px] uppercase tracking-[0.13em] text-signal">
            Settlement complete
          </p>

          <p className="mt-1 text-sm font-medium text-paper/75">
            Eligible for certificate ✓
          </p>
        </div>

        <div className="mt-3 rounded-xl bg-paper/[0.025] p-4 ring-1 ring-wire/55">
          <p className="font-display text-[8px] uppercase tracking-[0.18em] text-signal/65">
            VINSS
          </p>

          <p className="mt-7 font-display text-[8px] uppercase tracking-[0.18em] text-paper/30">
            Settlement Certificate
          </p>

          <p className="mt-2 text-lg font-medium text-paper/80">
            Project Aurora
          </p>

          <div className="mt-5 flex justify-between border-t border-wire/45 pt-3 text-[9px]">
            <span className="text-paper/30">
              Starknet Mainnet
            </span>

            <span className="text-signal">
              Claimable
            </span>
          </div>
        </div>

        <button
          className="mt-3 w-full rounded-xl bg-signal px-4 py-3.5 text-sm font-medium text-ink"
          type="button"
        >
          Claim Settlement Certificate →
        </button>

        <p className="mt-3 text-center text-[9px] leading-relaxed text-paper/25">
          Optional public settlement proof. Each eligible party claims independently.
        </p>
      </div>
    </RoomShell>
  );
}

export function GuidedDeal({
  open,
  onClose,
}: GuidedDealProps) {
  const [
    stepIndex,
    setStepIndex,
  ] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStepIndex(0);

    const previous =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
      }

      if (
        event.key ===
        "ArrowRight"
      ) {
        setStepIndex(
          (value) =>
            Math.min(
              value + 1,
              STEPS.length - 1,
            ),
        );
      }

      if (
        event.key ===
        "ArrowLeft"
      ) {
        setStepIndex(
          (value) =>
            Math.max(
              value - 1,
              0,
            ),
        );
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
  }, [
    open,
    onClose,
  ]);

  if (!open) {
    return null;
  }

  const step =
    STEPS[stepIndex]!;

  const isLast =
    stepIndex ===
    STEPS.length - 1;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex h-[100dvh] flex-col overflow-hidden bg-[#070a0c]/[.99]"
      role="dialog"
    >
      <header className="shrink-0 border-b border-wire/45 bg-[#070a0c] px-4 pb-3 pt-[max(.8rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[8px] uppercase tracking-[0.18em] text-signal/65">
              VINSS · How it works
            </p>

            <p className="mt-1 font-display text-[7px] uppercase tracking-[0.14em] text-paper/25">
              {step.eyebrow}
            </p>

            <h2 className="mt-1.5 text-[17px] font-medium leading-tight text-paper">
              {step.title}
            </h2>

            <p className="mt-1.5 max-w-xl text-[10px] leading-4 text-paper/38">
              {step.body}
            </p>
          </div>

          <button
            className="shrink-0 rounded-xl bg-vault/55 px-3 py-2 text-[10px] text-paper/45 ring-1 ring-wire/60"
            onClick={onClose}
            type="button"
          >
            Close ×
          </button>
        </div>

        <div className="mx-auto mt-3 grid max-w-3xl grid-cols-10 gap-1">
          {STEPS.map(
            (
              item,
              index,
            ) => (
              <button
                aria-label={`Open ${item.label}`}
                className={
                  index <
                  stepIndex
                    ? "h-1 rounded-full bg-signal"
                    : index ===
                        stepIndex
                      ? "h-1 rounded-full bg-signal/45"
                      : "h-1 rounded-full bg-paper/8"
                }
                key={item.key}
                onClick={() =>
                  setStepIndex(
                    index,
                  )
                }
                type="button"
              />
            ),
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
        <Preview
          view={step.view}
        />
      </main>

      <footer className="shrink-0 border-t border-wire/45 bg-[#070a0c] px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            className="min-h-11 rounded-xl bg-vault/55 px-4 text-xs font-medium text-paper/45 ring-1 ring-wire/60 disabled:opacity-20"
            disabled={
              stepIndex === 0
            }
            onClick={() =>
              setStepIndex(
                (value) =>
                  Math.max(
                    value - 1,
                    0,
                  ),
              )
            }
            type="button"
          >
            ← Back
          </button>

          <div className="text-center">
            <p className="font-display text-[8px] uppercase tracking-[0.14em] text-signal/60">
              {step.label}
            </p>

            <p className="mt-0.5 text-[8px] text-paper/22">
              {stepIndex + 1}/
              {STEPS.length}
            </p>
          </div>

          <button
            className="min-h-11 rounded-xl bg-signal px-4 text-xs font-medium text-ink"
            onClick={() => {
              if (isLast) {
                onClose();

                window.setTimeout(
                  () => {
                    document
                      .querySelector(
                        "#rooms",
                      )
                      ?.scrollIntoView({
                        behavior:
                          "smooth",
                        block:
                          "start",
                      });
                  },
                  60,
                );

                return;
              }

              setStepIndex(
                (value) =>
                  value + 1,
              );
            }}
            type="button"
          >
            {isLast
              ? "Start VINSS →"
              : "Next →"}
          </button>
        </div>
      </footer>
    </div>
  );
}
