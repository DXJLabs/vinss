"use client";

import { useEffect, useState } from "react";

interface GuideStep {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  truth: string;
  target: "rooms" | "privacy" | "workflow" | "live-tx";
}

const STEPS: GuideStep[] = [
  {
    key: "room",
    label: "ROOM",
    eyebrow: "Start with context",
    title: "One room, one deal.",
    body:
      "Create a room for one agreement, then invite only the counterparty involved. Room labels and secrets stay on this device.",
    truth: "A room is local deal context, not a public Starknet identity.",
    target: "rooms",
  },
  {
    key: "privacy",
    label: "PRIVACY",
    eyebrow: "Know the boundary",
    title: "Private does not mean invisible metadata.",
    body:
      "Messages, Offer terms, and deal notes are encrypted on the client. Transaction timing, commitments, and public proofs remain observable.",
    truth: "VINSS protects deal context from public observers.",
    target: "privacy",
  },
  {
    key: "offer",
    label: "OFFER",
    eyebrow: "Structure the agreement",
    title: "Turn conversation into explicit terms.",
    body:
      "Create, counter, accept, or reject a structured Offer without publishing its business terms as plaintext helper state.",
    truth: "Message and Offer are testnet on-chain verified.",
    target: "workflow",
  },
  {
    key: "rekber",
    label: "REKBER",
    eyebrow: "Coordinate settlement",
    title: "Connect payment to what was agreed.",
    body:
      "An accepted Offer can prepare Escrow Rekber for funding, custody, release, or refund. Every wallet action still requires user approval.",
    truth: "Escrow Rekber is in integration and E2E verification.",
    target: "workflow",
  },
  {
    key: "proof",
    label: "PROOF",
    eyebrow: "Keep verifiable evidence",
    title: "Settlement should end with proof.",
    body:
      "The Live TX ledger exposes public evidence without publishing room IDs or plaintext. Settlement certificates follow after the Rekber path is verified.",
    truth: "Settlement Evidence and NFT Certificates are still pending.",
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
            <p className="mt-2 font-display text-[8px] uppercase tracking-[0.18em] text-paper/30">
              {step.eyebrow}
            </p>
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

          <p className="font-display text-[8px] uppercase tracking-[0.15em] text-paper/38 sm:hidden">
            {STEPS.map((item, index) => (
              <span
                className={index === stepIndex ? "text-signal" : ""}
                key={item.key}
              >
                {index > 0 ? " · " : ""}
                {item.label}
              </span>
            ))}
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
