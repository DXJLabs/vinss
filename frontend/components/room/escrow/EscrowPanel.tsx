"use client";

import { useEffect, useState } from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import {
  generateEscrowSecrets,
  generateCustodyCommitment,
  computeReleaseCommitment,
  computeRefundCommitment,
  depositEscrow,
  escrowCustodyExists,
  parseSettlementAmount,
  resolveSettlementAsset,
} from "@/lib/deal-room/escrow";
import type { AgentProposal } from "@/lib/agent";
import type {
  SendActionResult,
} from "@/types/deal-room";
import type {
  DiscoveredEscrowAction,
} from "@/hooks/room/useRoomEscrow";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";
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
  acceptedOffer,
  offerEntries,
  escrowActions,
  onStartRekber,
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
  acceptedOffer?: ConversationEntry | null;
  offerEntries: ConversationEntry[];
  escrowActions: DiscoveredEscrowAction[];
  onStartRekber: (
    source: ConversationEntry,
    custodyCommitment: bigint,
  ) => Promise<SendActionResult>;
}) {
  const [dealOfferLocator, setDealOfferLocator] = useState("");
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [refundHours, setRefundHours] = useState("24");
  const [showInfo, setShowInfo] = useState(false);
  const [prepareStage, setPrepareStage] = useState<
    "idle" | "agreement" | "coordination"
  >("idle");

  useEffect(() => {
    if (
      !agentDraft ||
      acceptedOffer?.offerAction?.kind === "accept"
    ) {
      return;
    }

    if (agentDraft.payload.dealOfferLocator) {
      setDealOfferLocator(
        agentDraft.payload.dealOfferLocator,
      );
    }

    if (agentDraft.payload.amount) {
      setAmount(agentDraft.payload.amount);
    }

    if (agentDraft.payload.token) {
      setToken(agentDraft.payload.token);
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
  const [
    paymentSecured,
    setPaymentSecured,
  ] = useState(false);

  useEffect(() => {
    const acceptedAction =
      acceptedOffer?.offerAction;

    if (
      !acceptedOffer ||
      !acceptedAction ||
      acceptedAction.kind !== "accept"
    ) {
      return;
    }

    // The parent locator identifies the exact create/counter action whose
    // encrypted terms were accepted. The accept action remains the proof.
    setDealOfferLocator(
      acceptedAction.parentOfferLocator ??
        acceptedOffer.actionLocator,
    );
    setAmount(acceptedAction.amount);

    const settlementAsset =
      resolveSettlementAsset(
        acceptedAction.asset,
      );

    setToken(
      settlementAsset?.address ?? "",
    );

    // Loading a different accepted deal starts a fresh local coordination view.
    setAgreedCustodyCommitment(null);
    setLastSecrets(null);
    setPaymentSecured(false);
  }, [acceptedOffer?.actionLocator]);

  useEffect(() => {
    if (
      !acceptedOffer ||
      acceptedOffer.offerAction?.kind !==
        "accept"
    ) {
      return;
    }

    const acceptedLocator =
      acceptedOffer.actionLocator
        .replace(/^0x/, "")
        .toLowerCase();

    // New Rekber flow: START REKBER is represented by one encrypted
    // prepare_escrow Offer action containing the custody commitment.
    const preparedOffer =
      [...offerEntries]
        .reverse()
        .find((entry) => {
          const action =
            entry.offerAction;

          if (
            action?.kind !==
              "prepare_escrow" ||
            !action.custodyCommitment
          ) {
            return false;
          }

          const parentLocator =
            action.parentOfferLocator
              ?.replace(/^0x/, "")
              .toLowerCase();

          return (
            parentLocator ===
            acceptedLocator
          );
        });

    const preparedCommitment =
      preparedOffer?.offerAction
        ?.custodyCommitment;

    if (preparedCommitment) {
      try {
        setAgreedCustodyCommitment(
          BigInt(preparedCommitment),
        );
        return;
      } catch {
        // Fall through to legacy recovery.
      }
    }

    // Backward compatibility for Rekber setups created before the
    // single-helper START REKBER flow.
    const legacy =
      [...escrowActions]
        .reverse()
        .find((item) => {
          if (
            item.action.kind !==
              "create" ||
            !item.action
              .custodyCommitment
          ) {
            return false;
          }

          const snapshotLocator =
            item.action
              .offerSnapshot
              ?.acceptedOfferLocator
              ?.replace(
                /^0x/,
                "",
              )
              .toLowerCase();

          return (
            snapshotLocator ===
            acceptedLocator
          );
        });

    if (
      legacy?.action
        .custodyCommitment
    ) {
      try {
        setAgreedCustodyCommitment(
          BigInt(
            legacy.action
              .custodyCommitment,
          ),
        );
      } catch {
        // Ignore malformed unrelated ciphertext.
      }
    }
  }, [
    acceptedOffer?.actionLocator,
    offerEntries,
    escrowActions,
  ]);

  // Rekber custody is public contract state.
  // Recover the funded state after reload and synchronize it across wallets.
  useEffect(() => {
    if (
      !agreedCustodyCommitment ||
      paymentSecured
    ) {
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const exists =
          await escrowCustodyExists(
            agreedCustodyCommitment,
          );

        if (
          !cancelled &&
          exists
        ) {
          setPaymentSecured(true);
        }
      } catch (err) {
        console.debug(
          "[VINSS ESCROW STATUS CHECK]",
          err,
        );
      }
    };

    void check();

    const timer =
      window.setInterval(
        () => void check(),
        5000,
      );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    agreedCustodyCommitment,
    paymentSecured,
  ]);

  async function handleCreateCoordination() {
    const acceptedAction =
      acceptedOffer?.offerAction;

    if (
      !session ||
      !channelKey ||
      !acceptedOffer ||
      !acceptedAction ||
      acceptedAction.kind !== "accept"
    ) {
      setError(
        "Escrow Rekber must start from an accepted Offer.",
      );
      return;
    }

    if (agreedCustodyCommitment) {
      return;
    }

    setBusy(true);
    setError(null);
    setPrepareStage("coordination");

    try {
      const custodyCommitment =
        generateCustodyCommitment();

      const result =
        await onStartRekber(
          acceptedOffer,
          custodyCommitment,
        );

      setAgreedCustodyCommitment(
        custodyCommitment,
      );

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary:
          `Rekber ready — ${acceptedAction.dealType ?? "deal"} · ${acceptedAction.amount} ${acceptedAction.asset}`,
        transactionHash:
          result.transactionHash,
        actionLocator:
          result.actionLocator
            .toString(16),
        sentAt:
          new Date().toISOString(),
      });
    } catch (err) {
      setError(
        humanizeError(
          err,
          "We couldn't start Rekber. Please try again.",
        ),
      );
    } finally {
      setPrepareStage("idle");
      setBusy(false);
    }
  }

  async function handleDeposit() {
    const acceptedAction =
      acceptedOffer?.offerAction;

    if (
      !session ||
      !agreedCustodyCommitment ||
      paymentSecured ||
      !acceptedAction ||
      acceptedAction.kind !== "accept"
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const settlementAsset =
        resolveSettlementAsset(
          acceptedAction.asset,
        );

      if (
        !settlementAsset ||
        !settlementAsset.address
      ) {
        throw new Error(
          `Settlement token ${acceptedAction.asset} is not configured for this network.`,
        );
      }

      const principal =
        parseSettlementAmount(
          acceptedAction.amount,
          settlementAsset.decimals,
        );

      const secrets =
        generateEscrowSecrets();
      const custodyCommitment =
        agreedCustodyCommitment;
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
        token:
          settlementAsset.address,
        amount: principal,
      });

      setLastSecrets({
        custodyCommitment,
        ...secrets,
      });
      setPaymentSecured(true);

      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary:
          `Escrow deposit — ${acceptedAction.amount} ${acceptedAction.asset}`,
        transactionHash: result.transactionHash,
        actionLocator: custodyCommitment.toString(16),
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        "[VINSS ESCROW DEPOSIT FAILED]",
        err,
      );
      setError(
        humanizeError(
          err,
          "We couldn't fund the escrow. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const acceptedAction =
    acceptedOffer?.offerAction;

  const acceptedSettlement =
    acceptedAction?.kind === "accept"
      ? resolveSettlementAsset(
          acceptedAction.asset,
        )
      : null;

  const canCoordinate =
    Boolean(session) &&
    Boolean(channelKey) &&
    !busy &&
    acceptedAction?.kind ===
      "accept" &&
    Boolean(dealOfferLocator.trim());

  const canDeposit =
    Boolean(session) &&
    !busy &&
    !paymentSecured &&
    Boolean(
      agreedCustodyCommitment,
    ) &&
    acceptedAction?.kind ===
      "accept" &&
    Boolean(
      acceptedSettlement?.address,
    ) &&
    Boolean(amount.trim());

  return (
    <section className="relative border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <div className="flex items-center gap-2">
          <p className="font-display text-xs uppercase tracking-widest text-signal">
            VINSS Escrow Rekber
          </p>

          <button
            type="button"
            onClick={() => setShowInfo(true)}
            aria-label="What is VINSS Escrow Rekber?"
            className="flex h-5 w-5 items-center justify-center rounded-full border border-wire text-[10px] text-paper/45 transition-colors hover:border-signal hover:text-signal"
          >
            i
          </button>
        </div>

        <h3 className="mt-2 text-lg text-paper">Secure this deal</h3>
        <p className="mt-1 text-xs leading-relaxed text-paper/35">
          The accepted payment is locked until the deal is settled.
        </p>
      </div>

      <div className="space-y-4 p-4">
        {!acceptedAction || acceptedAction.kind !== "accept" ? (
          <div className="border border-wire p-4">
            <p className="text-sm text-paper">Waiting for an accepted Offer</p>
            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              Accept an Offer first. VINSS will load the agreed payment here automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="border border-wire bg-paper/[0.025] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-signal">
                    Agreement confirmed ✓
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-paper/35">
                    {acceptedAction.dealType ?? "Deal"}
                  </p>
                  <p className="mt-1 text-2xl text-paper">
                    {acceptedAction.amount} {acceptedAction.asset}
                  </p>
                </div>
                <span className="border border-signal/40 px-2 py-1 text-[9px] uppercase tracking-widest text-signal">
                  Accepted
                </span>
              </div>
            </div>

            {!agreedCustodyCommitment ? (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-paper/40">
                  VINSS connects this accepted agreement to Rekber privately.
                  You do not need to enter an Offer reference or token contract.
                </p>
                <button
                  type="button"
                  onClick={handleCreateCoordination}
                  disabled={!canCoordinate}
                  className="w-full border border-signal px-4 py-3 font-display text-xs uppercase tracking-widest text-signal transition-colors hover:bg-signal hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 animate-spin rounded-full border border-signal/25 border-t-signal"
                      />
                      <span>
                        {prepareStage === "coordination"
                          ? "Starting Rekber…"
                          : "Starting Rekber…"}
                      </span>
                    </span>
                  ) : (
                    "Start Rekber →"
                  )}
                </button>
              </div>
            ) : !paymentSecured ? (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-paper/45">Payment</span>
                    <span className="text-sm text-paper">
                      {acceptedAction.amount} {acceptedAction.asset}
                    </span>
                  </div>

                  <FeeBreakdown
                    amount={acceptedAction.amount}
                    unit={acceptedAction.asset}
                    label="VINSS fee"
                    feeBps={100}
                  />
                </div>

                <div className="border border-wire p-3">
                  <label htmlFor="escrow-refund" className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-xs text-paper/55">Refund protection</span>
                      <span className="mt-1 block text-[10px] text-paper/30">
                        Refund becomes available after this window.
                      </span>
                    </span>
                    <span className="flex items-center border border-wire">
                      <input
                        id="escrow-refund"
                        value={refundHours}
                        onChange={(e) => setRefundHours(e.target.value)}
                        inputMode="numeric"
                        disabled={!session || busy}
                        className="w-14 bg-transparent px-2 py-2 text-right text-sm text-paper outline-none disabled:opacity-40"
                      />
                      <span className="pr-2 text-[10px] text-paper/30">hours</span>
                    </span>
                  </label>
                </div>

                <div className="border border-amber/30 bg-amber/[0.025] p-3">
                  <p className="text-xs text-paper/65">Public on-chain payment</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-paper/35">
                    The payment asset and amount are visible on-chain.
                    Your Deal Room messages and negotiated terms remain encrypted.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={!canDeposit}
                  className="w-full border border-amber px-4 py-3 font-display text-xs uppercase tracking-widest text-amber transition-colors hover:bg-amber hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy ? "Waiting for Ready X…" : `Secure ${acceptedAction.amount} ${acceptedAction.asset}`}
                </button>
              </>
            ) : (
              <div className="border border-signal/40 bg-signal/[0.025] p-4">
                <p className="font-display text-xs uppercase tracking-widest text-signal">
                  Payment secured ✓
                </p>
                <p className="mt-3 text-xl text-paper">
                  {acceptedAction.amount} {acceptedAction.asset}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-paper/40">
                  The payment is locked in VINSS Escrow Rekber.
                </p>
              </div>
            )}

            <details className="border-t border-wire pt-4">
              <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-paper/25 hover:text-paper/45">
                Technical details
              </summary>
              <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-paper/30">
                <p className="break-all">
                  <span className="text-paper/45">Offer locator:</span>{" "}
                  {dealOfferLocator || "—"}
                </p>
                <p className="break-all">
                  <span className="text-paper/45">Custody commitment:</span>{" "}
                  {agreedCustodyCommitment ? `0x${agreedCustodyCommitment.toString(16)}` : "Not established"}
                </p>
                <p className="break-all">
                  <span className="text-paper/45">Token contract:</span>{" "}
                  {token || "—"}
                </p>
              </div>
            </details>

            {lastSecrets && (
              <details className="border border-danger/30 p-3">
                <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-danger">
                  Recovery & settlement secrets
                </summary>
                <div className="mt-3">
                  <p className="mb-3 text-[10px] leading-relaxed text-paper/40">
                    Keep these private until they are used for settlement. They cannot be recovered if lost.
                  </p>
                  <div className="space-y-1.5 font-mono text-[10px] text-paper/45">
                    <p className="break-all">custody: 0x{lastSecrets.custodyCommitment.toString(16)}</p>
                    <p className="break-all">releaseSecret: 0x{lastSecrets.releaseSecret.toString(16)}</p>
                    <p className="break-all">refundSecret: 0x{lastSecrets.refundSecret.toString(16)}</p>
                  </div>
                </div>
              </details>
            )}
          </>
        )}
      </div>

      {showInfo && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-ink/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rekber-info-title"
        >
          <div className="w-full max-w-sm border border-wire bg-vault p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="rekber-info-title" className="font-display text-xs uppercase tracking-widest text-signal">
                  What is Escrow Rekber?
                </p>
                <p className="mt-2 text-sm leading-relaxed text-paper/65">
                  VINSS locks the agreed payment until the deal is completed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                aria-label="Close"
                className="text-paper/40 transition-colors hover:text-paper"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs leading-relaxed text-paper/45">
              <p>• Payment is secured on Starknet.</p>
              <p>• Deal terms and messages remain private.</p>
              <p>• Settlement releases the locked payment.</p>
              <p>• Refund becomes available after the agreed window.</p>
            </div>

            <div className="mt-4 border-t border-wire pt-3">
              <p className="text-[10px] leading-relaxed text-paper/35">
                Need help with this specific deal? VINSS Agent can review the agreement and explain the next action.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="mt-4 w-full border border-signal px-4 py-3 font-display text-[10px] uppercase tracking-widest text-signal transition-colors hover:bg-signal hover:text-ink"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
