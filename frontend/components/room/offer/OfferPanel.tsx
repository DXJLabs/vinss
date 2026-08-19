"use client";

import { useEffect, useMemo, useState } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import type { AgentProposal } from "@/lib/agent";
import type { DealType } from "@/types/deal-room";
import type { RoomParticipant } from "@/lib/privacy/participantKeys";
import type { ConversationEntry } from "@/components/room/conversation/ConversationPanel";
import type { OfferTermsInput } from "@/hooks/room/useRoomOffers";

interface OfferPanelProps {
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  messageTarget: string;
  participants: RoomParticipant[];
  counterSource: ConversationEntry | null;
  busy: boolean;
  agentDraft?: Extract<
    AgentProposal,
    { type: "draft_offer" | "draft_counter_offer" }
  > | null;
  onCreate: (
    peerAddress: string,
    terms: OfferTermsInput,
  ) => Promise<boolean>;
  onCounter: (
    source: ConversationEntry,
    terms: OfferTermsInput,
  ) => Promise<boolean>;
  onCancelCounter: () => void;
  onSubmitted: () => void;
}

// Render a compact participant label until optional username resolution exists.
function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export function OfferPanel({
  session,
  channelKey,
  messageTarget,
  participants,
  counterSource,
  busy,
  agentDraft,
  onCreate,
  onCounter,
  onCancelCounter,
  onSubmitted,
}: OfferPanelProps) {
  // The form owns only draft UI state; encrypted lifecycle state lives in useRoomOffers.
  const [dealType, setDealType] = useState<DealType>("otc");
  const [asset, setAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Counter mode is anchored to one immutable Offer action from direct chat.
  const counterAction = counterSource?.offerAction;

  // A new Offer uses the participant currently selected in Chat.
  const selectedParticipant = useMemo(
    () =>
      messageTarget === "group"
        ? null
        : participants.find(
            (participant) =>
              participant.address.toLowerCase() ===
              messageTarget.toLowerCase(),
          ) ?? null,
    [messageTarget, participants],
  );

  // A counter always returns to the sender of the selected parent action.
  const targetAddress =
    counterAction?.senderAddress ??
    selectedParticipant?.address ??
    null;

  useEffect(() => {
    // Counter mode starts from the exact encrypted terms currently on screen.
    if (counterAction) {
      setDealType(counterAction.dealType ?? "otc");
      setAsset(counterAction.asset);
      setAmount(counterAction.amount);
      setTerms(counterAction.paymentTerms);
      setReviewing(false);
      return;
    }

    // Agent proposals only prefill editable draft fields; they never execute a wallet action.
    if (agentDraft) {
      setAsset(agentDraft.payload.asset);
      setAmount(agentDraft.payload.amount);
      setTerms(agentDraft.payload.paymentTerms);
      setReviewing(false);
    }
  }, [counterAction, agentDraft]);

  // Changing the selected direct chat invalidates the previous review screen.
  useEffect(() => {
    setReviewing(false);
  }, [messageTarget]);

  const canPrepare =
    Boolean(session) &&
    Boolean(channelKey) &&
    Boolean(targetAddress) &&
    !busy &&
    Boolean(asset.trim()) &&
    Boolean(amount.trim());

  // Freeze normalized terms at the review/submit boundary.
  function currentTerms(): OfferTermsInput {
    return {
      dealType,
      asset: asset.trim(),
      amount: amount.trim(),
      paymentTerms: terms.trim() || "Not specified",
    };
  }

  async function handleSubmit() {
    if (!targetAddress || !canPrepare) return;

    // Counter and create are distinct immutable lifecycle actions.
    const ok =
      counterSource && counterAction
        ? await onCounter(
            counterSource,
            currentTerms(),
          )
        : await onCreate(
            targetAddress,
            currentTerms(),
          );

    if (!ok) return;

    // Clear only after the wallet-backed action was confirmed.
    setAsset("");
    setAmount("");
    setTerms("");
    setReviewing(false);

    // Parent page returns to Chat so the new interactive card is immediately visible.
    onSubmitted();
  }

  return (
    <section className="border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs uppercase tracking-widest text-signal">
              Offer
            </p>

            <h3 className="mt-1 text-sm text-paper">
              {counterSource
                ? "Counter this offer"
                : "Create an offer"}
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              {targetAddress
                ? `Private deal with ${shortAddress(targetAddress)}`
                : "Choose a participant in Chat before creating an offer."}
            </p>
          </div>

          <span className="shrink-0 text-[10px] uppercase tracking-wider text-paper/30">
            {reviewing ? "Step 2 · Review" : "Step 1 · Terms"}
          </span>
        </div>
      </div>

      {!targetAddress ? (
        <div className="p-4">
          <div className="border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm text-paper/70">
              Select someone in Chat first.
            </p>

            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              Offers are direct and never appear in the Group conversation.
            </p>
          </div>
        </div>
      ) : reviewing ? (
        <div className="space-y-4 p-4">
          {/* This review screen is local only; no wallet action has happened yet. */}
          <div className="border border-wire bg-vault/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-display text-[9px] uppercase tracking-widest text-paper/35">
                Counterparty
              </span>

              <span
                className="font-mono text-xs text-paper/65"
                title={targetAddress}
              >
                {shortAddress(targetAddress)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-display text-[9px] uppercase tracking-widest text-paper/35">
                Amount
              </span>

              <span className="text-base text-paper">
                {amount.trim()} {asset.trim()}
              </span>
            </div>

            <div className="mt-3 flex items-start justify-between gap-4">
              <span className="font-display text-[9px] uppercase tracking-widest text-paper/35">
                Terms
              </span>

              <span className="max-w-[65%] text-right text-xs leading-relaxed text-paper/55">
                {terms.trim() || "Not specified"}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-display text-[9px] uppercase tracking-widest text-paper/35">
                Private action fee
              </span>

              <span className="text-xs text-paper/55">
                1 STRK
              </span>
            </div>
          </div>

          <div className="border border-signal/20 bg-signal/[0.03] p-3">
            <p className="text-[10px] leading-relaxed text-paper/40">
              Deal terms and participant addresses are encrypted with the
              pairwise direct key. Confirming opens Ready X for the private
              on-chain action.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={busy}
              className="border border-wire px-4 py-3 font-display text-[10px] uppercase tracking-widest text-paper/45 transition hover:border-paper/30 hover:text-paper disabled:opacity-30"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canPrepare}
              className="border border-signal px-4 py-3 font-display text-[10px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
            >
              {busy
                ? "Waiting for wallet…"
                : counterSource
                  ? "Send Counter"
                  : "Create Offer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 p-4">
          {/* Deal classification is encrypted with the Offer payload. */}
          <div>
            <label
              htmlFor="offer-deal-type"
              className="mb-2 block font-display text-[10px] uppercase tracking-widest text-paper/40"
            >
              Deal type
            </label>

            <select
              id="offer-deal-type"
              value={dealType}
              onChange={(event) =>
                setDealType(event.target.value as DealType)
              }
              disabled={busy}
              className="w-full border border-wire bg-vault px-3 py-3 text-sm text-paper outline-none focus:border-signal disabled:opacity-40"
            >
              <option value="otc">OTC / Token trade</option>
              <option value="freelance">Freelance / Service</option>
              <option value="goods">Physical goods</option>
              <option value="digital_goods">Digital goods / License</option>
              <option value="bounty">Bounty / Task</option>
              <option value="nft">NFT deal</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="offer-asset"
              className="mb-2 block font-display text-[10px] uppercase tracking-widest text-paper/40"
            >
              Asset
            </label>

            <input
              id="offer-asset"
              value={asset}
              onChange={(event) => setAsset(event.target.value)}
              placeholder="e.g. STRK, USDC"
              disabled={busy}
              autoComplete="off"
              className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:opacity-40"
            />
          </div>

          <div>
            <label
              htmlFor="offer-amount"
              className="mb-2 block font-display text-[10px] uppercase tracking-widest text-paper/40"
            >
              Amount
            </label>

            <div className="flex border border-wire focus-within:border-signal">
              <input
                id="offer-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                inputMode="decimal"
                disabled={busy}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-lg text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
              />

              {asset.trim() && (
                <span className="flex items-center px-3 font-display text-xs uppercase tracking-widest text-paper/35">
                  {asset.trim()}
                </span>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="offer-terms"
              className="mb-2 flex items-center justify-between"
            >
              <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
                Payment terms
              </span>

              <span className="text-[10px] text-paper/25">
                Optional
              </span>
            </label>

            <input
              id="offer-terms"
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
              placeholder="e.g. Net 7 days"
              disabled={busy}
              className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:opacity-40"
            />
          </div>

          <div className="border border-wire bg-paper/[0.015] p-3">
            <div className="flex gap-2">
              <span className="mt-0.5 text-signal">◆</span>

              <p className="text-[10px] leading-relaxed text-paper/40">
                Review first. Creating or countering an Offer does not fund
                escrow and charges the 1 STRK private Offer action fee.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReviewing(true)}
            disabled={!canPrepare}
            className="flex w-full items-center justify-center gap-2 border border-signal px-4 py-3 font-display text-xs uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
          >
            {counterSource
              ? "Review Counter →"
              : "Review Offer →"}
          </button>

          {counterSource && (
            <button
              type="button"
              onClick={onCancelCounter}
              disabled={busy}
              className="w-full px-4 py-2 font-display text-[9px] uppercase tracking-widest text-paper/30 transition hover:text-paper/60 disabled:opacity-30"
            >
              Cancel counter
            </button>
          )}
        </div>
      )}
    </section>
  );
}
