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
    <div className="mt-3 rounded-xl border border-paper/10 bg-paper/[0.025] p-4">
      <p className="text-[9px] uppercase tracking-[0.13em] text-paper/35">
        VINSS Dispute Agent
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-paper/40">
        Only evidence you explicitly submit here is disclosed for Agent review. Normal room chat remains private. The Agent cannot move funds or resolve custody.
      </p>

      {!review.ownPacket ? (
        <div className="mt-3">
          <label className="text-[9px] uppercase tracking-[0.12em] text-paper/32">
            My dispute evidence
          </label>
          <textarea
            value={statement}
            onChange={(event) =>
              setStatement(
                event.target.value,
              )
            }
            rows={4}
            disabled={busy}
            placeholder="State the facts the Agent should evaluate. Do not include unrelated private chat."
            className="mt-2 w-full resize-none rounded-lg border border-wire bg-transparent px-3 py-2 text-xs text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
          />
          <button
            type="button"
            disabled={
              busy ||
              !statement.trim()
            }
            onClick={async () => {
              const sent =
                await review
                  .submitEvidence(
                    statement,
                  );

              if (sent) {
                setStatement("");
              }
            }}
            className="mt-3 w-full rounded-xl border border-paper/15 px-4 py-3 text-xs font-medium text-paper/60 disabled:opacity-30"
          >
            {busy
              ? "Sharing evidence…"
              : "Submit evidence to Agent review →"}
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-signal/[0.035] px-3 py-2.5">
          <p className="text-[10px] text-signal">
            My evidence submitted ✓
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded-lg bg-paper/[0.025] px-3 py-2">
          <span className="text-paper/30">
            Payer evidence
          </span>
          <p className="mt-1 text-paper/55">
            {review.payerPacket
              ? "Ready ✓"
              : "Waiting"}
          </p>
        </div>
        <div className="rounded-lg bg-paper/[0.025] px-3 py-2">
          <span className="text-paper/30">
            Payee evidence
          </span>
          <p className="mt-1 text-paper/55">
            {review.payeePacket
              ? "Ready ✓"
              : "Waiting"}
          </p>
        </div>
      </div>

      {review.bothPackets &&
        !review.ownSignature && (
          <div className="mt-3">
            <p className="text-[9px] leading-relaxed text-paper/30">
              Both evidence packets are ready. Sign the backend-issued SNIP-12 challenge to consent to review of this exact case. This signature does not accept the Agent decision.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void review.signReview()
              }
              className="mt-3 w-full rounded-xl border border-signal/30 px-4 py-3 text-xs font-medium text-signal disabled:opacity-30"
            >
              {busy
                ? "Signing review…"
                : "Sign Agent review →"}
            </button>
          </div>
        )}

      {review.caseCommitment && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
          <div className="rounded-lg bg-paper/[0.025] px-3 py-2">
            <span className="text-paper/30">
              Payer signature
            </span>
            <p className="mt-1 text-paper/55">
              {review.payerSignature
                ? "Verified packet ✓"
                : "Waiting"}
            </p>
          </div>
          <div className="rounded-lg bg-paper/[0.025] px-3 py-2">
            <span className="text-paper/30">
              Payee signature
            </span>
            <p className="mt-1 text-paper/55">
              {review.payeeSignature
                ? "Verified packet ✓"
                : "Waiting"}
            </p>
          </div>
        </div>
      )}

      {review.payerSignature &&
        review.payeeSignature &&
        !review.result && (
          <div className="mt-3 rounded-xl border border-signal/15 bg-signal/[0.035] px-4 py-3">
            <p className="text-xs font-medium text-signal">
              {busy
                ? "Agent reviewing dispute…"
                : "Both signatures verified"}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-paper/40">
              Agent arbitration starts automatically.
            </p>
          </div>
        )}

      {review.result && (
        <div className="mt-3 rounded-xl border border-signal/20 bg-signal/[0.035] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-medium text-signal">
              Agent decision
            </p>
            <span className="text-[9px] uppercase tracking-[0.1em] text-paper/30">
              {review.result.execution.status ===
                "authorized" ||
              review.result.execution.status ===
                "already_authorized"
                ? "Split authorized"
                : review.result.policy.status ===
                    "NEEDS_REVIEW"
                  ? "Needs review"
                  : "Policy checked"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-paper/[0.03] p-2.5">
              <p className="text-[9px] text-paper/30">
                Payer
              </p>
              <p className="mt-1 text-sm font-medium text-paper/75">
                {percent(
                  review.result
                    .decision.payerBps,
                )}
              </p>
            </div>
            <div className="rounded-lg bg-paper/[0.03] p-2.5">
              <p className="text-[9px] text-paper/30">
                Payee
              </p>
              <p className="mt-1 text-sm font-medium text-paper/75">
                {percent(
                  review.result
                    .decision.payeeBps,
                )}
              </p>
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-paper/50">
            {review.result
              .decision.reason}
          </p>

          <p className="mt-2 text-[9px] text-paper/28">
            Policy:{" "}
            {review.result
              .policy.status}
            {" · "}
            Execution disabled
          </p>
        </div>
      )}
    </div>
  );
}
