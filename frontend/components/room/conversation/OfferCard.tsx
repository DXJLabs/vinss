"use client";

import type { ConversationEntry } from "./ConversationPanel";

interface OfferCardProps {
  entry: ConversationEntry;
  walletAddress?: string;
  busy: boolean;
  actionable: boolean;
  onAccept: (entry: ConversationEntry) => Promise<boolean>;
  onReject: (entry: ConversationEntry) => Promise<boolean>;
  onCounter: (entry: ConversationEntry) => void;
}

// Keep lifecycle labels conversational instead of exposing internal action names.
function actionLabel(
  kind: NonNullable<ConversationEntry["offerAction"]>["kind"],
  ownAction: boolean,
): string {
  if (kind === "create") {
    return ownAction
      ? "You sent an offer"
      : "Counterparty sent an offer";
  }

  if (kind === "counter") {
    return ownAction
      ? "You sent a counter"
      : "Counterparty sent a counter";
  }

  if (kind === "accept") {
    return ownAction
      ? "You accepted the offer"
      : "Counterparty accepted the offer";
  }

  if (kind === "reject") {
    return ownAction
      ? "You rejected the offer"
      : "Counterparty rejected the offer";
  }

  return ownAction
    ? "You updated the deal"
    : "Counterparty updated the deal";
}

export function OfferCard({
  entry,
  walletAddress,
  busy,
  actionable,
  onAccept,
  onReject,
  onCounter,
}: OfferCardProps) {
  // Offer entries without decrypted payload metadata are not rendered.
  const action = entry.offerAction;

  if (!action) return null;

  // Determine card direction from encrypted local participant metadata.
  const ownAction =
    Boolean(walletAddress) &&
    action.senderAddress?.toLowerCase() ===
      walletAddress?.toLowerCase();

  // Accepted and rejected actions are terminal for the parent negotiation branch.
  const accepted = action.kind === "accept";
  const rejected = action.kind === "reject";

  return (
    <div className="mx-auto max-w-[92%] rounded-lg border border-amber-500/25 bg-amber-500/[0.045] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-[9px] uppercase tracking-[0.16em] text-amber-400/75">
            Offer
          </p>

          <h4 className="mt-1 text-sm text-paper/80">
            {actionLabel(action.kind, ownAction)}
          </h4>
        </div>

        {accepted ? (
          <span className="border border-signal/30 bg-signal/5 px-2 py-1 font-display text-[8px] uppercase tracking-widest text-signal">
            Accepted
          </span>
        ) : rejected ? (
          <span className="border border-danger/30 bg-danger/5 px-2 py-1 font-display text-[8px] uppercase tracking-widest text-danger">
            Rejected
          </span>
        ) : null}
      </div>

      {/* All displayed terms were decrypted locally from pairwise ciphertext. */}
      <div className="mt-4 border border-wire/70 bg-vault/35 p-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[10px] uppercase tracking-wider text-paper/30">
            Amount
          </span>

          <span className="text-base text-paper">
            {action.amount} {action.asset}
          </span>
        </div>

        <div className="mt-2 flex items-start justify-between gap-4">
          <span className="text-[10px] uppercase tracking-wider text-paper/30">
            Terms
          </span>

          <span className="max-w-[65%] text-right text-xs leading-relaxed text-paper/55">
            {action.paymentTerms || "Not specified"}
          </span>
        </div>
      </div>

      {/* Only the current encrypted recipient of the latest terms can act. */}
      {actionable && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => void onReject(entry)}
            disabled={busy}
            className="border border-danger/30 px-2 py-2.5 font-display text-[9px] uppercase tracking-widest text-danger/80 transition hover:border-danger hover:bg-danger/10 disabled:opacity-30"
          >
            Reject
          </button>

          <button
            type="button"
            onClick={() => onCounter(entry)}
            disabled={busy}
            className="border border-wire px-2 py-2.5 font-display text-[9px] uppercase tracking-widest text-paper/55 transition hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-30"
          >
            Counter
          </button>

          <button
            type="button"
            onClick={() => void onAccept(entry)}
            disabled={busy}
            className="border border-signal/40 px-2 py-2.5 font-display text-[9px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
          >
            Accept
          </button>
        </div>
      )}

      {accepted && (
        <p className="mt-3 text-[10px] leading-relaxed text-signal/60">
          Agreement recorded. Private escrow connection is the next step.
        </p>
      )}
    </div>
  );
}
