"use client";

import {
  useEffect,
  useState,
} from "react";
import type {
  ConversationEntry,
} from "@/components/room/conversation/types";
import type {
  OfferTermsInput,
} from "@/hooks/room/useRoomOffers";
import {
  isPositiveNumber,
} from "@/lib/deal-room/offerTemplates";

interface CounterOfferFormProps {
  source: ConversationEntry;
  busy: boolean;
  onSubmit: (
    terms: OfferTermsInput,
  ) => Promise<boolean>;
  onCancel: () => void;
}

export function CounterOfferForm({
  source,
  busy,
  onSubmit,
  onCancel,
}: CounterOfferFormProps) {
  const action = source.offerAction;

  const [amount, setAmount] =
    useState(action?.amount ?? "");
  const [reason, setReason] =
    useState("");
  const [reviewing, setReviewing] =
    useState(false);

  useEffect(() => {
    setAmount(action?.amount ?? "");
    setReason("");
    setReviewing(false);
  }, [
    source.actionLocator,
    action?.amount,
  ]);

  if (!action) {
    return null;
  }

  const currentAmount =
    Number(action.amount);
  const nextAmount =
    Number(amount);

  const amountChanged =
    isPositiveNumber(amount) &&
    Number.isFinite(currentAmount) &&
    Number.isFinite(nextAmount) &&
    nextAmount !== currentAmount;

  const reasonValid =
    reason.trim().length >= 3;

  const ready =
    amountChanged &&
    reasonValid &&
    !busy;

  async function submit() {
    if (!action || !ready) {
      return;
    }

    /*
     * Counter negotiates price only.
     * The parent Offer keeps the asset, business terms and Rekber policy;
     * reason explains the requested price change to the counterparty.
     */
    await onSubmit({
      dealType: action.dealType,

      // Counter negotiates price only.
      // All other deal terms stay inherited
      // from the immutable parent Offer.
      asset: action.asset,
      amount: amount.trim(),
      paymentTerms:
        action.paymentTerms,
      conditions:
        action.conditions,
      expiresAt:
        action.expiresAt,
      reason: reason.trim(),
    });
  }

  return (
    <section className="border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <p className="font-display text-[8px] uppercase tracking-[0.15em] text-amber-300/70">
          Price negotiation
        </p>

        <h3 className="mt-1 text-sm text-paper">
          Counter offer
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-paper/35">
          Change the price and explain why.
          The rest of the deal stays unchanged.
        </p>
      </div>

      {!reviewing ? (
        <div className="space-y-5 p-4">
          <div className="rounded-xl border border-wire/70 bg-black/10 p-4">
            <p className="font-display text-[8px] uppercase tracking-[0.13em] text-paper/30">
              Current offer
            </p>

            <p className="mt-2 text-xl text-paper/75">
              {action.amount}{" "}
              <span className="text-sm text-paper/35">
                {action.asset}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor="counter-amount"
              className="font-display text-[9px] uppercase tracking-widest text-paper/40"
            >
              Your counter
            </label>

            <div className="mt-2 flex border border-wire focus-within:border-signal">
              <input
                id="counter-amount"
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target.value,
                  )
                }
                inputMode="decimal"
                disabled={busy}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-paper outline-none"
              />

              <div className="flex items-center border-l border-wire px-3 text-xs text-signal/70">
                {action.asset}
              </div>
            </div>

            {amount.trim() &&
              !amountChanged && (
                <p className="mt-2 text-[10px] text-amber-300/70">
                  Enter a different price from the current offer.
                </p>
              )}
          </div>

          <div>
            <label
              htmlFor="counter-reason"
              className="font-display text-[9px] uppercase tracking-widest text-paper/40"
            >
              Why are you countering?
            </label>

            <textarea
              id="counter-reason"
              value={reason}
              onChange={(event) =>
                setReason(
                  event.target.value,
                )
              }
              placeholder="Example: My budget is 12 STRK."
              disabled={busy}
              className="mt-2 min-h-24 w-full resize-y border border-wire bg-transparent px-3 py-3 text-sm leading-relaxed text-paper outline-none placeholder:text-paper/25 focus:border-signal"
            />

            <p className="mt-1.5 text-[9px] text-paper/25">
              Required · encrypted between both parties
            </p>
          </div>

          <div className="border border-signal/15 bg-signal/[0.025] p-3">
            <p className="text-[10px] leading-relaxed text-paper/40">
              Deal type, asset, deadline,
              deliverables and Rekber roles
              remain exactly as agreed in
              the previous Offer.
            </p>
          </div>

          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              setReviewing(true)
            }
            className="w-full border border-signal px-4 py-3 font-display text-[10px] uppercase tracking-widest text-signal disabled:opacity-30"
          >
            Review counter →
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-full py-2 font-display text-[9px] uppercase tracking-widest text-paper/30"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="border border-wire bg-black/10 p-4">
            <p className="font-display text-[8px] uppercase tracking-[0.13em] text-paper/30">
              Price change
            </p>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-paper/35 line-through">
                {action.amount} {action.asset}
              </span>

              <span className="text-paper/25">
                →
              </span>

              <span className="text-lg text-signal">
                {amount} {action.asset}
              </span>
            </div>
          </div>

          <div className="border border-wire bg-black/10 p-4">
            <p className="font-display text-[8px] uppercase tracking-[0.13em] text-paper/30">
              Reason
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper/65">
              {reason.trim()}
            </p>
          </div>

          <p className="text-[10px] leading-relaxed text-paper/35">
            Everything else remains unchanged from the previous Offer.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setReviewing(false)
              }
              className="border border-wire px-3 py-3 font-display text-[9px] uppercase tracking-widest text-paper/45"
            >
              Back
            </button>

            <button
              type="button"
              disabled={!ready}
              onClick={() =>
                void submit()
              }
              className="border border-signal px-3 py-3 font-display text-[9px] uppercase tracking-widest text-signal disabled:opacity-30"
            >
              {busy
                ? "Waiting for wallet…"
                : "Send counter"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
