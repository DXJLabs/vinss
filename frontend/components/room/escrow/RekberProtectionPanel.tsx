"use client";

import {
  useState,
} from "react";
import type {
  EscrowActionPayload,
  EscrowOfferSnapshot,
  SendActionResult,
} from "@/types/deal-room";
import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import type {
  RekberCustodyState,
  SettlementRole,
} from "@/lib/deal-room/settlement";
import type {
  StoredRekberSecrets,
} from "@/lib/deal-room/rekberSecrets";
import {
  useRekberProtectionActions,
} from "@/hooks/room/useRekberProtectionActions";
import {
  DisputeAgentReview,
} from "@/components/room/escrow/DisputeAgentReview";
import type {
  EscrowCoordinationRecord,
} from "@/lib/deal-room/disputeAgent";

interface RekberProtectionPanelProps {
  session: VinssWalletSession | null;
  custodyCommitment: bigint;
  state: RekberCustodyState;
  role: SettlementRole | null;
  secrets: StoredRekberSecrets | null;
  dealOfferLocator: string;
  payerAddress: string;
  payeeAddress: string;
  offerSnapshot: EscrowOfferSnapshot | null;
  rekberSetup: EscrowActionPayload | null;
  rekberAcceptance: EscrowActionPayload | null;
  escrowActions:
    readonly EscrowCoordinationRecord[];
  peerAddress: string;
  privateDisputeAction: EscrowActionPayload | null;
  mutualRefundConsentAction: EscrowActionPayload | null;
  onSendCoordination: (
    peerAddress: string,
    payload: EscrowActionPayload,
  ) => Promise<SendActionResult>;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export function RekberProtectionPanel({
  session,
  custodyCommitment,
  state,
  role,
  secrets,
  dealOfferLocator,
  payerAddress,
  payeeAddress,
  offerSnapshot,
  rekberSetup,
  rekberAcceptance,
  escrowActions,
  peerAddress,
  privateDisputeAction,
  mutualRefundConsentAction,
  onSendCoordination,
  busy,
  setBusy,
  setError,
}: RekberProtectionPanelProps) {
  const [
    disputeOpen,
    setDisputeOpen,
  ] = useState(false);
  const [
    disputeReason,
    setDisputeReason,
  ] = useState("");

  const actions =
    useRekberProtectionActions({
      session,
      custodyCommitment,
      state,
      role,
      secrets,
      dealOfferLocator,
      peerAddress,
      privateDisputeAction,
      mutualRefundConsentAction,
      onSendCoordination,
      setBusy,
      setError,
    });

  if (state.consumed) {
    return null;
  }

  const mutualRefund = (
    <div className="mt-3 border-t border-wire/50 pt-3">
      {role === "payee" &&
        actions.canAuthorizeMutualRefund && (
          actions.hasValidMutualRefundConsent ? (
            <div className="rounded-lg bg-paper/[0.025] px-3 py-2.5">
              <p className="text-[10px] text-paper/55">
                Full refund authorized ✓
              </p>
              <p className="mt-1 text-[9px] leading-relaxed text-paper/28">
                The Payer can now return the full principal while this custody remains open.
              </p>
            </div>
          ) : (
            <details className="group">
              <summary className="cursor-pointer list-none text-[10px] text-paper/45 [&::-webkit-details-marker]:hidden">
                Mutual cancellation ▾
              </summary>
              <p className="mt-2 text-[9px] leading-relaxed text-amber/70">
                Authorizing a full refund reveals your precommitted refund-consent secret to the Payer through encrypted coordination. Treat this as an explicit, non-revocable authorization while the custody remains open.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void actions
                    .authorizeMutualRefund()
                }
                className="mt-3 w-full rounded-xl border border-amber/30 px-4 py-3 text-xs font-medium text-amber disabled:opacity-30"
              >
                {busy
                  ? "Sharing authorization…"
                  : "Authorize full refund →"}
              </button>
            </details>
          )
        )}

      {role === "payer" &&
        actions.canCompleteMutualRefund &&
        actions.hasValidMutualRefundConsent && (
          <div className="rounded-lg border border-amber/20 bg-amber/[0.035] p-3">
            <p className="text-xs font-medium text-paper/70">
              Payee authorized a full refund
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-paper/38">
              Completing this returns the entire principal to the Payer. The VINSS service fee remains non-refundable.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void actions
                  .completeMutualRefund()
              }
              className="mt-3 w-full rounded-xl border border-amber/35 px-4 py-3 text-xs font-medium text-amber disabled:opacity-30"
            >
              {busy
                ? "Refunding in Ready X…"
                : "Complete mutual refund →"}
            </button>
          </div>
        )}
    </div>
  );

  /*
   * Dispute allocations are authoritative on-chain settlement state.
   *
   * Once a dispute is locked, the normal release/refund lifecycle is paused.
   * The resolver may authorize any valid Payer/Payee split, including
   * 100/0, 50/50, or 0/100.
   *
   * A 100% Payer allocation may be described as a full refund in the UI,
   * while the contract still settles it through the resolution-claim path.
   */
  const payerResolutionBps =
    state.amount > 0n
      ? (
          state.resolutionPayerAmount *
          10_000n
        ) / state.amount
      : 0n;

  const payeeResolutionBps =
    state.amount > 0n
      ? (
          state.resolutionPayeeAmount *
          10_000n
        ) / state.amount
      : 0n;

  const ownResolutionAmount =
    role === "payer"
      ? state.resolutionPayerAmount
      : role === "payee"
        ? state.resolutionPayeeAmount
        : 0n;

  const ownResolutionClaimed =
    role === "payer"
      ? state.resolutionPayerClaimed
      : role === "payee"
        ? state.resolutionPayeeClaimed
        : false;

  function formatResolutionPercent(
    bps: bigint,
  ): string {
    const value =
      Number(bps) / 100;

    return Number.isInteger(value)
      ? `${value}%`
      : `${value.toFixed(2)}%`;
  }

  /*
   * Keep dispute UX separate from normal Rekber refund UX.
   *
   * Before authorization, custody remains locked for dispute resolution.
   * After authorization, show the exact Payer/Payee allocation and only the
   * resolution claim available to the connected wallet.
   */
  if (state.disputed) {
    return (
      <div className="rounded-xl border border-amber/25 bg-amber/[0.04] p-4">
        <p className="text-[9px] uppercase tracking-[0.13em] text-amber">
          {state.resolutionAuthorized
            ? "Dispute resolution"
            : "Dispute locked"}
        </p>

        <p className="mt-2 text-xs leading-relaxed text-paper/45">
          {state.resolutionAuthorized
            ? "Normal refund and release remain paused. Funds can move only through the authorized dispute allocation."
            : "Normal release, auto-release, and unilateral timeout refund are paused while this custody is disputed."}
        </p>

        {state.resolutionAuthorized && (
          <div className="mt-3 rounded-lg bg-paper/[0.025] p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[8px] uppercase tracking-[0.1em] text-paper/25">
                  Payer
                </p>
                <p className="mt-1 text-sm font-medium text-paper/75">
                  {formatResolutionPercent(
                    payerResolutionBps,
                  )}
                </p>
              </div>

              <div>
                <p className="text-[8px] uppercase tracking-[0.1em] text-paper/25">
                  Payee
                </p>
                <p className="mt-1 text-sm font-medium text-paper/75">
                  {formatResolutionPercent(
                    payeeResolutionBps,
                  )}
                </p>
              </div>
            </div>

            {/*
             * A 100/0 dispute award is a full refund from the user's point of
             * view, even though the contract executes it as a resolution claim.
             */}
            {state.resolutionPayerAmount ===
              state.amount &&
              state.resolutionPayeeAmount ===
                0n && (
                <p className="mt-2 border-t border-wire/40 pt-2 text-[10px] text-signal/80">
                  Full refund awarded to Payer
                </p>
              )}
          </div>
        )}

        {state.resolutionAuthorized ? (
          actions.canClaimResolution ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void actions.claimResolution()
              }
              className="mt-3 w-full rounded-xl border border-signal/35 px-4 py-3 text-xs font-medium text-signal disabled:opacity-30"
            >
              {busy
                ? "Claiming resolution…"
                : "Claim my resolution share →"}
            </button>
          ) : ownResolutionAmount > 0n &&
            ownResolutionClaimed ? (
            <p className="mt-3 rounded-lg bg-signal/[0.05] px-3 py-2.5 text-[10px] text-signal">
              Your resolution share has been claimed ✓
            </p>
          ) : ownResolutionAmount === 0n ? (
            <p className="mt-3 text-[10px] text-paper/35">
              No dispute funds were allocated to this wallet.
            </p>
          ) : (
            <p className="mt-3 text-[10px] text-paper/35">
              This wallet has an allocation, but its claim capability is not available on this device.
            </p>
          )
        ) : (
          <p className="mt-3 text-[10px] text-paper/35">
            Waiting for an authorized Payer/Payee resolution split.
          </p>
        )}

        <DisputeAgentReview
          session={session}
          state={state}
          custodyCommitment={
            custodyCommitment
          }
          role={role}
          payerAddress={
            payerAddress
          }
          payeeAddress={
            payeeAddress
          }
          dealOfferLocator={
            dealOfferLocator
          }
          offerSnapshot={
            offerSnapshot
          }
          rekberSetup={
            rekberSetup
          }
          rekberAcceptance={
            rekberAcceptance
          }
          escrowActions={
            escrowActions
          }
          peerAddress={
            peerAddress
          }
          onSendCoordination={
            onSendCoordination
          }
          busy={busy}
          setBusy={setBusy}
          setError={setError}
        />

        {!state.resolutionAuthorized &&
          mutualRefund}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-paper/[0.02] p-4 ring-1 ring-wire/55">
      <div>
        <p className="text-[9px] uppercase tracking-[0.13em] text-paper/32">
          Rekber protection
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-paper/35">
          Fulfillment changes settlement rights. Confirm only what you actually received; disagreement should enter dispute instead of using a unilateral refund.
        </p>
      </div>

      {actions.canConfirm && (
        <div className="mt-3 rounded-lg border border-signal/20 bg-signal/[0.035] p-3">
          <p className="text-xs font-medium text-paper/70">
            Fulfillment submitted
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-paper/38">
            This verification policy requires your explicit receipt confirmation before the review window starts.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void actions.confirmFulfillment()
            }
            className="mt-3 w-full rounded-xl bg-signal px-4 py-3 text-xs font-medium text-ink disabled:opacity-30"
          >
            {busy
              ? "Confirming in Ready X…"
              : "Confirm received →"}
          </button>
        </div>
      )}

      {actions.canAutoRelease && (
        <div className="mt-3 rounded-lg border border-signal/20 bg-signal/[0.035] p-3">
          <p className="text-xs font-medium text-paper/70">
            Review window finished
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-paper/38">
            Confirmed fulfillment cannot be locked forever by Payer silence.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void actions.autoRelease()
            }
            className="mt-3 w-full rounded-xl bg-signal px-4 py-3 text-xs font-medium text-ink disabled:opacity-30"
          >
            {busy
              ? "Claiming in Ready X…"
              : "Claim after review timeout →"}
          </button>
        </div>
      )}

      {actions.canDispute && (
        <div className="mt-3 border-t border-wire/50 pt-3">
          {actions.hasPrivateDisputeEvidence ? (
            <div className="rounded-lg border border-danger/20 bg-danger/[0.025] p-3">
              <p className="text-[10px] font-medium text-danger">
                Private dispute evidence shared ✓
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[10px] leading-relaxed text-paper/38">
                {privateDisputeAction?.reason}
              </p>
              <p className="mt-2 text-[9px] leading-relaxed text-paper/25">
                Step 2/2 locks only this evidence commitment on-chain.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void actions.lockDispute()
                }
                className="mt-3 w-full rounded-xl border border-danger/35 px-4 py-3 text-xs font-medium text-danger disabled:opacity-30"
              >
                {busy
                  ? "Locking in Ready X…"
                  : "Lock dispute on-chain →"}
              </button>
            </div>
          ) : !disputeOpen ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setDisputeOpen(true)
              }
              className="w-full rounded-xl border border-danger/30 px-4 py-3 text-xs font-medium text-danger disabled:opacity-30"
            >
              Open dispute
            </button>
          ) : (
            <>
              <label className="text-[9px] uppercase tracking-[0.12em] text-paper/32">
                Dispute reason
              </label>
              <textarea
                value={disputeReason}
                onChange={(event) =>
                  setDisputeReason(
                    event.target.value,
                  )
                }
                rows={3}
                disabled={busy}
                placeholder="Describe what does not match the accepted deal…"
                className="mt-2 w-full resize-none rounded-lg border border-wire bg-transparent px-3 py-2 text-xs text-paper outline-none placeholder:text-paper/20 disabled:opacity-40"
              />
              <p className="mt-1 text-[9px] leading-relaxed text-paper/25">
                Step 1/2 sends this reason only through encrypted peer coordination. It does not lock the custody yet.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDisputeOpen(false);
                    setDisputeReason("");
                  }}
                  className="rounded-xl border border-wire px-3 py-2.5 text-[10px] text-paper/45 disabled:opacity-30"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    busy ||
                    !disputeReason.trim()
                  }
                  onClick={async () => {
                    const shared =
                      await actions
                        .shareDisputeEvidence(
                          disputeReason,
                        );

                    if (shared) {
                      setDisputeOpen(false);
                      setDisputeReason("");
                    }
                  }}
                  className="rounded-xl border border-danger/35 px-3 py-2.5 text-[10px] font-medium text-danger disabled:opacity-30"
                >
                  {busy
                    ? "Sharing…"
                    : "Share evidence →"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {mutualRefund}
    </div>
  );
}
