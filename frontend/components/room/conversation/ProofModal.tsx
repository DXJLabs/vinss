"use client";

import { useEffect } from "react";

interface ProofModalProps {
  kind: "message" | "offer";
  transactionHash: string;
  recordId: string;
  explorerUrl: string;
  onClose: () => void;
}

export function ProofModal({
  kind,
  transactionHash,
  recordId,
  explorerUrl,
  onClose,
}: ProofModalProps) {
  const title =
    kind === "message"
      ? "Message proof"
      : "Offer proof";

  useEffect(() => {
    const closeOnEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.currentTarget ===
          event.target
        ) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-wire bg-vault shadow-2xl"
        style={{
          animation:
            "vinssProofPop 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          transformOrigin: "center",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* One uninterrupted card surface keeps the proof visually inside VINSS. */}
        <div className="bg-transparent p-5">
          <div className="flex items-start justify-between gap-4 bg-transparent">
            <div className="bg-transparent">
              <p className="bg-transparent font-display text-[8px] uppercase tracking-[0.2em] text-signal/55">
                Proof
              </p>

              <h3 className="mt-1.5 bg-transparent text-lg font-normal text-paper/90">
                {title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wire bg-transparent text-xl leading-none text-paper/45 transition hover:border-paper/30 hover:text-paper"
              aria-label="Close proof"
            >
              ×
            </button>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-signal/20 bg-signal/[0.035] p-4">
            <span className="mt-0.5 text-lg text-signal">
              ✓
            </span>

            <div className="bg-transparent">
              <p className="bg-transparent text-sm text-paper/80">
                Saved on Starknet
              </p>

              <p className="mt-1.5 bg-transparent text-[11px] leading-relaxed text-paper/35">
                This encrypted action was recorded while its private content stays hidden on-chain.
              </p>
            </div>
          </div>

          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex h-10 items-center justify-center rounded-lg border border-signal/25 bg-transparent font-display text-[8px] uppercase tracking-[0.16em] text-signal/75 transition hover:border-signal/60 hover:bg-signal/[0.05] hover:text-signal"
          >
            Open in Explorer ↗
          </a>

          <details className="mt-4 border-t border-wire/70 bg-transparent pt-3">
            <summary className="cursor-pointer list-none bg-transparent font-display text-[8px] uppercase tracking-[0.15em] text-paper/25 transition hover:text-paper/50">
              Technical details ↓
            </summary>

            <div className="mt-3 space-y-3 rounded-lg border border-wire/50 bg-transparent p-3 font-mono text-[9px] text-paper/35">
              <div className="bg-transparent">
                <p className="mb-1 bg-transparent font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                  Transaction
                </p>

                <p className="break-all bg-transparent">
                  {transactionHash}
                </p>
              </div>

              <div className="bg-transparent">
                <p className="mb-1 bg-transparent font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                  Record ID
                </p>

                <p className="break-all bg-transparent">
                  0x
                  {recordId.replace(
                    /^0x/,
                    "",
                  )}
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>

      <style>{`
        @keyframes vinssProofPop {
          from {
            opacity: 0;
            transform: scale(0.94);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
