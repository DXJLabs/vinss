"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  VinssWalletSession,
} from "@/lib/starknet/walletClient";
import type {
  DisputeAgentPartyPacket,
  EscrowActionPayload,
  EscrowOfferSnapshot,
  SendActionResult,
} from "@/types/deal-room";
import type {
  RekberCustodyState,
  SettlementRole,
} from "@/lib/deal-room/settlement";
import {
  buildDisputeAgentCase,
  createDisputeAgentPacket,
  evaluateDisputeWithAgent,
  findLatestDisputeAgentPacket,
  findLatestDisputeAgentSignature,
  requestDisputeAgentChallenge,
  signDisputeAgentChallenge,
  type DisputeAgentResult,
  type EscrowCoordinationRecord,
} from "@/lib/deal-room/disputeAgent";
import {
  humanizeError,
} from "@/lib/errors/uiError";

interface UseDisputeAgentReviewOptions {
  session: VinssWalletSession | null;
  state: RekberCustodyState;
  custodyCommitment: bigint;
  role: SettlementRole | null;
  payerAddress: string;
  payeeAddress: string;
  dealOfferLocator: string;
  offerSnapshot: EscrowOfferSnapshot | null;
  escrowActions:
    readonly EscrowCoordinationRecord[];
  peerAddress: string;
  onSendCoordination: (
    peerAddress: string,
    payload: EscrowActionPayload,
  ) => Promise<SendActionResult>;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
}

export function useDisputeAgentReview({
  session,
  state,
  custodyCommitment,
  role,
  payerAddress,
  payeeAddress,
  dealOfferLocator,
  offerSnapshot,
  escrowActions,
  peerAddress,
  onSendCoordination,
  setBusy,
  setError,
}: UseDisputeAgentReviewOptions) {
  const [
    result,
    setResult,
  ] =
    useState<DisputeAgentResult | null>(
      null,
    );

  const payerRecord =
    useMemo(
      () =>
        findLatestDisputeAgentPacket(
          escrowActions,
          custodyCommitment,
          payerAddress,
        ),
      [
        escrowActions,
        custodyCommitment,
        payerAddress,
      ],
    );

  const payeeRecord =
    useMemo(
      () =>
        findLatestDisputeAgentPacket(
          escrowActions,
          custodyCommitment,
          payeeAddress,
        ),
      [
        escrowActions,
        custodyCommitment,
        payeeAddress,
      ],
    );

  const payerPacket =
    payerRecord?.action
      .disputeAgentPacket ??
    null;
  const payeePacket =
    payeeRecord?.action
      .disputeAgentPacket ??
    null;

  const disputeCase =
    useMemo(() => {
      if (
        !offerSnapshot ||
        !payerPacket ||
        !payeePacket
      ) {
        return null;
      }

      return buildDisputeAgentCase({
        custodyCommitment,
        state,
        offerSnapshot,
        payerPacket,
        payeePacket,
      });
    }, [
      custodyCommitment,
      offerSnapshot,
      payerPacket,
      payeePacket,
      state,
    ]);

  const [
    caseCommitment,
    setCaseCommitment,
  ] = useState("");

  const payerSignature =
    caseCommitment
      ? findLatestDisputeAgentSignature(
          escrowActions,
          custodyCommitment,
          payerAddress,
          caseCommitment,
        )?.action
          .disputeAgentSignature ??
        null
      : null;

  const payeeSignature =
    caseCommitment
      ? findLatestDisputeAgentSignature(
          escrowActions,
          custodyCommitment,
          payeeAddress,
          caseCommitment,
        )?.action
          .disputeAgentSignature ??
        null
      : null;

  async function run(
    fallback: string,
    action: () => Promise<void>,
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

  async function submitEvidence(
    statement: string,
  ): Promise<boolean> {
    if (
      !role ||
      !peerAddress ||
      !dealOfferLocator
    ) {
      return false;
    }

    return run(
      "We couldn't share your Agent evidence.",
      async () => {
        const packet =
          createDisputeAgentPacket(
            role,
            session!.account
              .address,
            statement,
          );

        await onSendCoordination(
          peerAddress,
          {
            kind: "dispute",
            coordinationVersion: 3,
            dealOfferLocator,
            custodyCommitment:
              custodyCommitment.toString(),
            disputeAgentPacket:
              packet,
          },
        );

        // New evidence invalidates old local evaluation display.
        setResult(null);
        setCaseCommitment("");
      },
    );
  }

  async function signReview():
    Promise<boolean> {
    if (
      !role ||
      !disputeCase ||
      !peerAddress
    ) {
      return false;
    }

    return run(
      "We couldn't sign the Dispute Agent review.",
      async () => {
        /*
         * Backend checks live Rekber state before issuing the typed-data
         * challenge. This signature is consent to Agent review, not consent to
         * the Agent's eventual decision.
         */
        const challenge =
          await requestDisputeAgentChallenge(
            disputeCase,
          );

        const signature =
          await signDisputeAgentChallenge(
            session!.account,
            challenge.typedData[
              role
            ],
          );

        setCaseCommitment(
          challenge
            .caseCommitment,
        );

        await onSendCoordination(
          peerAddress,
          {
            kind: "dispute",
            coordinationVersion: 3,
            dealOfferLocator,
            custodyCommitment:
              custodyCommitment.toString(),
            disputeAgentCaseCommitment:
              challenge
                .caseCommitment,
            disputeAgentSignature:
              signature,
          },
        );
      },
    );
  }

  async function evaluate():
    Promise<boolean> {
    if (
      !disputeCase ||
      !payerSignature ||
      !payeeSignature
    ) {
      return false;
    }

    return run(
      "The Dispute Agent couldn't evaluate this case.",
      async () => {
        const next =
          await evaluateDisputeWithAgent(
            disputeCase,
            {
              payer:
                payerSignature,
              payee:
                payeeSignature,
            },
          );

        /*
         * D2.1 is deliberately fail-closed: this result is advisory only and
         * cannot execute or authorize a resolver transaction.
         */
        setResult(next);
      },
    );
  }

  const ownPacket =
    role === "payer"
      ? payerPacket
      : role === "payee"
        ? payeePacket
        : null;

  const bothPackets =
    Boolean(
      payerPacket &&
      payeePacket,
    );

  const ownSignature =
    role === "payer"
      ? payerSignature
      : role === "payee"
        ? payeeSignature
        : null;

  return {
    result,
    ownPacket,
    payerPacket,
    payeePacket,
    bothPackets,
    caseCommitment,
    ownSignature,
    payerSignature,
    payeeSignature,
    submitEvidence,
    signReview,
    evaluate,
  };
}
