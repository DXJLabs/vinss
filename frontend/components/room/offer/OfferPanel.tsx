"use client";

import { useEffect, useState } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { createOffer } from "@/lib/deal-room/offers";
import type { OfferActionPayload, DealType } from "@/types/deal-room";
import type { AgentProposal } from "@/lib/agent";
import type { ConversationEntry } from "@/components/room/conversation/ConversationPanel";
import { humanizeError } from "@/lib/errors/uiError";

export function OfferPanel({
  session,
  channelKey,
  onSent,
  busy,
  setBusy,
  setError,
  agentDraft,
}: {
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  onSent: (entry: ConversationEntry) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  agentDraft?: Extract<
    AgentProposal,
    { type: "draft_offer" | "draft_counter_offer" }
  > | null;
}) {
  const [dealType, setDealType] = useState<DealType>("otc");
  const [asset, setAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [terms, setTerms] = useState("");

  useEffect(() => {
    if (!agentDraft) return;

    setAsset(agentDraft.payload.asset);
    setAmount(agentDraft.payload.amount);
    setTerms(agentDraft.payload.paymentTerms);
  }, [agentDraft]);

  async function handleCreateOffer() {
    if (!session || !channelKey || !asset.trim() || !amount.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const payload: Omit<OfferActionPayload, "kind"> = {
        dealType,
        asset: asset.trim(),
        amount: amount.trim(),
        paymentTerms: terms.trim() || "Tidak ditentukan",
      };

      const result = await createOffer(session.account, channelKey, payload);

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: `Create offer — ${amount} ${asset}`,
        transactionHash: result.transactionHash,
        actionLocator: result.actionLocator.toString(16),
        sentAt: new Date().toISOString(),
      });

      setAsset("");
      setAmount("");
      setTerms("");
    } catch (err) {
      setError(humanizeError(err, "We couldn't create the offer. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const canCreate =
    Boolean(session) &&
    Boolean(channelKey) &&
    !busy &&
    Boolean(asset.trim()) &&
    Boolean(amount.trim());

  return (
    <section className="border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs uppercase tracking-widest text-signal">
              Offer
            </p>
            <h3 className="mt-1 text-sm text-paper">
              Create a proposal for this deal
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              Set the asset, amount and payment terms. You will review the
              offer before it is created.
            </p>
          </div>

          <span className="shrink-0 text-[10px] uppercase tracking-wider text-paper/30">
            Step 1 · Create
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Deal type — encrypted inside the Offer payload */}
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
            onChange={(e) => setDealType(e.target.value as DealType)}
            disabled={!session || !channelKey || busy}
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

          <p className="mt-1.5 text-[10px] leading-relaxed text-paper/25">
            Deal type is encrypted with the offer and is not exposed publicly on-chain.
          </p>
        </div>

        {/* Asset */}
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
            onChange={(e) => setAsset(e.target.value)}
            placeholder="e.g. STRK, USDC"
            disabled={!session || !channelKey || busy}
            autoComplete="off"
            className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        {/* Amount */}
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
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              disabled={!session || !channelKey || busy}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-lg text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
            />

            {asset.trim() && (
              <span className="flex items-center px-3 font-display text-xs uppercase tracking-widest text-paper/35">
                {asset.trim()}
              </span>
            )}
          </div>
        </div>

        {/* Payment terms */}
        <div>
          <label
            htmlFor="offer-terms"
            className="mb-2 flex items-center justify-between"
          >
            <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
              Payment terms
            </span>

            <span className="text-[10px] text-paper/25">Optional</span>
          </label>

          <input
            id="offer-terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="e.g. Net 7 days"
            disabled={!session || !channelKey || busy}
            className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        {/* Financial summary */}
        <div className="border-t border-wire pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
              Deal summary
            </span>

            <span className="text-[10px] text-paper/25">
              Estimated
            </span>
          </div>

          <div className="border border-wire bg-vault/50 px-3 py-3 text-xs">
            <div className="flex justify-between text-paper/50">
              <span>Deal value</span>
              <span>
                {amount || "0"} {asset || ""}
              </span>
            </div>

            <div className="mt-1 flex justify-between text-paper/50">
              <span>Private offer action fee</span>
              <span>1 STRK</span>
            </div>
          </div>
        </div>

        {/* Review boundary */}
        <div className="border border-wire bg-paper/[0.015] p-3">
          <div className="flex gap-2">
            <span className="mt-0.5 text-signal">◆</span>

            <p className="text-[10px] leading-relaxed text-paper/40">
              Review the deal terms before creating the offer. Creating an offer
              charges a flat 1 STRK private action fee and does not fund
              Escrow Rekber.
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateOffer}
          disabled={!canCreate}
          className="flex w-full items-center justify-center gap-2 border border-signal px-4 py-3 font-display text-xs uppercase tracking-widest text-signal transition-colors hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? "Creating offer…" : "Review Offer →"}
        </button>
      </div>
    </section>
  );
}
