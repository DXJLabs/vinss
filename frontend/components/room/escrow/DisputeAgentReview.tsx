"use client";

import {
  useState,
} from "react";

import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import type {
  EscrowActionPayload,
  EscrowOfferSnapshot,
  SendActionResult,
} from "@/types/deal-room";
import type {
  RekberCustodyState,
  SettlementRole,
} from "@/lib/deal-room/settlement";
import {
  useDisputeAgentReview,
} from "@/hooks/room/useDisputeAgentReview";
import type {
  EscrowCoordinationRecord,
} from "@/lib/deal-room/disputeAgent";

interface DisputeAgentReviewProps {
  session: VinssWalletSession | null;
  state: RekberCustodyState;
  custodyCommitment: bigint;
  role: SettlementRole | null;
  payerAddress: string;
  payeeAddress: string;
  dealOfferLocator: string;
  offerSnapshot: EscrowOfferSnapshot | null;
  rekberSetup: EscrowActionPayload | null;
  rekberAcceptance: EscrowActionPayload | null;
  escrowActions:
    readonly EscrowCoordinationRecord[];
  peerAddress: string;
  onSendCoordination: (
    peerAddress: string,
    payload: EscrowActionPayload,
  ) => Promise<SendActionResult>;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

function percent(
  bps: number,
): string {
  return `${(
    bps / 100
  ).toFixed(
    bps % 100 === 0
      ? 0
      : 2,
  )}%`;
}

export function DisputeAgentReview({
  session,
  state,
  custodyCommitment,
  role,
  payerAddress,
  payeeAddress,
  dealOfferLocator,
  offerSnapshot,
  rekberSetup,
  rekberAcceptance,
  escrowActions,
  peerAddress,
  onSendCoordination,
  busy,
  setBusy,
  setError,
}: DisputeAgentReviewProps) {
  const [
    statement,
    setStatement,
  ] = useState("");

  const review =
    useDisputeAgentReview({
      session,
      state,
      custodyCommitment,
      role,
      payerAddress,
      payeeAddress,
      dealOfferLocator,
      offerSnapshot,
      rekberSetup,
      rekberAcceptance,
      escrowActions,
      peerAddress,
      onSendCoordination,
      setBusy,
      setError,
    });

  if (
    !state.disputed ||
    state.resolutionAuthorized ||
    state.consumed
  ) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-paper/10 bg-paper/[0.02] p-4">
      <div>
        <p className="text-[9px] uppercase tracking-[0.13em] text-paper/35">
          Dispute review
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-paper/40">
          Share your side. VINSS reviews only the information submitted for this dispute.
        </p>
      </div>

      {!review.ownPacket ? (
        <div className="mt-4">
          <label className="text-[9px] uppercase tracking-[0.12em] text-paper/32">
            Your side
          </label>

          <textarea
            value={statement}
            onChange={(event) =>
              setStatement(
                event.target.value,
              )
            }
            rows={3}
            disabled={busy}
            placeholder="What happened, and what should VINSS consider?"
            className="mt-2 w-full resize-none rounded-xl border border-wire bg-transparent px-3 py-3 text-xs leading-relaxed text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
          />

          <button
            type="button"
            disabled={
              busy ||
              !statement.trim()
            }
            onClick={async () => {
              const sent =
                await review.submitEvidence(
                  statement,
                );

              if (sent) {
                setStatement("");
              }
            }}
            className="mt-3 w-full rounded-xl border border-signal/30 px-4 py-3 text-xs font-medium text-signal disabled:opacity-30"
          >
            {busy
              ? "Submitting…"
              : "Submit my side →"}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-signal/[0.05] px-3 py-3">
          <p className="text-[10px] font-medium text-signal">
            Your side submitted ✓
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-paper/[0.025] px-3 py-2.5">
          <p className="text-[9px] text-paper/30">
            Payer
          </p>
          <p className="mt-1 text-[10px] text-paper/60">
            {review.payerPacket
              ? "Submitted ✓"
              : "Waiting"}
          </p>
        </div>

        <div className="rounded-xl bg-paper/[0.025] px-3 py-2.5">
          <p className="text-[9px] text-paper/30">
            Payee
          </p>
          <p className="mt-1 text-[10px] text-paper/60">
            {review.payeePacket
              ? "Submitted ✓"
              : "Waiting"}
          </p>
        </div>
      </div>

      {review.bothPackets &&
        review.disputeCase && (
          <details className="mt-3 rounded-xl border border-paper/8 bg-black/10 px-3 py-3">
            <summary className="cursor-pointer text-[9px] text-paper/40">
              View dispute details
            </summary>

            <div className="mt-3 space-y-3 text-[10px] leading-relaxed text-paper/45">
              <div>
                <p className="text-[8px] uppercase tracking-[0.1em] text-paper/25">
                  Agreement
                </p>
                <p className="mt-1 text-paper/60">
                  {review.disputeCase.acceptedTerms.summary}
                </p>
              </div>

              {review.disputeCase.acceptedTerms.obligations.length > 0 && (
                <div>
                  <p className="text-[8px] uppercase tracking-[0.1em] text-paper/25">
                    What was agreed
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {review.disputeCase.acceptedTerms.obligations.map(
                      (item, index) => (
                        <li key={`obligation-${index}`}>
                          {item}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              <div className="grid gap-2">
                <div className="rounded-lg bg-paper/[0.025] p-2.5">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-paper/25">
                    Payer says
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-paper/55">
                    {review.disputeCase.payer.statement}
                  </p>
                </div>

                <div className="rounded-lg bg-paper/[0.025] p-2.5">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-paper/25">
                    Payee says
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-paper/55">
                    {review.disputeCase.payee.statement}
                  </p>
                </div>
              </div>

              <details className="border-t border-paper/10 pt-2">
                <summary className="cursor-pointer text-[8px] text-paper/25">
                  Technical details
                </summary>

                <div className="mt-2 space-y-2 break-all font-mono text-[8px] leading-relaxed text-paper/25">
                  <p>
                    Case: {review.caseCommitment ?? "Preparing"}
                  </p>
                  <p>
                    Evidence: {review.disputeCase.fulfillment.evidenceCommitment}
                  </p>
                </div>
              </details>
            </div>
          </details>
        )}

      {review.bothPackets &&
        !review.reviewReady &&
        !review.ownSignature && (
          <div className="mt-3 rounded-xl bg-paper/[0.025] px-3 py-3">
            {review.challengeError ? (
              <>
                <p className="text-[10px] text-danger">
                  Unable to prepare confirmation
                </p>

                <button
                  type="button"
                  disabled={review.challengeLoading}
                  onClick={() =>
                    void review.retryChallenge()
                  }
                  className="mt-2 w-full rounded-lg border border-signal/25 px-3 py-2.5 text-[10px] text-signal disabled:opacity-30"
                >
                  {review.challengeLoading
                    ? "Preparing…"
                    : "Try again →"}
                </button>
              </>
            ) : (
              <p className="text-[10px] text-paper/40">
                Preparing your confirmation…
              </p>
            )}
          </div>
        )}

      {review.bothPackets &&
        review.reviewReady &&
        !review.ownSignature && (
          <div className="mt-4">
            <p className="text-[10px] leading-relaxed text-paper/42">
              Both sides are ready. Confirm this dispute so VINSS can resolve it automatically.
            </p>

            <p className="mt-1 text-[9px] text-paper/25">
              This confirmation does not move funds or mean you agree with the other side.
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void review.signReview()
              }
              className="mt-3 w-full rounded-xl border border-signal/35 px-4 py-3 text-xs font-medium text-signal disabled:opacity-30"
            >
              {busy
                ? "Confirming…"
                : "Confirm dispute →"}
            </button>
          </div>
        )}

      {review.caseCommitment && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-paper/[0.025] px-3 py-2.5">
            <p className="text-[9px] text-paper/30">
              Payer confirmation
            </p>
            <p className="mt-1 text-[10px] text-paper/60">
              {review.payerSignature
                ? "Confirmed ✓"
                : "Waiting"}
            </p>
          </div>

          <div className="rounded-xl bg-paper/[0.025] px-3 py-2.5">
            <p className="text-[9px] text-paper/30">
              Payee confirmation
            </p>
            <p className="mt-1 text-[10px] text-paper/60">
              {review.payeeSignature
                ? "Confirmed ✓"
                : "Waiting"}
            </p>
          </div>
        </div>
      )}

      {review.payerSignature &&
        review.payeeSignature &&
        !review.result && (
          <div className="mt-3 rounded-xl border border-signal/15 bg-signal/[0.04] px-3 py-3">
            <p className="text-[10px] font-medium text-signal">
              Reviewing dispute
            </p>
            <p className="mt-1 text-[9px] text-paper/35">
              No action needed. VINSS is reviewing both sides.
            </p>
          </div>
        )}

      {review.result && (
        <div className="mt-3 rounded-xl border border-signal/20 bg-signal/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-medium text-signal">
              Dispute result
            </p>

            <span className="text-[8px] uppercase tracking-[0.1em] text-paper/30">
              {review.result.execution.status ===
                "authorized" ||
              review.result.execution.status ===
                "already_authorized"
                ? "Result ready"
                : "Processing"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-paper/[0.03] p-3">
              <p className="text-[9px] text-paper/30">
                Payer
              </p>
              <p className="mt-1 text-lg font-medium text-paper/80">
                {percent(
                  review.result.decision.payerBps,
                )}
              </p>
            </div>

            <div className="rounded-lg bg-paper/[0.03] p-3">
              <p className="text-[9px] text-paper/30">
                Payee
              </p>
              <p className="mt-1 text-lg font-medium text-paper/80">
                {percent(
                  review.result.decision.payeeBps,
                )}
              </p>
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-paper/45">
            {review.result.decision.reason}
          </p>

          <details className="mt-3 border-t border-paper/10 pt-2">
            <summary className="cursor-pointer text-[8px] text-paper/25">
              Technical status
            </summary>
            <p className="mt-2 text-[8px] text-paper/25">
              {review.result.policy.status}
              {" · "}
              {review.result.execution.status}
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
