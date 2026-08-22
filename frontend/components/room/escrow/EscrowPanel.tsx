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
  getEscrowFundedProof,
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
import { explorerUrl } from "@/components/room/conversation/chatFormat";

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
  const [
    paymentProofTx,
    setPaymentProofTx,
  ] = useState("");

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
    setPaymentProofTx("");
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

          const proof =
            await getEscrowFundedProof(
              agreedCustodyCommitment,
            );

          if (
            !cancelled &&
            proof?.transactionHash
          ) {
            setPaymentProofTx(
              proof.transactionHash,
            );
          }
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
      setPaymentProofTx(
        result.transactionHash,
      );

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

  const rekberReady =
    Boolean(agreedCustodyCommitment);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-vault/70">
      <div className="px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium text-signal">
                VINSS Rekber
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowInfo(true)
                }
                aria-label="What is VINSS Escrow Rekber?"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-wire/70 text-[8px] leading-none text-paper/35 transition hover:border-signal/50 hover:text-signal"
              >
                i
              </button>
            </div>

            <h3 className="mt-2 text-xl font-medium tracking-tight text-paper">
              {paymentSecured
                ? "Payment secured"
                : rekberReady
                  ? "Secure the payment"
                  : "Protect this deal"}
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-paper/38">
              {paymentSecured
                ? "The agreed funds are locked in Rekber."
                : rekberReady
                  ? "Rekber is ready. Secure the agreed payment to continue."
                  : "Prepare the accepted agreement before moving any funds."}
            </p>
          </div>

          {paymentSecured && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal/10 text-sm text-signal">
              ✓
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1">
          {[
            {
              label: "Agreement",
              done:
                Boolean(
                  acceptedAction &&
                    acceptedAction.kind ===
                      "accept",
                ),
              active:
                !rekberReady &&
                !paymentSecured,
            },
            {
              label: "Rekber",
              done:
                rekberReady,
              active:
                Boolean(
                  acceptedAction &&
                    acceptedAction.kind ===
                      "accept",
                ) &&
                !rekberReady,
            },
            {
              label: "Payment",
              done:
                paymentSecured,
              active:
                rekberReady &&
                !paymentSecured,
            },
            {
              label: "Complete",
              done: false,
              active:
                paymentSecured,
            },
          ].map((step, index) => (
            <div
              key={step.label}
              className="min-w-0"
            >
              <div
                className={
                  step.done
                    ? "h-1 rounded-full bg-signal"
                    : step.active
                      ? "h-1 rounded-full bg-signal/45"
                      : "h-1 rounded-full bg-paper/8"
                }
              />

              <div className="mt-2 flex items-center gap-1">
                <span
                  className={
                    step.done
                      ? "text-[9px] text-signal"
                      : step.active
                        ? "text-[9px] text-paper/65"
                        : "text-[9px] text-paper/25"
                  }
                >
                  {step.done
                    ? "✓"
                    : index + 1}
                </span>

                <span
                  className={
                    step.done ||
                    step.active
                      ? "truncate text-[9px] text-paper/55"
                      : "truncate text-[9px] text-paper/25"
                  }
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-wire/45 px-4 py-4">
        {!acceptedAction ||
        acceptedAction.kind !==
          "accept" ? (
          <div className="rounded-xl bg-paper/[0.025] px-4 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper/[0.05] text-paper/35">
              ◇
            </div>

            <p className="mt-4 text-sm font-medium text-paper/75">
              No accepted agreement yet
            </p>

            <p className="mt-1 max-w-sm text-xs leading-relaxed text-paper/35">
              Accept an Offer first.
              VINSS will automatically
              bring the agreed payment
              into Rekber.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-xs text-paper/38">
                <span className="capitalize">
                  {acceptedAction.dealType ??
                    "Deal"}
                </span>
                {" · "}
                Accepted agreement
              </p>

              <span className="shrink-0 text-[10px] text-signal/75">
                ✓ Confirmed
              </span>
            </div>

            {!rekberReady ? (
              <>
                <div className="relative overflow-hidden rounded-2xl bg-paper/[0.035] px-5 py-5">
                  <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-signal/[0.055]" />

                  <p className="relative text-[10px] font-medium uppercase tracking-[0.14em] text-paper/30">
                    Payment to protect
                  </p>

                  <p className="relative mt-2 text-[32px] font-semibold tracking-tight text-paper">
                    {acceptedAction.amount}
                    <span className="ml-2 text-lg font-medium text-paper/55">
                      {acceptedAction.asset}
                    </span>
                  </p>

                  <div className="relative mt-4 flex items-start gap-2">
                    <span className="mt-0.5 text-xs text-signal">
                      🛡
                    </span>

                    <p className="text-xs leading-relaxed text-paper/42">
                      Start Rekber to link
                      this accepted agreement
                      to secure funding.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    handleCreateCoordination
                  }
                  disabled={
                    !canCoordinate
                  }
                  className="w-full rounded-xl bg-signal px-4 py-3.5 text-sm font-medium text-ink transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3.5 w-3.5 animate-spin rounded-full border border-ink/25 border-t-ink"
                      />
                      Starting Rekber…
                    </span>
                  ) : (
                    "Start Rekber"
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-[10px] text-paper/28">
                  <span>🔒</span>
                  <span>
                    No payment moves at
                    this step
                  </span>
                </div>
              </>
            ) : !paymentSecured ? (
              <>
                <div className="rounded-2xl bg-paper/[0.035] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-signal/70">
                        Rekber ready
                      </p>

                      <p className="mt-1 text-xs text-paper/38">
                        Ready for secure
                        funding
                      </p>
                    </div>

                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-signal/10 text-sm text-signal">
                      ✓
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-paper/28">
                      Payment
                    </p>

                    <p className="mt-1 text-[28px] font-semibold tracking-tight text-paper">
                      {acceptedAction.amount}
                      <span className="ml-2 text-base font-medium text-paper/50">
                        {acceptedAction.asset}
                      </span>
                    </p>
                  </div>

                  <div className="mt-4 border-t border-wire/45 pt-4">
                    <FeeBreakdown
                      amount={
                        acceptedAction.amount
                      }
                      unit={
                        acceptedAction.asset
                      }
                      label="VINSS fee"
                      feeBps={100}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-paper/[0.025] px-4 py-3.5">
                  <label
                    htmlFor="escrow-refund"
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-paper/60">
                        Refund protection
                      </span>

                      <span className="mt-1 block text-[10px] leading-relaxed text-paper/30">
                        Refund eligibility
                        begins after this
                        window.
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center rounded-lg bg-paper/[0.035] px-2">
                      <input
                        id="escrow-refund"
                        value={refundHours}
                        onChange={(e) =>
                          setRefundHours(
                            e.target.value,
                          )
                        }
                        inputMode="numeric"
                        disabled={
                          !session || busy
                        }
                        className="w-10 bg-transparent py-2 text-right text-sm font-medium text-paper outline-none disabled:opacity-40"
                      />

                      <span className="ml-1 text-[10px] text-paper/30">
                        h
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-2 px-1">
                  <span className="mt-0.5 text-[10px] text-amber">
                    ◉
                  </span>

                  <p className="text-[10px] leading-relaxed text-paper/30">
                    Amount and token are
                    public on Starknet.
                    Messages and negotiated
                    terms stay encrypted.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={!canDeposit}
                  className="w-full rounded-xl bg-amber px-4 py-3.5 text-sm font-medium text-ink transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy
                    ? "Waiting for Ready X…"
                    : `Secure ${acceptedAction.amount} ${acceptedAction.asset}`}
                </button>
              </>
            ) : (
              <>
                <div className="relative overflow-hidden rounded-2xl bg-signal/[0.07] p-5 ring-1 ring-signal/20">
                  <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-signal/[0.07]" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-signal">
                        Payment secured
                      </p>

                      <p className="mt-2 text-[34px] font-semibold tracking-tight text-paper">
                        {acceptedAction.amount}
                        <span className="ml-2 text-lg font-medium text-paper/55">
                          {acceptedAction.asset}
                        </span>
                      </p>

                      <p className="mt-2 text-xs text-paper/40">
                        Funds are locked in
                        VINSS Rekber.
                      </p>
                    </div>

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-ink">
                      ✓
                    </span>
                  </div>

                  {paymentProofTx && (
                    <div className="relative mt-5 flex items-center justify-between border-t border-signal/15 pt-4">
                      <span className="text-[10px] text-paper/30">
                        Starknet
                      </span>

                      <a
                        href={explorerUrl(
                          paymentProofTx,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-medium text-signal"
                      >
                        Funding proof ↗
                      </a>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-paper/[0.025] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-signal">
                      🛡
                    </span>

                    <p className="text-xs text-paper/45">
                      Protected until
                      settlement or eligible
                      refund.
                    </p>
                  </div>
                </div>
              </>
            )}

            <details className="group rounded-xl bg-paper/[0.018] px-3 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] text-paper/28 hover:text-paper/45 [&::-webkit-details-marker]:hidden">
                <span>
                  Technical details
                </span>

                <span
                  aria-hidden="true"
                  className="text-[9px] transition group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3 space-y-2 border-t border-wire/40 pt-3 text-[10px] leading-relaxed text-paper/28">
                <p className="break-all">
                  <span className="text-paper/42">
                    Offer locator:
                  </span>{" "}
                  {dealOfferLocator || "—"}
                </p>

                <p className="break-all">
                  <span className="text-paper/42">
                    Custody commitment:
                  </span>{" "}
                  {agreedCustodyCommitment
                    ? `0x${agreedCustodyCommitment.toString(
                        16,
                      )}`
                    : "Not established"}
                </p>

                <p className="break-all">
                  <span className="text-paper/42">
                    Token contract:
                  </span>{" "}
                  {token || "—"}
                </p>
              </div>
            </details>

            {lastSecrets && (
              <details className="group rounded-xl bg-danger/[0.025] px-3 py-3 ring-1 ring-danger/20">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] text-danger/75 [&::-webkit-details-marker]:hidden">
                  <span>
                    Recovery & settlement
                  </span>

                  <span
                    aria-hidden="true"
                    className="text-[9px] transition group-open:rotate-180"
                  >
                    ▾
                  </span>
                </summary>

                <div className="mt-3 border-t border-danger/15 pt-3">
                  <p className="mb-3 text-[10px] leading-relaxed text-paper/35">
                    Keep these private.
                    They are required for
                    settlement and recovery.
                  </p>

                  <div className="space-y-1.5 font-mono text-[9px] text-paper/35">
                    <p className="break-all">
                      custody: 0x
                      {lastSecrets.custodyCommitment.toString(
                        16,
                      )}
                    </p>

                    <p className="break-all">
                      releaseSecret: 0x
                      {lastSecrets.releaseSecret.toString(
                        16,
                      )}
                    </p>

                    <p className="break-all">
                      refundSecret: 0x
                      {lastSecrets.refundSecret.toString(
                        16,
                      )}
                    </p>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {showInfo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/85 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rekber-info-title"
            className="w-full max-w-sm border border-wire bg-vault p-4"
          >
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
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-wire/70 bg-transparent text-[11px] leading-none text-paper/40 transition hover:border-signal/40 hover:text-signal"
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
          </section>
        </div>
      )}
    </section>
  );
}
