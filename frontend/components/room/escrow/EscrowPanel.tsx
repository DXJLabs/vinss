"use client";

import { useEffect, useState } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import {
  sendEscrowCoordinationAction,
  generateEscrowSecrets,
  generateCustodyCommitment,
  computeReleaseCommitment,
  computeRefundCommitment,
  depositEscrow,
} from "@/lib/deal-room/escrow";
import type { AgentProposal } from "@/lib/agent";
import type { ConversationEntry } from "@/components/room/conversation/ConversationPanel";
import { humanizeError } from "@/lib/errors/uiError";
import { FeeBreakdown } from "@/components/FeeBreakdown";

export function EscrowPanel({
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
    { type: "prepare_escrow" }
  > | null;
}) {
  const [dealOfferLocator, setDealOfferLocator] = useState("");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [refundHours, setRefundHours] = useState("24");

  useEffect(() => {
    if (!agentDraft) return;

    if (agentDraft.payload.dealOfferLocator) {
      setDealOfferLocator(
        agentDraft.payload.dealOfferLocator,
      );
    }

    if (agentDraft.payload.refundHours) {
      setRefundHours(agentDraft.payload.refundHours);
    }
  }, [agentDraft]);
  const [agreedCustodyCommitment, setAgreedCustodyCommitment] = useState<bigint | null>(null);
  const [lastSecrets, setLastSecrets] = useState<{
    custodyCommitment: bigint;
    releaseSecret: bigint;
    refundSecret: bigint;
  } | null>(null);

  async function handleCreateCoordination() {
    if (!session || !channelKey || !dealOfferLocator.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const custodyCommitment = generateCustodyCommitment();

      const result = await sendEscrowCoordinationAction(session.account, channelKey, {
        kind: "create",
        dealOfferLocator: dealOfferLocator.trim(),
        custodyCommitment: custodyCommitment.toString(),
      });

      setAgreedCustodyCommitment(custodyCommitment);

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: `Escrow ready — custody 0x${custodyCommitment.toString(16).slice(0, 10)}…`,
        transactionHash: result.transactionHash,
        actionLocator: result.actionLocator.toString(16),
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(humanizeError(err, "We couldn't start the escrow process. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeposit() {
    if (!session || !agreedCustodyCommitment || !token.trim() || !amount.trim()) return;
    setBusy(true);
    setError(null);

    try {
      const secrets = generateEscrowSecrets();
      const custodyCommitment = agreedCustodyCommitment;
      const releaseCommitment = computeReleaseCommitment(
        custodyCommitment,
        secrets.releaseSecret
      );
      const refundCommitment = computeRefundCommitment(
        custodyCommitment,
        secrets.refundSecret
      );
      const refundAfter =
        Math.floor(Date.now() / 1000) + Number(refundHours || "24") * 3600;

      const result = await depositEscrow(session.account, {
        custodyCommitment,
        releaseCommitment,
        refundCommitment,
        refundAfter,
        token: token.trim(),
        amount: BigInt(amount.trim()),
      });

      setLastSecrets({ custodyCommitment, ...secrets });

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: `Escrow deposit — ${amount} token ${token.slice(0, 10)}…`,
        transactionHash: result.transactionHash,
        actionLocator: custodyCommitment.toString(16),
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(humanizeError(err, "We couldn't fund the escrow. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const canCoordinate =
    Boolean(session) &&
    Boolean(channelKey) &&
    !busy &&
    Boolean(dealOfferLocator.trim());

  const canDeposit =
    Boolean(session) &&
    !busy &&
    Boolean(agreedCustodyCommitment) &&
    Boolean(token.trim()) &&
    Boolean(amount.trim());

  return (
    <section className="border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <p className="font-display text-xs uppercase tracking-widest text-signal">
          VINSS Escrow Rekber
        </p>

        <h3 className="mt-1 text-sm text-paper">
          Secure the accepted deal
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-paper/35">
          Connect the accepted offer first, then lock the agreed payment in Rekber.
        </p>
      </div>

      <div className="p-4">
        {/* Progress */}
        <div className="mb-6 grid grid-cols-2 border border-wire">
          <div className="border-r border-wire bg-paper/[0.025] p-3">
            <div className="font-display text-[9px] tracking-widest text-paper/25">
              01
            </div>

            <div className="mt-1 text-[10px] uppercase tracking-wider text-signal">
              Connect offer
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-paper/30">
              Link the accepted offer to escrow.
            </p>
          </div>

          <div className={`p-3 ${agreedCustodyCommitment ? "bg-paper/[0.025]" : ""}`}>
            <div className="font-display text-[9px] tracking-widest text-paper/25">
              02
            </div>

            <div
              className={`mt-1 text-[10px] uppercase tracking-wider ${
                agreedCustodyCommitment ? "text-signal" : "text-paper/35"
              }`}
            >
              Fund escrow
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-paper/30">
              Deposit the agreed amount on-chain.
            </p>
          </div>
        </div>

        {/* Step 1 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-[10px] uppercase tracking-widest text-paper/45">
                Step 1
              </p>

              <h4 className="mt-1 text-sm text-paper">
                Connect the accepted offer
              </h4>
            </div>

            <span
              className={`text-[10px] uppercase tracking-wider ${
                agreedCustodyCommitment ? "text-signal" : "text-paper/30"
              }`}
            >
              {agreedCustodyCommitment ? "Ready" : "Waiting"}
            </span>
          </div>

          <div className="border border-wire p-3">
            <label
              htmlFor="escrow-offer-locator"
              className="mb-2 block text-xs text-paper/55"
            >
              Offer reference
            </label>

            <div className="flex gap-2">
              <input
                id="escrow-offer-locator"
                value={dealOfferLocator}
                onChange={(e) => setDealOfferLocator(e.target.value)}
                placeholder="Paste the offer reference"
                disabled={
                  !session ||
                  !channelKey ||
                  busy ||
                  Boolean(agreedCustodyCommitment)
                }
                className="min-w-0 flex-1 border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
              />

              <button
                onClick={handleCreateCoordination}
                disabled={!canCoordinate || Boolean(agreedCustodyCommitment)}
                className="border border-signal px-4 py-2 font-display text-[10px] uppercase tracking-widest text-signal transition-colors hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? "Connecting…" : "Connect"}
              </button>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-paper/25">
              Use the reference from the offer you accepted. VINSS uses it to
              establish the shared escrow coordination.
            </p>
          </div>
        </div>

        {/* Coordination status */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-wire" />

          <div
            className={`flex items-center gap-2 text-[10px] uppercase tracking-wider ${
              agreedCustodyCommitment ? "text-signal" : "text-paper/25"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                agreedCustodyCommitment ? "bg-signal" : "bg-paper/20"
              }`}
            />

            {agreedCustodyCommitment
              ? "Custody coordinated"
              : "Awaiting coordination"}
          </div>

          <div className="h-px flex-1 bg-wire" />
        </div>

        {/* Step 2 */}
        <div className={agreedCustodyCommitment ? "" : "opacity-45"}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-display text-[10px] uppercase tracking-widest text-paper/45">
                Step 2
              </p>

              <h4 className="mt-1 text-sm text-paper">
                Fund the escrow
              </h4>
            </div>

            <span className="text-[10px] uppercase tracking-wider text-paper/30">
              ERC-20
            </span>
          </div>

          <div className="space-y-4 border border-wire p-3">
            {/* Token */}
            <div>
              <label
                htmlFor="escrow-token"
                className="mb-2 block text-xs text-paper/55"
              >
                Token contract
              </label>

              <input
                id="escrow-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="0x…"
                disabled={!session || busy || !agreedCustodyCommitment}
                className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
              />

              <p className="mt-1.5 text-[10px] text-paper/25">
                The current Rekber contract locks ERC-20 payment assets. The deal itself
                may represent OTC, freelance work, goods, NFT purchases, bounty,
                or another privately negotiated transaction.
              </p>
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="escrow-amount"
                className="mb-2 block text-xs text-paper/55"
              >
                Deposit amount
              </label>

              <input
                id="escrow-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                disabled={!session || busy || !agreedCustodyCommitment}
                className="w-full border border-wire bg-transparent px-3 py-3 text-lg text-paper outline-none placeholder:text-paper/20 focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
              />

              <p className="mt-1.5 text-[10px] leading-relaxed text-paper/25">
                Enter the token amount using the token's required unit.
              </p>
            </div>

            {/* Refund window */}
            <div>
              <label
                htmlFor="escrow-refund"
                className="mb-2 flex items-center justify-between"
              >
                <span className="text-xs text-paper/55">
                  Refund window
                </span>

                <span className="text-[10px] text-paper/25">
                  Default: 24 hours
                </span>
              </label>

              <div className="flex items-center border border-wire">
                <input
                  id="escrow-refund"
                  value={refundHours}
                  onChange={(e) => setRefundHours(e.target.value)}
                  inputMode="numeric"
                  disabled={!session || busy || !agreedCustodyCommitment}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-paper outline-none focus:border-signal disabled:cursor-not-allowed disabled:opacity-40"
                />

                <span className="px-3 text-xs text-paper/30">
                  hours
                </span>
              </div>

              <p className="mt-1.5 text-[10px] leading-relaxed text-paper/25">
                Determines when the refund path becomes available.
              </p>
            </div>

            {/* Summary */}
            <div className="border-t border-wire pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
                  Deposit summary
                </span>

                <span className="text-[10px] text-paper/25">
                  Estimated
                </span>
              </div>

              <FeeBreakdown
                amount={amount}
                label="VINSS escrow service fee"
                feeBps={100}
              />
            </div>

            {/* Public notice */}
            <div className="border border-amber/30 bg-amber/[0.025] p-3">
              <div className="flex gap-2">
                <span className="text-amber">!</span>

                <div>
                  <p className="text-xs text-paper/65">
                    Public on-chain deposit
                  </p>

                  <p className="mt-1 text-[10px] leading-relaxed text-paper/35">
                    The token and amount of this deposit are publicly visible
                    on-chain. Your private deal messages and negotiation
                    context remain separate from the ERC-20 deposit.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDeposit}
              disabled={!canDeposit}
              className="w-full border border-amber px-4 py-3 font-display text-xs uppercase tracking-widest text-amber transition-colors hover:bg-amber hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy ? "Funding escrow…" : "Review Deposit →"}
            </button>
          </div>
        </div>

        {/* Advanced details */}
        <details className="border-t border-wire pt-4">
          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-paper/25 hover:text-paper/45">
            Advanced escrow details
          </summary>

          <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-paper/30">
            <p>
              <span className="text-paper/45">Offer locator:</span>{" "}
              {dealOfferLocator || "—"}
            </p>

            <p>
              <span className="text-paper/45">Custody commitment:</span>{" "}
              {agreedCustodyCommitment
                ? `0x${agreedCustodyCommitment.toString(16)}`
                : "Not established"}
            </p>

            <p>
              <span className="text-paper/45">Token:</span>{" "}
              {token || "—"}
            </p>
          </div>
        </details>

        {/* Secrets */}
        {lastSecrets && (
          <div className="border border-danger/40 bg-danger/[0.025] p-4">
            <p className="mb-2 font-display text-[10px] uppercase tracking-widest text-danger">
              Save your escrow secrets
            </p>

            <p className="mb-3 text-[10px] leading-relaxed text-paper/45">
              These secrets are required to release or refund the escrow.
              Store them securely. They cannot be recovered if lost.
            </p>

            <div className="space-y-1.5 font-mono text-[10px] text-paper/50">
              <p className="break-all">
                custody: 0x{lastSecrets.custodyCommitment.toString(16)}
              </p>

              <p className="break-all">
                releaseSecret: 0x{lastSecrets.releaseSecret.toString(16)}
              </p>

              <p className="break-all">
                refundSecret: 0x{lastSecrets.refundSecret.toString(16)}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
