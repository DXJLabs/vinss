"use client";

import { useEffect, useRef } from "react";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";

interface OfferCardProps {
  entry: ConversationEntry;
  walletAddress?: string;
  busy: boolean;
  actionable: boolean;
  rekberStarted?: boolean;
  onAccept: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onReject: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onCounter: (
    entry: ConversationEntry,
  ) => void;
  onOpenEscrow?: (
    entry: ConversationEntry,
  ) => void;
  onViewProof?: (
    entry: ConversationEntry,
  ) => void;
  onSeen?: (
    entry: ConversationEntry,
  ) => void | Promise<void>;
}

function cardTitle(
  kind: NonNullable<
    ConversationEntry[
      "offerAction"
    ]
  >["kind"],
): string {
  if (kind === "counter") {
    return "Counter";
  }

  if (kind === "accept") {
    return "Agreement";
  }

  if (kind === "reject") {
    return "Response";
  }

  return "Offer";
}

function stateLabel(
  kind: NonNullable<
    ConversationEntry[
      "offerAction"
    ]
  >["kind"],
  ownAction: boolean,
  actionable: boolean,
): string {
  if (kind === "accept") {
    return ownAction
      ? "Accepted by you"
      : "Accepted";
  }

  if (kind === "reject") {
    return ownAction
      ? "Rejected by you"
      : "Rejected";
  }

  if (actionable) {
    return "Response needed";
  }

  return ownAction
    ? "Waiting"
    : "Received";
}

export function OfferCard({
  entry,
  walletAddress,
  busy,
  actionable,
  rekberStarted = false,
  onAccept,
  onReject,
  onCounter,
  onOpenEscrow,
  onSeen,
  onViewProof,
}: OfferCardProps) {
  const action =
    entry.offerAction;

  if (!action) {
    return null;
  }

  const ownAction =
    sameStarknetAddress(
      action.senderAddress,
      walletAddress,
    );

  const offerCardRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      ownAction ||
      !entry.transactionHash ||
      !onSeen
    ) {
      return;
    }

    const node = offerCardRef.current;
    if (!node) return;

    const observer =
      new IntersectionObserver(
        (records) => {
          const visible = records.some(
            (record) =>
              record.isIntersecting &&
              record.intersectionRatio >= 0.6,
          );

          if (!visible) return;

          void onSeen(entry);
          observer.disconnect();
        },
        {
          threshold: [0.6],
        },
      );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [
    ownAction,
    entry.actionLocator,
    entry.transactionHash,
    onSeen,
  ]);

  const accepted =
    action.kind === "accept";

  const rejected =
    action.kind === "reject";

  return (
    <div
      ref={offerCardRef}
      className={
        ownAction
          ? "ml-auto w-[82%] max-w-sm"
          : "mr-auto w-[82%] max-w-sm"
      }
    >
      <div
        className={
          accepted
            ? "border border-signal/25 border-l-2 border-l-signal bg-vault/35 px-3.5 py-3"
            : rejected
              ? "border border-danger/20 border-l-2 border-l-danger/60 bg-vault/35 px-3.5 py-3"
              : "border border-wire border-l-2 border-l-amber-400/60 bg-vault/35 px-3.5 py-3"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-[8px] uppercase tracking-[0.16em] text-amber-300/70">
            {cardTitle(
              action.kind,
            )}
            {" · "}
            {ownAction
              ? "Sent"
              : "Received"}
          </span>

          <div className="flex items-center gap-2">
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

            {ownAction &&
              entry.transactionHash && (
                <span
                  className={
                    entry.readAt
                      ? "text-[10px] text-signal"
                      : "text-[10px] text-paper/35"
                  }
                  title={
                    entry.readAt
                      ? "Read"
                      : "Sent"
                  }
                >
                  {entry.readAt ? "✓✓" : "✓"}
                </span>
              )}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl leading-none text-paper">
              {action.amount}
            </p>

            <p className="mt-1 truncate text-[11px] text-paper/50">
              {action.asset}
            </p>
          </div>

          {action.dealType && (
            <span className="max-w-[46%] truncate border border-wire px-2 py-1 font-display text-[7px] uppercase tracking-[0.12em] text-paper/30">
              {action.dealType === "otc"
                ? "Token Trade"
                : action.dealType === "freelance"
                  ? "Freelance"
                  : action.dealType === "goods"
                    ? "Physical Goods"
                    : action.dealType === "digital_goods"
                      ? "Digital Goods"
                      : action.dealType === "bounty"
                        ? "Bounty"
                        : action.dealType === "nft"
                          ? "NFT Deal"
                          : "Custom Deal"}
            </span>
          )}
        </div>

        <div className="mt-3 border-t border-wire/60 pt-2.5">
          <p className="text-[10px] leading-relaxed text-paper/35">
            Terms{" "}
            <span className="text-paper/55">
              ·{" "}
              {action.paymentTerms ||
                "Not specified"}
            </span>
          </p>

          {action.conditions && (
            <p className="mt-1 text-[10px] leading-relaxed text-paper/30">
              Condition{" "}
              <span className="text-paper/50">
                ·{" "}
                {
                  action.conditions
                }
              </span>
            </p>
          )}
        </div>

        {entry.transactionHash && onViewProof && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-wire/60 pt-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-signal/25 text-[8px] text-signal">
                ✓
              </span>
              <span className="text-[9px] text-paper/35">
                Recorded on Starknet
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onViewProof(entry)
              }
              className="font-display text-[8px] uppercase tracking-[0.14em] text-signal/65 transition hover:text-signal"
            >
              Proof ↗
            </button>
          </div>
        )}

        {actionable && (
          <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-wire/60 pt-3">
            <button
              type="button"
              onClick={() =>
                void onReject(
                  entry,
                )
              }
              disabled={busy}
              className="h-9 border border-danger/25 px-2 font-display text-[8px] uppercase tracking-widest text-danger/75 transition hover:bg-danger/10 disabled:opacity-30"
            >
              Reject
            </button>

            <button
              type="button"
              onClick={() =>
                onCounter(entry)
              }
              disabled={busy}
              className="h-9 border border-wire px-2 font-display text-[8px] uppercase tracking-widest text-paper/50 transition hover:border-amber-400/40 hover:text-amber-300 disabled:opacity-30"
            >
              Counter
            </button>

            <button
              type="button"
              onClick={() =>
                void onAccept(
                  entry,
                )
              }
              disabled={busy}
              className="h-9 border border-signal/35 px-2 font-display text-[8px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
            >
              Accept
            </button>
          </div>
        )}

        {accepted && (
          <div className="mt-3 border-t border-signal/15 pt-2.5">
            <p className="text-[10px] text-signal/65">
              {rekberStarted
                ? "✓ Rekber started from this agreement"
                : "Agreement confirmed · Rekber next"}
            </p>

            {onOpenEscrow && (
              <button
                type="button"
                onClick={() =>
                  onOpenEscrow(entry)
                }
                disabled={busy}
                className="mt-2.5 w-full border border-signal/30 px-3 py-2.5 font-display text-[8px] uppercase tracking-[0.13em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
              >
                {rekberStarted
                  ? "Open Rekber →"
                  : "Start Rekber →"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
