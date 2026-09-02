"use client";

import {
  useEffect,
  useMemo,
  useRef,
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
  buildDisputeRekberBinding,
  createDisputeAgentPacket,
  evaluateDisputeWithAgent,
  findLatestDisputeAgentPacket,
  findLatestDisputeAgentSignature,
  requestDisputeAgentChallenge,
  signDisputeAgentChallenge,
  type DisputeAgentChallenge,
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
  rekberSetup: EscrowActionPayload | null;
  rekberAcceptance: EscrowActionPayload | null;
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
  rekberSetup,
  rekberAcceptance,
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

  const binding =
    useMemo(() => {
      if (
        !rekberSetup ||
        !rekberAcceptance
      ) {
        return null;
      }

      try {
        return buildDisputeRekberBinding(
          rekberSetup,
          rekberAcceptance,
        );
      } catch {
        return null;
      }
    }, [
      rekberSetup,
      rekberAcceptance,
    ]);

  const [
    challenge,
    setChallenge,
  ] =
    useState<DisputeAgentChallenge | null>(
      null,
    );

  const caseCommitment =
    challenge?.caseCommitment ?? "";

  /*
   * Once both explicit evidence packets exist, fetch the canonical backend
   * challenge. This restores the case commitment after refresh and lets both
   * participants discover signatures for the exact same case.
   */
  useEffect(() => {
    if (
      !session ||
      !disputeCase ||
      !binding
    ) {
      setChallenge(null);
      return;
    }

    let cancelled = false;

    void requestDisputeAgentChallenge(
      disputeCase,
      binding,
    )
      .then((next) => {
        if (!cancelled) {
          setChallenge(next);
        }
      })
      .catch(() => {
        // signReview() surfaces the error if the user attempts to continue.
      });

    return () => {
      cancelled = true;
    };
  }, [
    session,
    disputeCase,
    binding,
  ]);

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
        setChallenge(null);
      },
    );
  }

  async function signReview():
    Promise<boolean> {
    if (
      !role ||
      !disputeCase ||
      !binding ||
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
        const nextChallenge =
          challenge ??
          (await requestDisputeAgentChallenge(
            disputeCase,
            binding,
          ));

        const signature =
          await signDisputeAgentChallenge(
            session!.account,
            nextChallenge.typedData[
              role
            ],
          );

        setChallenge(
          nextChallenge,
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
              nextChallenge
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
      !binding ||
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
            binding,
          );

        /*
         * The Agent has no signer. Any on-chain authorization can occur only
         * through the backend's deterministic policy gate and dedicated resolver.
         */
        setResult(next);
      },
    );
  }

  const autoEvaluationRef =
    useRef("");

  /*
   * The second verified arbitration signature is the trigger.
   *
   * Either original participant may trigger evaluation after both signatures.
   * The backend persists the first verified decision, so concurrent requests
   * converge on the same result instead of creating multiple LLM decisions.
   * If evaluation fails, room synchronization may retry without another
   * wallet signature.
   */
  useEffect(() => {
    if (
      !role ||
      !caseCommitment ||
      !payerSignature ||
      !payeeSignature ||
      result
    ) {
      return;
    }

    const key =
      `${caseCommitment}:` +
      payerSignature.join(":") +
      ":" +
      payeeSignature.join(":");

    if (
      autoEvaluationRef.current === key
    ) {
      return;
    }

    autoEvaluationRef.current = key;

    void evaluate().then((ok) => {
      if (!ok) {
        window.setTimeout(() => {
          if (
            autoEvaluationRef.current === key
          ) {
            autoEvaluationRef.current = "";
          }
        }, 5_000);
      }
    });
  }, [
    role,
    caseCommitment,
    payerSignature,
    payeeSignature,
    result,
  ]);

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
    disputeCase,
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
