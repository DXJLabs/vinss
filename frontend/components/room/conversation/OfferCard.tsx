"use client";

import type { ConversationEntry } from "@/components/room/conversation/types";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";

interface OfferCardProps {
  entry: ConversationEntry;
  walletAddress?: string;
  busy: boolean;
  actionable: boolean;
  onAccept: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onReject: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onCounter: (
    entry: ConversationEntry,
  ) => void;
}

function cardTitle(
  kind: NonNullable<
    ConversationEntry["offerAction"]
  >["kind"],
): string {
  if (kind === "counter") return "Counter";
  return "Offer";
}

function stateLabel(
  kind: NonNullable<
    ConversationEntry["offerAction"]
  >["kind"],
  ownAction: boolean,
  actionable: boolean,
): string {
  if (kind === "accept") {
    return ownAction
      ? "Accepted by you"
      : "Accepted by counterparty";
  }

  if (kind === "reject") {
    return ownAction
      ? "Rejected by you"
      : "Rejected by counterparty";
  }

  if (actionable) {
    return "Your response needed";
  }

  return ownAction
    ? "Waiting for response"
    : "Waiting";
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
  const action = entry.offerAction;

  if (!action) return null;

  const ownAction =
    sameStarknetAddress(
      action.senderAddress,
      walletAddress,
    );

  const accepted =
    action.kind === "accept";

  const rejected =
    action.kind === "reject";

  return (
    <div
      className={
        ownAction
          ? "ml-auto max-w-[86%]"
          : "mr-auto max-w-[86%]"
      }
    >
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-[9px] uppercase tracking-[0.16em] text-amber-300/75">
            {cardTitle(action.kind)}
            {" · "}
            {ownAction
              ? "Sent"
              : "Received"}
          </span>

          <span
            className={
              accepted
                ? "text-[9px] text-signal/70"
                : rejected
                  ? "text-[9px] text-danger/70"
                  : "text-[9px] text-paper/30"
            }
          >
            {stateLabel(
              action.kind,
              ownAction,
              actionable,
            )}
          </span>
        </div>

        <div className="mt-2.5">
          <p className="text-lg leading-none text-paper">
            {action.amount}{" "}
            <span className="text-sm text-paper/55">
              {action.asset}
            </span>
          </p>

          <p className="mt-2 text-[11px] leading-relaxed text-paper/45">
            Payment:{" "}
            <span className="text-paper/65">
              {action.paymentTerms ||
                "Not specified"}
            </span>
          </p>

          {action.conditions && (
            <p className="mt-1 text-[11px] leading-relaxed text-paper/35">
              Condition:{" "}
              <span className="text-paper/55">
                {action.conditions}
              </span>
            </p>
          )}
        </div>

        {actionable && (
          <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-wire/60 pt-3">
            <button
              type="button"
              onClick={() =>
                void onReject(entry)
              }
              disabled={busy}
              className="h-9 border border-danger/30 px-2 font-display text-[8px] uppercase tracking-widest text-danger/80 transition hover:bg-danger/10 disabled:opacity-30"
            >
              Reject
            </button>

            <button
              type="button"
              onClick={() =>
                onCounter(entry)
              }
              disabled={busy}
              className="h-9 border border-wire px-2 font-display text-[8px] uppercase tracking-widest text-paper/55 transition hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-30"
            >
              Counter
            </button>

            <button
              type="button"
              onClick={() =>
                void onAccept(entry)
              }
              disabled={busy}
              className="h-9 border border-signal/40 px-2 font-display text-[8px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
            >
              Accept
            </button>
          </div>
        )}

        {accepted && (
          <p className="mt-2.5 border-t border-signal/15 pt-2.5 text-[10px] text-signal/65">
            Agreement confirmed. Escrow is the next step.
          </p>
        )}
      </div>
    </div>
  );
}
