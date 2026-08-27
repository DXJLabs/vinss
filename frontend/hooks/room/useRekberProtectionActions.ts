"use client";

import type {
  EscrowActionPayload,
  SendActionResult,
} from "@/types/deal-room";
import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import {
  autoReleaseEscrow,
  claimRekberResolution,
  computePayeeRefundConsentCommitment,
  confirmRekberFulfillment,
  mutualRefundEscrow,
  openRekberDispute,
  type RekberCustodyState,
  type SettlementRole,
} from "@/lib/deal-room/settlement";
import type {
  StoredRekberSecrets,
} from "@/lib/deal-room/rekberSecrets";
import {
  computeRekberDisputeEvidenceCommitment,
} from "@/lib/deal-room/rekberEvidence";
import {
  canAuthorizeMutualRefundConsent,
  canAutoReleaseRekber,
  canClaimRekberResolution,
  canCompleteMutualRefund,
  canConfirmCounterpartyFulfillment,
  canOpenRekberDispute,
} from "@/lib/deal-room/rekberProtection";
import {
  humanizeError,
} from "@/lib/errors/uiError";

interface UseRekberProtectionActionsOptions {
  session: VinssWalletSession | null;
  custodyCommitment: bigint;
  state: RekberCustodyState;
  role: SettlementRole | null;
  secrets: StoredRekberSecrets | null;

