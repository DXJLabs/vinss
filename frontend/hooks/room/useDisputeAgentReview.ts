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
  getDisputeAgentAttestationStatus,
  requestDisputeAgentChallenge,
  signDisputeAgentChallenge,
  submitDisputeAgentAttestation,
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

  const [
    challengeLoading,
    setChallengeLoading,
  ] = useState(false);

  const [
    challengeError,
    setChallengeError,
  ] = useState("");

  /*
   * Rekber custody is polled frequently and therefore `state` may receive a
   * new object identity even when every relevant value is unchanged.
   * Serialize only the actual challenge input so identical cases do not
   * continuously cancel/restart the backend challenge request.
   */
  const challengeInputKey =
    useMemo(
      () =>
        disputeCase && binding
          ? JSON.stringify({
              case: disputeCase,
              binding,
            })
          : "",
      [
        disputeCase,
        binding,
      ],
    );

  const challengeRequestKeyRef =
    useRef("");

  const challengeReady =
    Boolean(
      challenge &&
      challengeInputKey &&
      challengeRequestKeyRef.current ===
        challengeInputKey,
    );

  const caseCommitment =
    challengeReady
      ? challenge!.caseCommitment
      : "";

  async function prepareChallenge(
    force = false,
  ): Promise<boolean> {
    if (
      !session ||
      !disputeCase ||
      !binding ||
      !challengeInputKey
    ) {
      return false;
    }

    if (
      !force &&
      challengeRequestKeyRef.current ===
        challengeInputKey
    ) {
      return challengeReady;
    }

    const requestKey =
      challengeInputKey;

    challengeRequestKeyRef.current =
      requestKey;

    setChallenge(null);
    setChallengeLoading(true);
    setChallengeError("");

    try {
      const next =
        await requestDisputeAgentChallenge(
          disputeCase,
          binding,
        );

      if (
        challengeRequestKeyRef.current !==
        requestKey
      ) {
        return false;
      }

      setChallenge(next);
      return true;
    } catch (error) {
      if (
        challengeRequestKeyRef.current ===
        requestKey
      ) {
        setChallengeError(
          humanizeError(
            error,
            "Secure Agent signing challenge is unavailable.",
          ),
        );
      }

      return false;
    } finally {
      if (
        challengeRequestKeyRef.current ===
        requestKey
      ) {
        setChallengeLoading(false);
      }
    }
  }

  /*
   * Prefetch exactly once for each distinct case. If custody polling returns
   * an identical case one second later, challengeInputKey stays identical.
   */
  useEffect(() => {
    if (
      !session ||
      !challengeInputKey
    ) {
      challengeRequestKeyRef.current =
        "";
      setChallenge(null);
      setChallengeLoading(false);
      setChallengeError("");
      return;
    }

    if (
      challengeRequestKeyRef.current ===
        challengeInputKey
    ) {
      return;
    }

    void prepareChallenge();
  }, [
    session?.account.address,
    challengeInputKey,
  ]);

  /*
   * Legacy room signatures are still discovered once so existing mainnet
   * cases can migrate without asking either party to sign or pay again.
   */
  const legacyPayerSignature =
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

  const legacyPayeeSignature =
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

  const [
    attestationStatus,
    setAttestationStatus,
  ] = useState({
    payerSigned: false,
    payeeSigned: false,
  });

  const attestationCaseRef =
    useRef("");

  const migratedLegacyRef =
    useRef<Set<string>>(
      new Set(),
    );

  const legacySignatureKey =
    [
      legacyPayerSignature
        ?.join(":") ?? "",
      legacyPayeeSignature
        ?.join(":") ?? "",
    ].join("|");

  /*
   * Signature presence is now synchronized from backend storage, not from a
   * paid STRK20 coordination transaction.
   *
   * Old coordination signatures are verified and imported once. Status
   * polling returns only booleans; peer signature bytes are never exposed.
   */
  useEffect(() => {
    if (
      !caseCommitment ||
      !disputeCase ||
      !binding
    ) {
      attestationCaseRef.current =
        "";
      setAttestationStatus({
        payerSigned: false,
        payeeSigned: false,
      });
      return;
    }

    if (
      attestationCaseRef.current !==
      caseCommitment
    ) {
      attestationCaseRef.current =
        caseCommitment;
      setAttestationStatus({
        payerSigned: false,
        payeeSigned: false,
      });
    }

    let cancelled = false;

    async function migrate(
      role:
        | "payer"
        | "payee",
      signature:
        string[] | null,
    ) {
      if (!signature) {
        return;
      }

      const key =
        `${caseCommitment}:${role}:` +
        signature.join(":");

      if (
        migratedLegacyRef.current
          .has(key)
      ) {
        return;
      }

      await submitDisputeAgentAttestation(
        disputeCase!,
        binding!,
        role,
        signature,
      );

      migratedLegacyRef.current
        .add(key);
    }

    async function syncStatus() {
      try {
        await migrate(
          "payer",
          legacyPayerSignature,
        );
        await migrate(
          "payee",
          legacyPayeeSignature,
        );

        const next =
          await getDisputeAgentAttestationStatus(
            disputeCase!,
            binding!,
          );

        if (!cancelled) {
          setAttestationStatus({
            payerSigned:
              next.payerSigned,
            payeeSigned:
              next.payeeSigned,
          });
        }
      } catch {
        /*
         * Background status synchronization is retried. Explicit signing
         * failures are surfaced by signReview() instead of creating popup
         * loops or duplicate wallet transactions.
         */
      }
    }

    void syncStatus();

    const timer =
      window.setInterval(
        () => {
          void syncStatus();
        },
        3_000,
      );

    return () => {
      cancelled = true;
      window.clearInterval(
        timer,
      );
    };
  }, [
    caseCommitment,
    challengeInputKey,
    legacySignatureKey,
  ]);

  /*
   * Keep the existing component contract: UI only needs truthiness for signed
   * state. Evaluation itself reads the real verified signatures server-side.
   */
  const storedMarker = [
    "0x1",
    "0x1",
  ];

  const payerSignature =
    legacyPayerSignature ??
    (
      attestationStatus
        .payerSigned
        ? storedMarker
        : null
    );

  const payeeSignature =
    legacyPayeeSignature ??
    (
      attestationStatus
        .payeeSigned
        ? storedMarker
        : null
    );

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
      !challengeReady ||
      !challenge
    ) {
      return false;
    }

    return run(
      "We couldn't sign the Dispute Agent review.",
      async () => {
        /*
         * One wallet signature only.
         *
         * No STRK20 transaction follows this signature. The backend verifies
         * the exact SNIP-12 case, original Rekber role and live custody before
         * persisting the attestation.
         */
        const signature =
          await signDisputeAgentChallenge(
            session!.account,
            challenge.typedData[
              role
            ],
          );

        const next =
          await submitDisputeAgentAttestation(
            disputeCase,
            binding,
            role,
            signature,
          );

        if (
          next.caseCommitment !==
          challenge.caseCommitment
        ) {
          throw new Error(
            "Dispute case commitment changed while signing.",
          );
        }

        setAttestationStatus({
          payerSigned:
            next.payerSigned,
          payeeSigned:
            next.payeeSigned,
        });
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
            binding,
          );

        /*
         * The Agent has no signer. Any on-chain authorization can occur only
         * through the backend's deterministic policy gate and dedicated
         * resolver.
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

  const reviewReady =
    Boolean(
      disputeCase &&
      binding &&
      challengeReady,
    );

  return {
    result,
    disputeCase,
    ownPacket,
    payerPacket,
    payeePacket,
    bothPackets,
    reviewReady,
    challengeLoading,
    challengeError,
    retryChallenge: () =>
      prepareChallenge(true),
    caseCommitment,
    ownSignature,
    payerSignature,
    payeeSignature,
    submitEvidence,
    signReview,
    evaluate,
  };
}
