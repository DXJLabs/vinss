"use client";

import { useEffect, useState } from "react";

interface GuideStep {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  truth: string;
  status: "AVAILABLE" | "OPTIONAL" | "TESTNET GATE" | "COMING LATER";
  target: "wallet" | "rooms" | "privacy" | "workflow" | "live-tx";
}

const STEPS: GuideStep[] = [
  {
    key: "wallet",
    label: "WALLET",
    eyebrow: "Step 1 · Identity and approval",
    title: "Connect a STRK20-capable wallet.",
    body:
      "Connect Ready X before creating private on-chain actions. VINSS never receives your private key, and every wallet action still requires your approval.",
    truth: "Wallet connection should persist across room navigation and refresh.",
    status: "AVAILABLE",
    target: "wallet",
  },
  {
    key: "room",
    label: "ROOM",
    eyebrow: "Step 2 · Create or join",
    title: "Open one room for one deal.",
    body:
      "Create a room or open a one-time invitation. The Home and room registry stay on one page; the room workspace opens only when you enter a deal.",
    truth: "A room is local deal context, not a public Starknet identity.",
    status: "AVAILABLE",
    target: "rooms",
  },
  {
    key: "conversation",
    label: "CHAT",
    eyebrow: "Step 3 · Coordinate privately",
    title: "Start a direct conversation.",
    body:
      "Invite one counterparty and exchange encrypted messages. A Group is optional for coordination; Offers and Rekber remain direct two-party actions.",
    truth: "Direct Message is testnet on-chain verified. Group is not a required deal step.",
    status: "AVAILABLE",
    target: "privacy",
  },
  {
    key: "offer",
    label: "OFFER",
    eyebrow: "Step 4 · Structure terms",
    title: "Create a private Offer.",
    body:
      "Choose a deal type, asset, amount, payment terms, conditions and expiry. The business terms are encrypted before the STRK20 action is submitted.",
    truth: "Structured Offer creation is testnet on-chain verified.",
    status: "AVAILABLE",
    target: "workflow",
  },
  {
    key: "response",
    label: "DECIDE",
    eyebrow: "Step 5 · Reach agreement",
    title: "Counter, accept, or reject.",
    body:
      "The counterparty reviews the structured Offer. Counter creates a new immutable version; accept becomes the exact agreement Rekber can reference.",
    truth: "No funds move when an Offer is accepted.",
    status: "AVAILABLE",
    target: "workflow",
  },
  {
    key: "rekber",
    label: "REKBER",
    eyebrow: "Step 6 · Secure payment",
    title: "Payer starts, payee accepts, payer funds.",
    body:
      "Rekber V2 creates separate private keys for payer authorization and payee claim. Both wallets sign the exact private terms before funding can start.",
    truth: "Wallet signatures stay encrypted; token, amount, timeout and commitments remain public in the current custody design.",
    status: "TESTNET GATE",
    target: "workflow",
  },
  {
    key: "settlement",
    label: "SETTLE",
    eyebrow: "Step 7 · Complete or recover",
    title: "Approve release, claim payment—or refund after timeout.",
    body:
      "The payer authorizes release inside encrypted coordination. The payee combines that authorization with its own claim key. Refund is available only to the payer after the agreed boundary.",
    truth: "Do not enable mainnet value until release and refund both pass repeatable two-wallet E2E tests.",
    status: "TESTNET GATE",
    target: "live-tx",
  },
  {
    key: "certificate",
    label: "CERT",
    eyebrow: "Step 8 · Optional public evidence",
    title: "Each party may claim one NFT certificate.",
    body:
      "After a successful release, each wallet claims its own certificate. Claiming publicly links that wallet and role to the custody proof, so it is opt-in and never republishes private chat or Offer terms.",
    truth: "A refunded Rekber produces refund evidence, not a successful-settlement certificate.",
    status: "TESTNET GATE",
    target: "live-tx",
  },
  {
    key: "aftercare",
    label: "NEXT",
    eyebrow: "Step 9 · After settlement",
    title: "Loyalty and feedback come after verified settlement.",
    body:
      "Points must be derived from authenticated, idempotent activity—not browser demo data. Feedback belongs after the settlement result, never before it.",
    truth: "Loyalty redemption and feedback are not enabled in the core mainnet path.",
    status: "COMING LATER",
    target: "live-tx",
  },
];