  // Private coordination is injected by the room hook. This keeps routing,
  // ECDH, Ready X recovery, and discovery out of the protection domain hook.
  dealOfferLocator: string;
  peerAddress: string;
  privateDisputeAction: EscrowActionPayload | null;
  mutualRefundConsentAction: EscrowActionPayload | null;
  onSendCoordination: (
    peerAddress: string,
    payload: EscrowActionPayload,
  ) => Promise<SendActionResult>;

  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export function useRekberProtectionActions({
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
}: UseRekberProtectionActionsOptions) {
  const nowSeconds =
    Math.floor(Date.now() / 1000);

  const canConfirm =
    canConfirmCounterpartyFulfillment(
      state,
      role,
    );
  const canDispute =
    canOpenRekberDispute(
      state,
      nowSeconds,
    );
  const canAutoRelease =
    canAutoReleaseRekber(
      state,
      role,
      nowSeconds,
    );
  const canClaimResolution =
    canClaimRekberResolution(
      state,
      role,
    );
  const canAuthorizeMutualRefund =
    canAuthorizeMutualRefundConsent(
      state,
      role,
    );
  const canCompleteMutualRefundNow =
    canCompleteMutualRefund(
      state,
      role,
    );

  const hasPrivateDisputeEvidence =
    Boolean(
      privateDisputeAction?.reason?.trim() &&
        privateDisputeAction
          .disputeEvidenceCommitment,
    );

  let validMutualRefundConsentSecret:
    bigint | null = null;

  const consentSecretRaw =
    mutualRefundConsentAction
      ?.payeeRefundConsentSecret;

  if (consentSecretRaw) {
    try {
      const candidate =
        BigInt(consentSecretRaw);

      if (
        computePayeeRefundConsentCommitment(
          custodyCommitment,
          candidate,
        ) ===
        state.payeeRefundConsentCommitment
      ) {
        validMutualRefundConsentSecret =
          candidate;
      }
    } catch {
      // Ignore malformed/stale encrypted coordination.
    }
  }

  const hasValidMutualRefundConsent =
    validMutualRefundConsentSecret !== null;

  async function run(
    fallback: string,
    action: () => Promise<unknown>,
  ): Promise<boolean> {
    if (!session) {
      setError(
        "Connect the settlement wallet first.",
      );
      return false;
    }

    setBusy(true);
    setError(null);

    try {
      await action();
      return true;
    } catch (error) {
      setError(
        humanizeError(
          error,
          fallback,
        ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmFulfillment():
    Promise<boolean> {
    if (
      !canConfirm ||
      !secrets?.payerConfirmationSecret ||
      state.fulfillmentEvidenceCommitment === 0n
    ) {
      return false;
    }

    return run(
      "We couldn't confirm this fulfillment.",
      () =>
        confirmRekberFulfillment(
          session!.account,
          {
            custodyCommitment,
            confirmationSecret:
              BigInt(
                secrets
                  .payerConfirmationSecret!,
              ),
            evidenceCommitment:
              state
                .fulfillmentEvidenceCommitment,
          },
        ),
    );
  }

  async function shareDisputeEvidence(
    reason: string,
  ): Promise<boolean> {
    const cleanReason =
      reason.trim();

    if (
      !canDispute ||
      !role ||
      !cleanReason ||
      !peerAddress ||
      !dealOfferLocator
    ) {
      if (!cleanReason) {
        setError(
          "Add a short dispute reason first.",
        );
      }
      return false;
    }

    const evidenceCommitment =
      await computeRekberDisputeEvidenceCommitment({
        custodyCommitment,
        role,
        fulfillmentEvidenceCommitment:
          state.fulfillmentEvidenceCommitment,
        reason: cleanReason,
      });

    /*
     * This is intentionally step 1/2. Ready X/STRK20 should not immediately
     * open a second private transaction in the same callback lifecycle.
     */
    return run(
      "We couldn't share the private dispute evidence.",
      () =>
        onSendCoordination(
          peerAddress,
          {
            kind: "dispute",
            coordinationVersion: 3,
            dealOfferLocator,
            custodyCommitment:
              custodyCommitment.toString(),
            disputeEvidenceCommitment:
              evidenceCommitment.toString(),
            reason: cleanReason,
          },
        ),
    );
  }

  async function lockDispute():
    Promise<boolean> {
    if (
      !canDispute ||
      !role ||
      !hasPrivateDisputeEvidence
    ) {
      return false;
    }

    const disputeSecret =
      role === "payer"
        ? secrets?.payerDisputeSecret
        : secrets?.payeeDisputeSecret;

    if (!disputeSecret) {
      setError(
        "This wallet is missing its Rekber dispute capability.",
      );
      return false;
    }

    const reason =
      privateDisputeAction!.reason!.trim();

    const expectedCommitment =
      await computeRekberDisputeEvidenceCommitment({
        custodyCommitment,
        role,
        fulfillmentEvidenceCommitment:
          state.fulfillmentEvidenceCommitment,
        reason,
      });

    let sharedCommitment: bigint;

    try {
      sharedCommitment =
        BigInt(
          privateDisputeAction!
            .disputeEvidenceCommitment!,
        );
    } catch {
      setError(
        "The encrypted dispute evidence commitment is invalid.",
      );
      return false;
    }

    if (
      sharedCommitment !==
      expectedCommitment
    ) {
      setError(
        "The encrypted dispute reason does not match its commitment.",
      );
      return false;
    }

    // Step 2/2: only the same commitment is exposed to Rekber.
    return run(
      "We couldn't lock the Rekber dispute.",
      () =>
        openRekberDispute(
          session!.account,
          {
            custodyCommitment,
            role,
            disputeSecret:
              BigInt(disputeSecret),
            evidenceCommitment:
              expectedCommitment,
          },
        ),
    );
  }

  async function autoRelease():
    Promise<boolean> {
    if (
      !canAutoRelease ||
      !secrets?.payeeClaimSecret
    ) {
      return false;
    }

    return run(
      "We couldn't claim after the review timeout.",
      () =>
        autoReleaseEscrow(
          session!.account,
          {
            custodyCommitment,
            payeeClaimSecret:
              BigInt(
                secrets.payeeClaimSecret!,
              ),
          },
        ),
    );
  }

  async function claimResolution():
    Promise<boolean> {
    if (
      !canClaimResolution ||
      !role
    ) {
      return false;
    }

    const partySecret =
      role === "payer"
        ? secrets?.refundSecret
        : secrets?.payeeClaimSecret;

    if (!partySecret) {
      setError(
        "This wallet is missing its Rekber resolution claim capability.",
      );
      return false;
    }

    return run(
      "We couldn't claim the authorized dispute resolution.",
      () =>
        claimRekberResolution(
          session!.account,
          {
            custodyCommitment,
            role,
            partySecret:
              BigInt(partySecret),
          },
        ),
    );
  }

  async function authorizeMutualRefund():
    Promise<boolean> {
    if (
      !canAuthorizeMutualRefund ||
      !peerAddress ||
      !dealOfferLocator ||
      !secrets?.payeeRefundConsentSecret
    ) {
      return false;
    }

    /*
     * Sharing this preimage is the Payee's explicit refund authorization.
     * It stays encrypted peer-to-peer; the Payer still needs a separate
     * Ready X confirmation to consume custody through MUTUAL_REFUND.
     */
    return run(
      "We couldn't share the mutual refund authorization.",
      () =>
        onSendCoordination(
          peerAddress,
          {
            kind: "refund",
            coordinationVersion: 3,
            dealOfferLocator,
            custodyCommitment:
              custodyCommitment.toString(),
            payeeRefundConsentSecret:
              secrets
                .payeeRefundConsentSecret,
            reason:
              "Payee authorized a full mutual principal refund.",
          },
        ),
    );
  }

  async function completeMutualRefund():
    Promise<boolean> {
    if (
      !canCompleteMutualRefundNow ||
      !validMutualRefundConsentSecret ||
      !secrets?.refundSecret
    ) {
      return false;
    }

    return run(
      "We couldn't complete the mutual refund.",
      () =>
        mutualRefundEscrow(
          session!.account,
          {
            custodyCommitment,
            refundSecret:
              BigInt(
                secrets.refundSecret!,
              ),
            payeeRefundConsentSecret:
              validMutualRefundConsentSecret!,
          },
        ),
    );
  }

  return {
    canConfirm,
    canDispute,
    canAutoRelease,
    canClaimResolution,
    canAuthorizeMutualRefund,
    canCompleteMutualRefund:
      canCompleteMutualRefundNow,
    hasPrivateDisputeEvidence,
    hasValidMutualRefundConsent,
    confirmFulfillment,
    shareDisputeEvidence,
    lockDispute,
    autoRelease,
    claimResolution,
    authorizeMutualRefund,
    completeMutualRefund,
  };
}
