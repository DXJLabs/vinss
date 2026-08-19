"use client";

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        // Clicking outside the card closes the proof without changing chat state.
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-wire bg-vault p-5 shadow-2xl"
        style={{
          animation:
            "vinssProofPop 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          transformOrigin: "center",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[9px] uppercase tracking-[0.18em] text-signal/70">
              Proof
            </p>
            <h3 className="mt-1 text-base text-paper">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-wire text-lg text-paper/45 transition hover:border-paper/30 hover:text-paper"
            aria-label="Close proof"
          >
            ×
          </button>
        </div>

        <div className="mt-5 border border-signal/20 bg-signal/[0.035] p-4">
          <div className="flex items-center gap-2">
            <span className="text-signal">✓</span>
            <span className="text-sm text-paper/80">
              Saved on Starknet
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-paper/40">
            This confirms the encrypted action was recorded. Its private
            content is not shown publicly on-chain.
          </p>
        </div>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex h-11 items-center justify-center border border-signal/35 font-display text-[9px] uppercase tracking-[0.16em] text-signal transition hover:bg-signal hover:text-ink"
        >
          Open in Explorer ↗
        </a>

        <details className="mt-4 border-t border-wire pt-3">
          <summary className="cursor-pointer list-none font-display text-[8px] uppercase tracking-[0.15em] text-paper/25 transition hover:text-paper/50">
            Technical details ↓
          </summary>

          <div className="mt-3 space-y-3 font-mono text-[9px] text-paper/35">
            <div>
              <p className="mb-1 font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                Transaction
              </p>
              <p className="break-all">
                {transactionHash}
              </p>
            </div>

            <div>
              <p className="mb-1 font-display text-[7px] uppercase tracking-[0.13em] text-paper/20">
                Record ID
              </p>
              <p className="break-all">
                0x{recordId.replace(/^0x/, "")}
              </p>
            </div>
          </div>
        </details>
      </div>

      <style>{`
        @keyframes vinssProofPop {
          from {
            opacity: 0;
            transform: scale(0.92);
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