interface GuidedDealProps {
  open: boolean;
  onClose: () => void;
}

export function GuidedDeal({ open, onClose }: GuidedDealProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  useEffect(() => {
    if (!open) return;

    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || !step) return;

    const target = document.querySelector<HTMLElement>(
      `[data-guide="${step.target}"]`,
    );

    target?.classList.add("vinss-guide-focus");

    const timer = window.setTimeout(() => {
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => {
      window.clearTimeout(timer);
      target?.classList.remove("vinss-guide-focus");
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setStepIndex((value) => Math.min(value + 1, STEPS.length - 1));
      }
      if (event.key === "ArrowLeft") {
        setStepIndex((value) => Math.max(value - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !step) return null;

  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="vinss-guide-shade absolute inset-0 bg-black/38" />

      <section
        aria-labelledby="guided-deal-title"
        aria-live="polite"
        className="vinss-guide-sheet pointer-events-auto absolute inset-x-0 bottom-0 mx-auto w-full border border-wire bg-[#090d10]/[.985] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-28px_90px_rgba(0,0,0,.65)] sm:bottom-6 sm:max-w-2xl sm:p-6"
      >
        <div className="vinss-network-scan pointer-events-none absolute inset-x-0 top-0 h-px" />

        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="font-display text-[8px] uppercase tracking-[0.24em] text-signal">
              VINSS guided deal · {stepIndex + 1} of {STEPS.length}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-display text-[8px] uppercase tracking-[0.18em] text-paper/30">
                {step.eyebrow}
              </p>
              <span className="border border-wire/70 px-1.5 py-0.5 font-display text-[7px] uppercase tracking-[0.12em] text-paper/38">
                {step.status}
              </span>
            </div>
          </div>

          <button
            className="font-display text-[8px] uppercase tracking-[0.15em] text-paper/35 transition hover:text-paper"
            onClick={onClose}
            type="button"
          >
            Not now ×
          </button>
        </div>

        <h2
          className="mt-4 font-display text-xl leading-tight text-paper sm:text-2xl"
          id="guided-deal-title"
        >
          {step.title}
        </h2>
        <p className="mt-3 max-w-xl text-xs leading-5 text-paper/52 sm:text-sm sm:leading-6">
          {step.body}
        </p>
        <p className="mt-3 border-l border-signal/50 pl-3 font-display text-[8px] uppercase leading-4 tracking-[0.12em] text-signal/65">
          {step.truth}
        </p>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-wire/60 pt-4">
          <div className="hidden items-center gap-1.5 sm:flex">
            {STEPS.map((item, index) => (
              <button
                aria-label={`Open ${item.label} step`}
                className={`h-1 transition-all ${
                  index === stepIndex
                    ? "w-8 bg-signal"
                    : index < stepIndex
                      ? "w-4 bg-signal/35"
                      : "w-4 bg-paper/12"
                }`}
                key={item.key}
                onClick={() => setStepIndex(index)}
                type="button"
              />
            ))}
          </div>

          <p className="font-display text-[8px] uppercase tracking-[0.15em] text-signal sm:hidden">
            {step.label} · {stepIndex + 1}/{STEPS.length}
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <button
              className="min-h-10 border border-wire px-3 font-display text-[8px] uppercase tracking-[0.16em] text-paper/45 transition hover:border-paper/40 hover:text-paper disabled:opacity-20"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
              type="button"
            >
              Back
            </button>
            <button
              className="min-h-10 border border-signal bg-signal px-4 font-display text-[8px] uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal"
              onClick={() => {
                if (isLast) {
                  onClose();
                  document
                    .querySelector("#rooms")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }

                setStepIndex((value) => value + 1);
              }}
              type="button"
            >
              {isLast ? "Open workspace →" : "Next →"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
