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
  EscrowActionPayload,
  SendActionResult,
} from "@/types/deal-room";
import type {
  DiscoveredEscrowAction,
} from "@/hooks/room/useRoomEscrow";
import type {
  ConversationEntry,
} from "@/components/room/conversation/ConversationPanel";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";
import {
  parseSettlementAmount,
  resolveSettlementAsset,
} from "@/lib/deal-room/escrow";
import {
  claimSettlementCertificate,
  computeCertificateClaimCommitment,
  computeCertificateTokenId,
  computePayeeClaimCommitment,
  computePayeeDisputeCommitment,
  computePayeeRefundConsentCommitment,
  computePayerConfirmationCommitment,
  computePayerDisputeCommitment,
  computeRekberRefundCommitment,
  computeReleaseAuthorizationCommitment,
  depositEscrow,
  generatePayeeSettlementSecrets,
  generatePayerSettlementSecrets,
  generateRekberCustodyCommitment,
  getRekberCustody,
  getRekberProof,
  isSettlementCertificateClaimed,
  refundEscrow,
  releaseEscrow,
  type RekberCustodyState,
  type SettlementRole,
} from "@/lib/deal-room/settlement";
import {
  loadRekberSecrets,
  saveRekberSecrets,
  type StoredRekberSecrets,
} from "@/lib/deal-room/rekberSecrets";
import {
  computeDealTermsCommitment,
  REKBER_COORDINATION_VERSION,
  signRekberAcceptance,
  signRekberSetup,
  verifyRekberAcceptance,
  verifyRekberSetup,
} from "@/lib/deal-room/rekberAuthorization";
import {
  CONTRACTS,
} from "@/lib/starknet/constants";
import {
  verificationPolicyCode,
} from "@/lib/deal-room/settlementPlan";
import {
  humanizeError,
} from "@/lib/errors/uiError";
import {
  EscrowAgreedAmount,
  EscrowPriceBreakdown,
} from "@/components/room/escrow/EscrowPricing";
import {
  SettlementFeedback,
} from "@/components/room/escrow/SettlementFeedback";
import {
  RekberProtectionPanel,
} from "@/components/room/escrow/RekberProtectionPanel";
import {
  explorerUrl,
  shortAddress,
} from "@/components/room/conversation/chatFormat";
import {
  canonicalLocator,
  findLatestMutualRefundConsentAction,
  findLatestOwnDisputeEvidenceAction,
  formatDeadline,
  formatRefundDuration,
  hasCustody,
  toBigInt,
} from "@/lib/deal-room/rekberView";
import {
  formatUnits,
} from "@/lib/utils/units";

interface LocalCoordination {
  actionLocator: string;
  transactionHash: string;
  action: EscrowActionPayload;
}

interface PendingPayerSetup {
  custodyCommitment: bigint;
  secrets: StoredRekberSecrets;
  payload: EscrowActionPayload;
}

interface PendingPayeeAcceptance {
  secrets: StoredRekberSecrets;
  payload: EscrowActionPayload;
}

type CoordinationPhase =
  | "idle"
  | "payer-signature"
  | "payer-send"
  | "payee-signature"
  | "payee-send";

type RekberPendingAction =
  | "setup"
  | "accept"
  | "fund"
  | "release"
  | "claim"
  | "refund"
  | "certificate";

interface EscrowPanelProps {
  roomId: string;
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  onSent: (entry: ConversationEntry) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  acceptedOffer?: ConversationEntry | null;
  offerEntries: ConversationEntry[];
  escrowActions: DiscoveredEscrowAction[];
  onSendCoordination: (
    peerAddress: string,
    payload: EscrowActionPayload,
  ) => Promise<SendActionResult>;
}

/*
 * EscrowPanel still orchestrates the production Rekber lifecycle.
 * Phase 1 deliberately keeps signing, coordination, funding, release,
 * refund, and certificate handlers here so this refactor cannot change
 * transaction sequencing. Move them only after behavior tests stay green.
 */
export function EscrowPanel({
  roomId,
  session,
  channelKey,
  onSent,
  busy,
  setBusy,
  setError,
  acceptedOffer,
  offerEntries,
  escrowActions,
  onSendCoordination,
}: EscrowPanelProps) {
  const [refundHours, setRefundHours] =
    useState("24");

  const [refundClock, setRefundClock] =
    useState(
      Math.floor(
        Date.now() / 1000,
      ),
    );
  const [custodyCommitment, setCustodyCommitment] =
    useState<bigint | null>(null);
  const [localSecrets, setLocalSecrets] =
    useState<StoredRekberSecrets | null>(null);
  const [localCreate, setLocalCreate] =
    useState<LocalCoordination | null>(null);
  const [localAccept, setLocalAccept] =
    useState<LocalCoordination | null>(null);
  const [localRelease, setLocalRelease] =
    useState<LocalCoordination | null>(null);
  const [custodyState, setCustodyState] =
    useState<RekberCustodyState | null>(null);
  const [fundingProofTx, setFundingProofTx] =
    useState("");
  const [settlementProofTx, setSettlementProofTx] =
    useState("");
  const [certificateClaimed, setCertificateClaimed] =
    useState(false);
  const [certificateTx, setCertificateTx] =
    useState("");
  const [coordinationAuthorized, setCoordinationAuthorized] =
    useState<boolean | null>(null);
  const [coordinationPhase, setCoordinationPhase] =
    useState<CoordinationPhase>("idle");
  const [pendingPayerSetup, setPendingPayerSetup] =
    useState<PendingPayerSetup | null>(null);
  const [pendingPayeeAcceptance, setPendingPayeeAcceptance] =
    useState<PendingPayeeAcceptance | null>(null);
  const coordinationLockRef =
    useRef(false);

  const [
    pendingRekberAction,
    setPendingRekberAction,
  ] = useState<RekberPendingAction | null>(
    null,
  );

  const pendingRekberActionRef =
    useRef<RekberPendingAction | null>(
      null,
    );

  function beginRekberAction(
    action: RekberPendingAction,
  ) {
    pendingRekberActionRef.current =
      action;
    setPendingRekberAction(action);
    setBusy(true);
  }

  function finishRekberAction(
    action: RekberPendingAction,
  ) {
    // An older delayed Ready X callback must never
    // unlock a newer Rekber action.
    if (
      pendingRekberActionRef.current !==
      action
    ) {
      return;
    }

    pendingRekberActionRef.current =
      null;
    setPendingRekberAction(null);
    setBusy(false);
  }

  const acceptedAction =
    acceptedOffer?.offerAction;
  const accepted =
    acceptedAction?.kind === "accept"
      ? acceptedAction
      : null;
  const walletAddress =
    session?.account.address ?? "";

  const peerAddress = useMemo(() => {
    if (!accepted || !walletAddress) {
      return "";
    }

    if (
      accepted.senderAddress &&
      sameStarknetAddress(
        accepted.senderAddress,
        walletAddress,
      )
    ) {
      return accepted.recipientAddress ?? "";
    }

    if (
      accepted.recipientAddress &&
      sameStarknetAddress(
        accepted.recipientAddress,
        walletAddress,
      )
    ) {
      return accepted.senderAddress ?? "";
    }

    return "";
  }, [
    accepted?.senderAddress,
    accepted?.recipientAddress,
    walletAddress,
  ]);

  const dealOfferLocator =
    accepted?.parentOfferLocator ??
    acceptedOffer?.actionLocator ??
    "";

  // The original Offer fixes settlement roles for the whole lifecycle.
  // Counters may change terms, but must never silently swap who funds Rekber.
  const rootOffer = useMemo(() => {
    const rootLocator = canonicalLocator(
      accepted?.rootOfferLocator,
    );

    if (!rootLocator) return null;

    return (
      offerEntries.find(
        (entry) =>
          entry.offerAction?.kind === "create" &&
          canonicalLocator(entry.actionLocator) === rootLocator,
      ) ?? null
    );
  }, [
    accepted?.rootOfferLocator,
    offerEntries,
  ]);

  const agreedPayerAddress =
    rootOffer?.offerAction?.senderAddress ?? "";
  const agreedPayeeAddress =
    rootOffer?.offerAction?.recipientAddress ?? "";
  const settlementPlan =
    accepted?.settlementPlan ??
    rootOffer?.offerAction?.settlementPlan ??
    null;
  const agreedRole: SettlementRole | null =
    walletAddress &&
    agreedPayerAddress &&
    sameStarknetAddress(
      walletAddress,
      agreedPayerAddress,
    )
      ? "payer"
      : walletAddress &&
          agreedPayeeAddress &&
          sameStarknetAddress(
            walletAddress,
            agreedPayeeAddress,
          )
        ? "payee"
        : null;

  const discoveredCreate = useMemo(
    () =>
      [...escrowActions]
        .reverse()
        .find((item) => {
          if (item.action.kind !== "create") {
            return false;
          }

          if (
            item.action.coordinationVersion !==
            REKBER_COORDINATION_VERSION
          ) {
            return false;
          }

          if (
            custodyCommitment &&
            hasCustody(
              item.action,
              custodyCommitment,
            )
          ) {
            return true;
          }

          return (
            canonicalLocator(
              item.action
                .dealOfferLocator,
            ) ===
            canonicalLocator(
              dealOfferLocator,
            )
          );
        }) ?? null,
    [
      escrowActions,
      custodyCommitment,
      dealOfferLocator,
    ],
  );

  /*
   * Indexed Starknet discovery is authoritative.
   * Local coordination is only an optimistic fallback after this client has
   * already received a transaction result.
   */
  const createRecord =
    discoveredCreate ?? localCreate;
  const createAction =
    createRecord?.action ?? null;
  const discoveredAccept = useMemo(
    () =>
      [...escrowActions]
        .reverse()
        .find(
          (item) =>
            item.action.kind ===
              "accept" &&
            item.action.coordinationVersion ===
              REKBER_COORDINATION_VERSION &&
            hasCustody(
              item.action,
              custodyCommitment,
            ),
        ) ?? null,
    [
      escrowActions,
      custodyCommitment,
    ],
  );

  const acceptRecord =
    discoveredAccept ?? localAccept;
  const acceptAction =
    acceptRecord?.action ?? null;

  const discoveredRelease = useMemo(
    () =>
      [...escrowActions]
        .reverse()
        .find(
          (item) =>
            item.action.kind ===
              "resolve" &&
            item.action.coordinationVersion ===
              REKBER_COORDINATION_VERSION &&
            hasCustody(
              item.action,
              custodyCommitment,
            ) &&
            Boolean(
              item.action
                .releaseAuthorizationSecret,
            ),
        ) ?? null,
    [
      escrowActions,
      custodyCommitment,
    ],
  );

  const releaseRecord =
    localRelease ?? discoveredRelease;
  const releaseAuthorizationSecret =
    toBigInt(
      releaseRecord?.action
        .releaseAuthorizationSecret,
    );

  const role: SettlementRole | null =
    createAction?.senderAddress &&
    walletAddress &&
    sameStarknetAddress(
      createAction.senderAddress,
      walletAddress,
    )
      ? "payer"
      : createAction?.recipientAddress &&
          walletAddress &&
          sameStarknetAddress(
            createAction.recipientAddress,
            walletAddress,
          )
        ? "payee"
        : localSecrets?.role ?? agreedRole;

  const ownDisputeEvidenceRecord =
    useMemo(
      () =>
        findLatestOwnDisputeEvidenceAction(
          escrowActions,
          custodyCommitment,
          walletAddress,
        ),
      [
        escrowActions,
        custodyCommitment,
        walletAddress,
      ],
    );

  const mutualRefundConsentRecord =
    useMemo(
      () =>
        findLatestMutualRefundConsentAction(
          escrowActions,
          custodyCommitment,
        ),
      [
        escrowActions,
        custodyCommitment,
      ],
    );

  const refundAfter = Number(
    createAction?.refundAfter ??
      custodyState?.refundAfter ??
      0,
  );
  const refundRemainingSeconds =
    refundAfter
      ? Math.max(
          0,
          refundAfter -
            refundClock,
        )
      : 0;

  const refundAvailable =
    Boolean(refundAfter) &&
    refundRemainingSeconds === 0 &&
    Boolean(custodyState) &&
    !custodyState!.fulfillmentSubmitted &&
    !custodyState!.disputed &&
    !custodyState!.consumed;

  const refundCountdown =
    refundAfter
      ? formatRefundDuration(
          refundRemainingSeconds,
        )
      : "—";

  useEffect(() => {
    if (
      !refundAfter ||
      custodyState?.consumed
    ) {
      return;
    }

    const tick = () => {
      setRefundClock(
        Math.floor(
          Date.now() / 1000,
        ),
      );
    };

    tick();

    const timer =
      window.setInterval(
        tick,
        1000,
      );

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [
    refundAfter,
    custodyState?.consumed,
  ]);

  useEffect(() => {
    if (
      !accepted ||
      !createAction ||
      !acceptAction
    ) {
      setCoordinationAuthorized(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const termsCommitment =
        await computeDealTermsCommitment(
          accepted,
        );
      const termsMatch =
        createAction.dealTermsCommitment ===
          termsCommitment &&
        acceptAction.dealTermsCommitment ===
          termsCommitment;
      const [setupValid, acceptanceValid] =
        await Promise.all([
          verifyRekberSetup(createAction),
          verifyRekberAcceptance(
            createAction,
            acceptAction,
          ),
        ]);

      if (!cancelled) {
        setCoordinationAuthorized(
          termsMatch &&
            setupValid &&
            acceptanceValid,
        );
      }
    })().catch(() => {
      if (!cancelled) {
        setCoordinationAuthorized(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    accepted,
    createAction,
    acceptAction,
  ]);

  const custodyVerification = useMemo(() => {
    if (!custodyState) {
      return {
        verified: false,
        reason: "",
      };
    }

    if (
      !accepted ||
      !createAction ||
      !acceptAction
    ) {
      return {
        verified: false,
        reason:
          "Encrypted Escrow coordination is incomplete.",
      };
    }

    if (coordinationAuthorized !== true) {
      return {
        verified: false,
        reason:
          coordinationAuthorized === null
            ? "Wallet approvals are still being verified."
            : "The payer setup, payee acceptance, or private Offer terms do not have matching wallet authorization.",
      };
    }

    const settlementAsset =
      resolveSettlementAsset(
        accepted.asset,
      );
    const expected = {
      releaseAuthorizationCommitment:
        toBigInt(
          createAction
            .releaseAuthorizationCommitment,
        ),
      refundCommitment: toBigInt(
        createAction.refundCommitment,
      ),
      payerConfirmationCommitment:
        toBigInt(
          createAction
            .payerConfirmationCommitment,
        ),
      payerDisputeCommitment:
        toBigInt(
          createAction
            .payerDisputeCommitment,
        ),
      revisionChainHead:
        toBigInt(
          createAction
            .revisionChainHead,
        ),
      payerCertificateCommitment:
        toBigInt(
          createAction
            .payerCertificateCommitment,
        ),
      payeeClaimCommitment:
        toBigInt(
          acceptAction
            .payeeClaimCommitment,
        ),
      payeeDisputeCommitment:
        toBigInt(
          acceptAction
            .payeeDisputeCommitment,
        ),
      payeeRefundConsentCommitment:
        toBigInt(
          acceptAction
            .payeeRefundConsentCommitment,
        ),
      fulfillmentChainHead:
        toBigInt(
          acceptAction
            .fulfillmentChainHead,
        ),
      payeeCertificateCommitment:
        toBigInt(
          acceptAction
            .payeeCertificateCommitment,
        ),
    };

    if (
      !settlementAsset?.address ||
      !expected.releaseAuthorizationCommitment ||
      !expected.refundCommitment ||
      !expected.payerConfirmationCommitment ||
      !expected.payerDisputeCommitment ||
      expected.revisionChainHead === null ||
      !expected.payerCertificateCommitment ||
      !expected.payeeClaimCommitment ||
      !expected.payeeDisputeCommitment ||
      !expected.payeeRefundConsentCommitment ||
      !expected.fulfillmentChainHead ||
      !expected.payeeCertificateCommitment ||
      !refundAfter ||
      !settlementPlan
    ) {
      return {
        verified: false,
        reason:
          "The expected Escrow commitments cannot be reconstructed.",
      };
    }

    let expectedAmount: bigint;

    try {
      expectedAmount =
        parseSettlementAmount(
          accepted.amount,
          settlementAsset.decimals,
        );
    } catch {
      return {
        verified: false,
        reason:
          "The accepted Offer amount cannot be verified.",
      };
    }

    const matches =
      custodyState.releaseAuthorizationCommitment ===
        expected.releaseAuthorizationCommitment &&
      custodyState.payeeClaimCommitment ===
        expected.payeeClaimCommitment &&
      custodyState.payeeDisputeCommitment ===
        expected.payeeDisputeCommitment &&
      custodyState.payeeRefundConsentCommitment ===
        expected.payeeRefundConsentCommitment &&
      (
        custodyState
          .fulfillmentRoundsRemaining <
          settlementPlan
            .maxFulfillmentRounds ||
        custodyState
          .fulfillmentChainHead ===
          expected.fulfillmentChainHead
      ) &&
      custodyState.refundCommitment ===
        expected.refundCommitment &&
      custodyState.payerConfirmationCommitment ===
        expected.payerConfirmationCommitment &&
      custodyState.payerDisputeCommitment ===
        expected.payerDisputeCommitment &&
      (
        custodyState
          .revisionRoundsRemaining <
          settlementPlan
            .maxRevisionRounds ||
        custodyState
          .revisionChainHead ===
          expected.revisionChainHead
      ) &&
      custodyState.payerCertificateCommitment ===
        expected.payerCertificateCommitment &&
      custodyState.payeeCertificateCommitment ===
        expected.payeeCertificateCommitment &&
      custodyState.refundAfter ===
        refundAfter &&
      custodyState.amount ===
        expectedAmount &&
      custodyState.reviewWindow ===
        settlementPlan.reviewWindowSeconds &&
      custodyState.verificationPolicy ===
        verificationPolicyCode(
          settlementPlan.verificationPolicy,
        ) &&
      custodyState.fulfillmentRoundsRemaining <=
        settlementPlan.maxFulfillmentRounds &&
      custodyState.revisionRoundsRemaining <=
        settlementPlan.maxRevisionRounds &&
      sameStarknetAddress(
        custodyState.token,
        settlementAsset.address,
      );

    return matches
      ? {
          verified: true,
          reason: "",
        }
      : {
          verified: false,
          reason:
            "The on-chain token, amount, timeout, or settlement commitments do not match the encrypted agreement.",
        };
  }, [
    custodyState,
    accepted,
    createAction,
    acceptAction,
    refundAfter,
    coordinationAuthorized,
  ]);
  const custodyMismatch = Boolean(
    custodyState &&
      coordinationAuthorized !== null &&
      !custodyVerification.verified,
  );
  const funded = Boolean(
    custodyState &&
      custodyVerification.verified,
  );
  const localRefundSecret =
    toBigInt(
      localSecrets?.refundSecret,
    );
  const canRecoverMismatchedCustody =
    Boolean(
      custodyMismatch &&
        custodyCommitment &&
        localRefundSecret &&
        custodyState &&
        !custodyState.consumed &&
        computeRekberRefundCommitment(
          custodyCommitment,
          localRefundSecret,
        ) ===
          custodyState.refundCommitment,
    );
  const custodyConsumed = Boolean(
    custodyState?.consumed,
  );
  const settled = Boolean(
    funded && custodyConsumed,
  );
  const resolved = Boolean(
    settled &&
      custodyState?.resolutionAuthorized,
  );
  const refunded = Boolean(
    settled &&
      !resolved &&
      custodyState?.refunded,
  );
  const released =
    settled &&
    !resolved &&
    !refunded;

  const displaySettlementAsset =
    accepted
      ? resolveSettlementAsset(
          accepted.asset,
        )
      : null;

  const resolutionPayerDisplay =
    custodyState &&
    displaySettlementAsset
      ? formatUnits(
          custodyState
            .resolutionPayerAmount,
          displaySettlementAsset.decimals,
        )
      : "0";

  const resolutionPayeeDisplay =
    custodyState &&
    displaySettlementAsset
      ? formatUnits(
          custodyState
            .resolutionPayeeAmount,
          displaySettlementAsset.decimals,
        )
      : "0";
  const rekberConfigured = Boolean(
    CONTRACTS.escrowRekber,
  );
  const certificateConfigured =
    Boolean(
      CONTRACTS.settlementCertificate,
    );
  const certificateTokenId =
    custodyCommitment && role
      ? computeCertificateTokenId(
          custodyCommitment,
          role,
        )
      : null;

  /*
   * Ready X can execute an action successfully while its in-page promise
   * remains pending. Once discovery/contract state proves the action has
   * completed, release the UI immediately. The action ref prevents a late
   * callback from unlocking a newer transaction.
   */
  useEffect(() => {
    const action =
      pendingRekberActionRef.current;

    if (!action) {
      return;
    }

    /*
     * Setup and Payee approval are complete only when their immutable
     * coordination action is discovered again with a Starknet tx proof.
     * Local state or a Ready X callback must never advance these stages.
     */
    const setupConfirmed =
      action === "setup" &&
      Boolean(
        discoveredCreate
          ?.transactionHash,
      );

    const acceptanceConfirmed =
      action === "accept" &&
      Boolean(
        discoveredAccept
          ?.transactionHash,
      );

    const completed =
      setupConfirmed ||
      acceptanceConfirmed ||
      (action === "fund" &&
        funded) ||
      (action === "release" &&
        Boolean(releaseRecord)) ||
      (action === "claim" &&
        released) ||
      (action === "refund" &&
        settled &&
        Boolean(
          custodyState?.refunded,
        )) ||
      (action === "certificate" &&
        certificateClaimed);

    if (completed) {
      /*
       * Blockchain proof also recovers a Ready X callback that never returns.
       * Clear every coordination-only lock so the UI cannot remain stuck on
       * "2/2" after Starknet has already accepted the action.
       */
      if (setupConfirmed) {
        setPendingPayerSetup(null);
        setCoordinationPhase("idle");
        coordinationLockRef.current =
          false;
      }

      if (acceptanceConfirmed) {
        setPendingPayeeAcceptance(
          null,
        );
        setCoordinationPhase("idle");
        coordinationLockRef.current =
          false;
      }

      finishRekberAction(action);
    }
  }, [
    discoveredCreate
      ?.transactionHash,
    discoveredAccept
      ?.transactionHash,
    funded,
    releaseRecord,
    released,
    settled,
    custodyState?.refunded,
    certificateClaimed,
  ]);

  useEffect(() => {
    setCustodyCommitment(null);
    setLocalSecrets(null);
    setLocalCreate(null);
    setLocalAccept(null);
    setLocalRelease(null);
    setCustodyState(null);
    setFundingProofTx("");
    setSettlementProofTx("");
    setCertificateClaimed(false);
    setCertificateTx("");
    setCoordinationAuthorized(null);
    setCoordinationPhase("idle");
    setPendingPayerSetup(null);
    setPendingPayeeAcceptance(null);

    if (
      pendingRekberActionRef.current
    ) {
      setBusy(false);
    }

    pendingRekberActionRef.current =
      null;
    setPendingRekberAction(null);
    coordinationLockRef.current = false;
  }, [
    acceptedOffer?.actionLocator,
    walletAddress,
  ]);

  useEffect(() => {
    if (!acceptedOffer || !accepted) {
      return;
    }

    const fromCreate = toBigInt(
      discoveredCreate?.action
        .custodyCommitment,
    );

    if (fromCreate) {
      setCustodyCommitment(fromCreate);
    }
  }, [
    acceptedOffer?.actionLocator,
    accepted,
    discoveredCreate?.actionLocator,
  ]);

  useEffect(() => {
    if (
      !custodyCommitment ||
      !session ||
      !channelKey
    ) {
      setLocalSecrets(null);
      return;
    }

    let cancelled = false;

    void loadRekberSecrets(
      roomId,
      session.account.address,
      custodyCommitment,
      channelKey,
    ).then((stored) => {
      if (!cancelled) {
        setLocalSecrets(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    roomId,
    session?.account.address,
    channelKey,
    custodyCommitment,
  ]);

  useEffect(() => {
    if (
      !custodyCommitment ||
      !rekberConfigured
    ) {
      setCustodyState(null);
      return;
    }

    let cancelled = false;

    const sync = async () => {
      const next =
        await getRekberCustody(
          custodyCommitment,
        );

      if (cancelled) return;
      setCustodyState(next);

      if (next) {
        const funding =
          await getRekberProof(
            custodyCommitment,
            "funded",
          );

        if (
          !cancelled &&
          funding?.transactionHash
        ) {
          setFundingProofTx(
            funding.transactionHash,
          );
        }
      }

      if (next?.consumed) {
        const outcome =
          next.resolutionAuthorized
            ? "resolved"
            : next.refunded
              ? "refunded"
              : "released";
        const proof =
          await getRekberProof(
            custodyCommitment,
            outcome,
          );

        if (
          !cancelled &&
          proof?.transactionHash
        ) {
          setSettlementProofTx(
            proof.transactionHash,
          );
        }
      }
    };

    void sync();
    const timer = window.setInterval(
      () => void sync(),
      1000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    custodyCommitment,
    rekberConfigured,
  ]);

  useEffect(() => {
    if (
      !released ||
      !custodyCommitment ||
      !role ||
      !certificateConfigured
    ) {
      setCertificateClaimed(false);
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const claimed =
          await isSettlementCertificateClaimed(
            custodyCommitment,
            role,
          );

        if (!cancelled) {
          setCertificateClaimed(
            claimed,
          );
        }
      } catch {
        // RPC can lag while the claim transaction is being accepted.
      }
    };

    void sync();
    const timer = window.setInterval(
      () => void sync(),
      5000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    released,
    custodyCommitment,
    role,
    certificateConfigured,
  ]);

  async function persistSecrets(
    custody: bigint,
    secrets: StoredRekberSecrets,
  ) {
    if (!session || !channelKey) {
      throw new Error(
        "Private room key is not ready.",
      );
    }

    await saveRekberSecrets(
      roomId,
      session.account.address,
      custody,
      channelKey,
      secrets,
    );
    setLocalSecrets(secrets);
  }

  async function handleStartRekber() {
    // Recover a stale coordination lock. The lock is only legitimate while
    // Ready X coordination is actively running. Without this recovery the
    // button can look enabled while taps silently return.
    if (
      coordinationLockRef.current &&
      !busy
    ) {
      coordinationLockRef.current = false;
      pendingRekberActionRef.current = null;
      setPendingRekberAction(null);
      setCoordinationPhase("idle");
    }

    if (
      coordinationLockRef.current ||
      !session ||
      !channelKey ||
      !acceptedOffer ||
      !accepted ||
      !peerAddress ||
      createAction ||
      role !== "payer"
    ) {
      return;
    }

    if (!settlementPlan) {
      setError(
        "The accepted Offer is missing its production Rekber settlement plan.",
      );
      return;
    }

    const hours = Number(
      refundHours,
    );

    if (
      !Number.isFinite(hours) ||
      hours < 1 ||
      hours > 24 * 30
    ) {
      setError(
        "Choose a refund window between 1 hour and 30 days.",
      );
      return;
    }

    coordinationLockRef.current = true;
    beginRekberAction("setup");
    setError(null);

    let pending = pendingPayerSetup;

    try {
      if (!pending) {
        setCoordinationPhase(
          "payer-signature",
        );

        const custody =
          generateRekberCustodyCommitment();
        const secrets =
          generatePayerSettlementSecrets(
            custody,
            settlementPlan
              .maxRevisionRounds,
          );
        const refundAt =
          Math.floor(Date.now() / 1000) +
          hours * 3600;
        const termsCommitment =
          await computeDealTermsCommitment(
            accepted,
          );
        const stored: StoredRekberSecrets = {
          version: 2,
          custodyCommitment:
            custody.toString(),
          role: "payer",
          releaseAuthorizationSecret:
            secrets.releaseAuthorizationSecret.toString(),
          refundSecret:
            secrets.refundSecret.toString(),
          payerConfirmationSecret:
            secrets.payerConfirmationSecret.toString(),
          payerDisputeSecret:
            secrets.payerDisputeSecret.toString(),
          revisionChainSecrets:
            secrets.revisionChainSecrets.map(
              String,
            ),
          certificateSecret:
            secrets.certificateSecret.toString(),
          savedAt:
            new Date().toISOString(),
        };

        const unsignedPayload: EscrowActionPayload = {
          kind: "create",
          coordinationVersion:
            REKBER_COORDINATION_VERSION,
          dealOfferLocator,
          dealTermsCommitment:
            termsCommitment,
          senderAddress:
            session.account.address,
          recipientAddress:
            peerAddress,
          custodyCommitment:
            custody.toString(),
          releaseAuthorizationCommitment:
            computeReleaseAuthorizationCommitment(
              custody,
              secrets.releaseAuthorizationSecret,
            ).toString(),
          refundCommitment:
            computeRekberRefundCommitment(
              custody,
              secrets.refundSecret,
            ).toString(),
          payerConfirmationCommitment:
            computePayerConfirmationCommitment(
              custody,
              secrets.payerConfirmationSecret,
            ).toString(),
          payerDisputeCommitment:
            computePayerDisputeCommitment(
              custody,
              secrets.payerDisputeSecret,
            ).toString(),
          revisionChainHead:
            secrets.revisionChainHead.toString(),
          payerCertificateCommitment:
            computeCertificateClaimCommitment(
              custody,
              "payer",
              session.account.address,
              secrets.certificateSecret,
            ).toString(),
          refundAfter:
            String(refundAt),
        };
        const payload: EscrowActionPayload = {
          ...unsignedPayload,
          coordinationSignature:
            await signRekberSetup(
              session.account,
              unsignedPayload,
            ),
        };

        pending = {
          custodyCommitment: custody,
          secrets: stored,
          payload,
        };
        setPendingPayerSetup(pending);

        // Do not immediately open a second Ready X request after signing.
        // Persist the exact signed setup and return control to the user.
        await persistSecrets(
          pending.custodyCommitment,
          pending.secrets,
        );
        setCustodyCommitment(
          pending.custodyCommitment,
        );
        return;
      }

      await persistSecrets(
        pending.custodyCommitment,
        pending.secrets,
      );

      setCoordinationPhase("payer-send");
      const result =
        await onSendCoordination(
          peerAddress,
          pending.payload,
        );
      const local: LocalCoordination = {
        actionLocator:
          result.actionLocator.toString(
            16,
          ),
        transactionHash:
          result.transactionHash,
        action: {
          ...pending.payload,
          senderAddress:
            session.account.address,
          recipientAddress:
            peerAddress,
          sentAt:
            new Date().toISOString(),
        },
      };

      setCustodyCommitment(
        pending.custodyCommitment,
      );
      setLocalCreate(local);
      setPendingPayerSetup(null);
      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary:
          `Escrow request — ${accepted.amount} ${accepted.asset}`,
        transactionHash:
          result.transactionHash,
        actionLocator:
          local.actionLocator,
        sentAt:
          new Date().toISOString(),
        scope: "direct",
        senderAddress:
          session.account.address,
        recipientAddress:
          peerAddress,
      });
    } catch (error) {
      if (
        pendingRekberActionRef.current !==
        "setup"
      ) {
        return;
      }

      setError(
        humanizeError(
          error,
          "Escrow setup is not complete. Tap Continue setup to reuse the same approval.",
        ),
      );
    } finally {
      coordinationLockRef.current = false;
      setCoordinationPhase("idle");
      finishRekberAction("setup");
    }
  }

  async function handleAcceptRekber() {
    // Same stale-lock recovery for the Payee approval side.
    if (
      coordinationLockRef.current &&
      !busy
    ) {
      coordinationLockRef.current = false;
      pendingRekberActionRef.current = null;
      setPendingRekberAction(null);
      setCoordinationPhase("idle");
    }

    if (
      coordinationLockRef.current ||
      !session ||
      !channelKey ||
      !accepted ||
      !peerAddress ||
      !custodyCommitment ||
      !createRecord ||
      !createAction ||
      acceptAction ||
      role !== "payee"
    ) {
      return;
    }

    if (!settlementPlan) {
      setError(
        "The accepted Offer is missing its production Rekber settlement plan.",
      );
      return;
    }

    coordinationLockRef.current = true;
    beginRekberAction("accept");
    setError(null);

    let pending =
      pendingPayeeAcceptance;

    try {
      const termsCommitment =
        await computeDealTermsCommitment(
          accepted,
        );

      if (
        createAction.dealTermsCommitment !==
          termsCommitment ||
        !(await verifyRekberSetup(
          createAction,
        ))
      ) {
        throw new Error(
          "The Payer's wallet authorization does not match the Escrow terms shown here.",
        );
      }

      if (!pending) {
        setCoordinationPhase(
          "payee-signature",
        );

        const secrets =
          generatePayeeSettlementSecrets(
            custodyCommitment,
            settlementPlan
              .maxFulfillmentRounds,
          );
        const stored: StoredRekberSecrets = {
          version: 2,
          custodyCommitment:
            custodyCommitment.toString(),
          role: "payee",
          payeeClaimSecret:
            secrets.payeeClaimSecret.toString(),
          payeeDisputeSecret:
            secrets.payeeDisputeSecret.toString(),
          payeeRefundConsentSecret:
            secrets.payeeRefundConsentSecret.toString(),
          fulfillmentChainSecrets:
            secrets.fulfillmentChainSecrets.map(
              String,
            ),
          certificateSecret:
            secrets.certificateSecret.toString(),
          savedAt:
            new Date().toISOString(),
        };

        const unsignedPayload: EscrowActionPayload = {
          kind: "accept",
          coordinationVersion:
            REKBER_COORDINATION_VERSION,
          dealOfferLocator,
          dealTermsCommitment:
            termsCommitment,
          senderAddress:
            session.account.address,
          recipientAddress:
            peerAddress,
          rootEscrowLocator:
            createRecord.actionLocator,
          parentEscrowLocator:
            createRecord.actionLocator,
          custodyCommitment:
            custodyCommitment.toString(),
          payeeClaimCommitment:
            computePayeeClaimCommitment(
              custodyCommitment,
              secrets.payeeClaimSecret,
            ).toString(),
          payeeDisputeCommitment:
            computePayeeDisputeCommitment(
              custodyCommitment,
              secrets.payeeDisputeSecret,
            ).toString(),
          payeeRefundConsentCommitment:
            computePayeeRefundConsentCommitment(
              custodyCommitment,
              secrets.payeeRefundConsentSecret,
            ).toString(),
          fulfillmentChainHead:
            secrets.fulfillmentChainHead.toString(),
          payeeCertificateCommitment:
            computeCertificateClaimCommitment(
              custodyCommitment,
              "payee",
              session.account.address,
              secrets.certificateSecret,
            ).toString(),
          refundAfter:
            createAction?.refundAfter,
        };
        const payload: EscrowActionPayload = {
          ...unsignedPayload,
          coordinationSignature:
            await signRekberAcceptance(
              session.account,
              createAction,
              unsignedPayload,
            ),
        };

        pending = {
          secrets: stored,
          payload,
        };
        setPendingPayeeAcceptance(
          pending,
        );

        // Separate the wallet signature from the STRK20 send.
        await persistSecrets(
          custodyCommitment,
          pending.secrets,
        );
        return;
      }

      await persistSecrets(
        custodyCommitment,
        pending.secrets,
      );

      setCoordinationPhase("payee-send");
      const result =
        await onSendCoordination(
          peerAddress,
          pending.payload,
        );
      const local: LocalCoordination = {
        actionLocator:
          result.actionLocator.toString(
            16,
          ),
        transactionHash:
          result.transactionHash,
        action: {
          ...pending.payload,
          senderAddress:
            session.account.address,
          recipientAddress:
            peerAddress,
          sentAt:
            new Date().toISOString(),
        },
      };

      setLocalAccept(local);
      setPendingPayeeAcceptance(null);
      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary: "Escrow approved — payment can now be secured",
        transactionHash:
          result.transactionHash,
        actionLocator:
          local.actionLocator,
        sentAt:
          new Date().toISOString(),
        scope: "direct",
        senderAddress:
          session.account.address,
        recipientAddress:
          peerAddress,
      });
    } catch (error) {
      if (
        pendingRekberActionRef.current !==
        "accept"
      ) {
        return;
      }

      setError(
        humanizeError(
          error,
          "Escrow approval is not complete. Tap continue to reuse the same approval.",
        ),
      );
    } finally {
      coordinationLockRef.current = false;
      setCoordinationPhase("idle");
      finishRekberAction("accept");
    }
  }

  async function handleFund() {
    if (
      !session ||
      !accepted ||
      !peerAddress ||
      !custodyCommitment ||
      !createAction ||
      !acceptAction ||
      !localSecrets ||
      role !== "payer" ||
      funded
    ) {
      return;
    }

    const releaseAuthorizationCommitment =
      toBigInt(
        createAction
          .releaseAuthorizationCommitment,
      );
    const refundCommitment = toBigInt(
      createAction.refundCommitment,
    );
    const payerConfirmationCommitment =
      toBigInt(
        createAction
          .payerConfirmationCommitment,
      );
    const payerDisputeCommitment =
      toBigInt(
        createAction
          .payerDisputeCommitment,
      );
    const revisionChainHead =
      toBigInt(
        createAction
          .revisionChainHead,
      );
    const payerCertificateCommitment =
      toBigInt(
        createAction
          .payerCertificateCommitment,
      );
    const payeeClaimCommitment =
      toBigInt(
        acceptAction
          .payeeClaimCommitment,
      );
    const payeeDisputeCommitment =
      toBigInt(
        acceptAction
          .payeeDisputeCommitment,
      );
    const payeeRefundConsentCommitment =
      toBigInt(
        acceptAction
          .payeeRefundConsentCommitment,
      );
    const fulfillmentChainHead =
      toBigInt(
        acceptAction
          .fulfillmentChainHead,
      );
    const payeeCertificateCommitment =
      toBigInt(
        acceptAction
          .payeeCertificateCommitment,
      );
    const settlementAsset =
      resolveSettlementAsset(
        accepted.asset,
      );

    if (
      !releaseAuthorizationCommitment ||
      !refundCommitment ||
      !payerConfirmationCommitment ||
      !payerDisputeCommitment ||
      revisionChainHead === null ||
      !payerCertificateCommitment ||
      !payeeClaimCommitment ||
      !payeeDisputeCommitment ||
      !payeeRefundConsentCommitment ||
      !fulfillmentChainHead ||
      !payeeCertificateCommitment ||
      !refundAfter ||
      !settlementPlan ||
      !settlementAsset?.address
    ) {
      setError(
        "Secure Escrow commitments are incomplete. Sync the room and try again.",
      );
      return;
    }

    beginRekberAction("fund");
    setError(null);

    try {
      const termsCommitment =
        await computeDealTermsCommitment(
          accepted,
        );
      const [setupValid, acceptanceValid] =
        await Promise.all([
          verifyRekberSetup(createAction),
          verifyRekberAcceptance(
            createAction,
            acceptAction,
          ),
        ]);

      if (
        createAction.dealTermsCommitment !==
          termsCommitment ||
        acceptAction.dealTermsCommitment !==
          termsCommitment ||
        !setupValid ||
        !acceptanceValid
      ) {
        throw new Error(
          "Funding blocked: both wallet approvals must match the exact private Offer terms.",
        );
      }

      const amount =
        parseSettlementAmount(
          accepted.amount,
          settlementAsset.decimals,
        );
      const result =
        await depositEscrow(
          session.account,
          {
            custodyCommitment,
            releaseAuthorizationCommitment,
            payeeClaimCommitment,
            refundCommitment,
            payerConfirmationCommitment,
            payerDisputeCommitment,
            payeeDisputeCommitment,
            payeeRefundConsentCommitment,
            fulfillmentChainHead,
            revisionChainHead,
            payerCertificateCommitment,
            payeeCertificateCommitment,
            refundAfter,
            reviewWindow:
              settlementPlan
                .reviewWindowSeconds,
            verificationPolicy:
              verificationPolicyCode(
                settlementPlan
                  .verificationPolicy,
              ),
            fulfillmentRounds:
              settlementPlan
                .maxFulfillmentRounds,
            revisionRounds:
              settlementPlan
                .maxRevisionRounds,
            token:
              settlementAsset.address,
            amount,
          },
        );

      setFundingProofTx(
        result.transactionHash,
      );
      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary:
          `Escrow funded — ${accepted.amount} ${accepted.asset}`,
        transactionHash:
          result.transactionHash,
        actionLocator:
          custodyCommitment.toString(16),
        sentAt:
          new Date().toISOString(),
      });

      void onSendCoordination(
        peerAddress,
        {
          kind: "fund_confirm",
          dealOfferLocator,
          custodyCommitment:
            custodyCommitment.toString(),
          parentEscrowLocator:
            acceptRecord?.actionLocator,
          fundingTransactionHash:
            result.transactionHash,
        },
      ).catch((error) => {
        console.error(
          "[VINSS REKBER FUND CONFIRM]",
          error,
        );
      });
    } catch (error) {
      if (
        pendingRekberActionRef.current !==
        "fund"
      ) {
        return;
      }

      setError(
        humanizeError(
          error,
          "We couldn't secure the payment.",
        ),
      );
    } finally {
      finishRekberAction("fund");
    }
  }

  async function handleAuthorizeRelease() {
    if (
      !session ||
      !peerAddress ||
      !custodyCommitment ||
      !localSecrets
        ?.releaseAuthorizationSecret ||
      role !== "payer" ||
      !custodyState ||
      !custodyState.fulfillmentConfirmed ||
      custodyState.revisionPending ||
      custodyState.disputed ||
      settled ||
      releaseRecord
    ) {
      return;
    }

    beginRekberAction("release");
    setError(null);

    try {
      const payload: EscrowActionPayload = {
        kind: "resolve",
        coordinationVersion:
          REKBER_COORDINATION_VERSION,
        dealOfferLocator,
        custodyCommitment:
          custodyCommitment.toString(),
        releaseAuthorizationSecret:
          localSecrets
            .releaseAuthorizationSecret,
        reason:
          "Payer approved settlement release.",
      };
      const result =
        await onSendCoordination(
          peerAddress,
          payload,
        );
      const local: LocalCoordination = {
        actionLocator:
          result.actionLocator.toString(
            16,
          ),
        transactionHash:
          result.transactionHash,
        action: {
          ...payload,
          senderAddress:
            session.account.address,
          recipientAddress:
            peerAddress,
          sentAt:
            new Date().toISOString(),
        },
      };

      setLocalRelease(local);
      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary:
          "Settlement approved — payee can claim payment",
        transactionHash:
          result.transactionHash,
        actionLocator:
          local.actionLocator,
        sentAt:
          new Date().toISOString(),
      });
    } catch (error) {
      if (
        pendingRekberActionRef.current !==
        "release"
      ) {
        return;
      }

      setError(
        humanizeError(
          error,
          "We couldn't authorize release.",
        ),
      );
    } finally {
      finishRekberAction("release");
    }
  }

  async function handleClaimPayment() {
    if (
      !session ||
      !custodyCommitment ||
      !releaseAuthorizationSecret ||
      !localSecrets?.payeeClaimSecret ||
      role !== "payee" ||
      !funded ||
      settled
    ) {
      return;
    }

    beginRekberAction("claim");
    setError(null);

    try {
      const result =
        await releaseEscrow(
          session.account,
          {
            custodyCommitment,
            releaseAuthorizationSecret,
            payeeClaimSecret: BigInt(
              localSecrets.payeeClaimSecret,
            ),
          },
        );

      setSettlementProofTx(
        result.transactionHash,
      );


      onSent({
        id: `escrow-release-${Date.now()}`,
        kind: "offer",
        summary:
          "Settlement released — payment claimed privately",
        sentAt: new Date().toISOString(),
        transactionHash:
          result.transactionHash,
        actionLocator:
          custodyCommitment.toString(16),
      });
    } catch (error) {
      if (
        pendingRekberActionRef.current !==
        "claim"
      ) {
        return;
      }

      setError(
        humanizeError(
          error,
          "We couldn't claim the settlement.",
        ),
      );
    } finally {
      finishRekberAction("claim");
    }
  }

  async function handleRefund() {
    if (
      !session ||
      !custodyCommitment ||
      !localSecrets?.refundSecret ||
      role !== "payer" ||
      !custodyState ||
      custodyConsumed ||
      !refundAvailable
    ) {
      return;
    }

    beginRekberAction("refund");
    setError(null);

    try {
      const result =
        await refundEscrow(
          session.account,
          {
            custodyCommitment,
            refundSecret: BigInt(
              localSecrets.refundSecret,
            ),
          },
        );

      setSettlementProofTx(
        result.transactionHash,
      );
      onSent({
        id: crypto.randomUUID(),
        kind: "offer",
        summary:
          "Escrow refunded after the protection window",
        transactionHash:
          result.transactionHash,
        actionLocator:
          custodyCommitment.toString(16),
        sentAt:
          new Date().toISOString(),
      });
    } catch (error) {
      if (
        pendingRekberActionRef.current !==
        "refund"
      ) {
        return;
      }

      setError(
        humanizeError(
          error,
          "We couldn't refund the Escrow payment.",
        ),
      );
    } finally {
      finishRekberAction("refund");
    }
  }

  async function handleClaimCertificate() {
    if (
      !session ||
      !custodyCommitment ||
      !role ||
      !localSecrets
        ?.certificateSecret ||
      !released ||
      certificateClaimed
    ) {
      return;
    }

    beginRekberAction("certificate");
    setError(null);

    try {
      const result =
        await claimSettlementCertificate(
          session.account,
          {
            custodyCommitment,
            role,
            certificateSecret: BigInt(
              localSecrets
                .certificateSecret,
            ),
          },
        );

      setCertificateTx(
        result.transactionHash,
      );
    } catch (error) {
      if (
        pendingRekberActionRef.current !==
        "certificate"
      ) {
        return;
      }

      setError(
        humanizeError(
          error,
          "We couldn't claim the settlement certificate.",
        ),
      );
    } finally {
      finishRekberAction("certificate");
    }
  }


  const stage = !accepted
    ? 0
    : !createAction
      ? 1
      : !acceptAction
        ? 2
        : !funded
          ? 3
          : !settled
            ? 4
            : 5;

  const steps = [
    "Agreement",
    "Approval",
    "Funded",
    "Review",
    "Proof",
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-wire/70 bg-[#0b1015]/95 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
      <header className="border-b border-wire/60 bg-black/10 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-signal/75">
              Private payment protection
            </p>
            <h3 className="mt-1 text-xl font-medium text-paper">
              Rekber Escrow
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-paper/38">
              The Payer secures the agreed funds. The Payee receives them after the settlement conditions are satisfied.
            </p>
          </div>

        </div>

        <div className="mt-4 grid grid-cols-5 gap-1">
          {steps.map((label, index) => {
            const position = index + 1;
            const done = stage > position;
            const active = stage === position;

            return (
              <div key={label} className="min-w-0">
                <div
                  className={
                    done
                      ? "h-1 rounded-full bg-signal"
                      : active
                        ? "h-1 rounded-full bg-signal/45"
                        : "h-1 rounded-full bg-paper/8"
                  }
                />
                <p
                  className={
                    done || active
                      ? "mt-1.5 truncate text-[8px] font-medium text-paper/70"
                      : "mt-1.5 truncate text-[8px] text-paper/35"
                  }
                >
                  {done ? "✓ " : ""}
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      </header>

      <div className="vinss-panel-step space-y-4 p-4">
        {!accepted ? (
          <div className="rounded-xl bg-paper/[0.025] p-4">
            <p className="text-sm font-medium text-paper/70">
              Accept an Offer first
            </p>
            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              Escrow can only start from a private Offer accepted by both parties.
            </p>
          </div>
        ) : (
          <EscrowAgreedAmount
            amount={accepted.amount}
            asset={accepted.asset}
          />
        )}

        {accepted && !rekberConfigured && (
          <div className="rounded-xl border border-amber/25 bg-amber/[0.04] p-4">
            <p className="text-xs font-medium text-amber">
              Secure settlement is not deployed on this network
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-paper/35">
              Configure NEXT_PUBLIC_ESCROW_REKBER_ADDRESS after the contract passes testnet release and refund verification.
            </p>
          </div>
        )}

        {accepted && createAction && role && (
          <div className="rounded-xl bg-paper/[0.025] p-3 ring-1 ring-wire/55">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-paper/28">
                  Your role · set by original Offer
                </p>
                <p className="mt-1 text-sm font-medium text-paper/75">
                  {role === "payer"
                    ? "Payer"
                    : "Payee"}
                </p>
              </div>
              <span className="rounded-full bg-signal/[0.08] px-2.5 py-1 font-mono text-[9px] text-signal/80">
                {shortAddress(walletAddress)}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-3 border-t border-wire/40 pt-2 text-[9px]">
              <span className="text-paper/28">
                {role === "payer"
                  ? "Pays to"
                  : "Receives from"}
              </span>
              <span className="font-mono text-paper/50">
                {shortAddress(peerAddress)}
              </span>
            </div>
          </div>
        )}

        {accepted && custodyMismatch && (
          <div className="rounded-xl border border-danger/35 bg-danger/[0.055] p-4">
            <p className="text-xs font-medium text-danger">
              Settlement verification failed
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-paper/38">
              {custodyVerification.reason} Do not authorize or claim this settlement. Verify the public custody on an explorer and use the timeout recovery path only if its refund commitment is yours.
            </p>
            {role === "payer" &&
              canRecoverMismatchedCustody && (
                <button
                  type="button"
                  onClick={handleRefund}
                  disabled={
                    busy ||
                    !refundAvailable
                  }
                  className="mt-3 w-full rounded-xl border border-danger/40 px-4 py-3 text-xs text-danger disabled:opacity-30"
                >
                  {refundAvailable
                    ? "Recover matched refund after timeout"
                    : `Recovery unlocks ${formatDeadline(refundAfter)}`}
                </button>
              )}
          </div>
        )}

        {accepted && rekberConfigured && !createAction && (
          <div className="space-y-3">
            <div className="rounded-xl bg-signal/[0.045] p-4 ring-1 ring-signal/15">
              <p className="text-[9px] uppercase tracking-[0.12em] text-signal/70">
                Roles come from the original Offer
              </p>
              <p className="mt-1 text-sm font-medium text-paper/80">
                {role === "payer"
                  ? "You are the Payer"
                  : role === "payee"
                    ? "You are the Payee"
                    : "Syncing role…"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-paper/40">
                {role === "payer"
                  ? "The wallet that sent the original Offer prepares Escrow and deposits the funds."
                  : role === "payee"
                    ? "This wallet cannot deposit. Wait for the Payer to send the Escrow setup."
                    : "The original Offer history is not available yet. Wait for sync to finish."}
              </p>

              <div className="mt-3 space-y-1 border-t border-wire/45 pt-3 text-[10px]">
                <div className="flex justify-between gap-3">
                  <span className="text-paper/30">This wallet</span>
                  <span className="font-mono text-paper/60">
                    {shortAddress(walletAddress)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-paper/30">Counterparty</span>
                  <span className="font-mono text-paper/60">
                    {shortAddress(peerAddress)}
                  </span>
                </div>
              </div>
            </div>

            {role === "payee" && (
              <div className="rounded-xl bg-paper/[0.025] p-4 text-center ring-1 ring-wire/50">
                <p className="text-sm font-medium text-paper/70">
                  Waiting for the Payer
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-paper/34">
                  When the setup arrives, the “Approve Escrow” button will appear. This wallet never gets a deposit button.
                </p>
              </div>
            )}

            {role === "payer" && (
              <>
                <div className="rounded-xl border border-amber/25 bg-amber/[0.045] p-3">
                  <p className="text-xs font-medium text-amber">
                    Prepare Rekber agreement
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-paper/38">
                    After the Payee approves this setup, the deposit button for {accepted.amount} {accepted.asset} will appear on this wallet.
                  </p>
                </div>

                <label className="flex items-center justify-between gap-4 rounded-xl bg-paper/[0.025] p-3">
                  <span>
                    <span className="block text-xs text-paper/60">
                      Refund window
                    </span>
                    <span className="mt-1 block text-[9px] text-paper/28">
                      The Payer can refund after this period.
                    </span>
                  </span>
                  <span className="flex items-center rounded-lg bg-paper/[0.04] px-2">
                    <input
                      value={refundHours}
                      onChange={(event) =>
                        setRefundHours(
                          event.target.value,
                        )
                      }
                      inputMode="numeric"
                      disabled={Boolean(
                        pendingPayerSetup,
                      )}
                      className="w-12 bg-transparent py-2 text-right text-sm text-paper outline-none"
                    />
                    <span className="ml-1 text-[9px] text-paper/30">
                      hours
                    </span>
                  </span>
                </label>

                <div className="rounded-xl bg-paper/[0.02] px-3 py-2.5 text-[9px] leading-relaxed text-paper/35">
                  Ready X opens twice: <strong className="text-paper/60">(1) sign</strong> the Rekber agreement, then <strong className="text-paper/60">(2) publish</strong> the private setup. Setup is complete only after VINSS finds its Starknet proof.
                </div>

                <button
                  type="button"
                  onClick={handleStartRekber}
                  disabled={
                    busy ||
                    !session ||
                    !channelKey ||
                    !peerAddress
                  }
                  className="w-full rounded-xl bg-signal px-4 py-3.5 text-sm font-medium text-ink disabled:opacity-30"
                >
                  {coordinationPhase === "payer-signature"
                    ? "1/2 · Sign Rekber agreement…"
                    : coordinationPhase === "payer-send"
                      ? "2/2 · Verifying setup on Starknet…"
                      : pendingPayerSetup
                        ? "2/2 · Publish setup →"
                        : "Prepare Rekber agreement →"}
                </button>
              </>
            )}
          </div>
        )}

        {accepted &&
          rekberConfigured &&
          createAction &&
          !acceptAction &&
          role === "payee" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-signal/[0.045] p-4">
                <p className="text-sm font-medium text-paper/75">
                  Rekber approval requested
                </p>
                <p className="mt-1 text-xs leading-relaxed text-paper/38">
                  Payer {shortAddress(createAction.senderAddress ?? "")} will secure {accepted.amount} {accepted.asset}. This wallet is the Payee.
                </p>
                <p className="mt-3 text-[9px] text-paper/28">
                  Refund unlocks: {formatDeadline(refundAfter)}.
                </p>
              </div>

              <div className="rounded-xl bg-paper/[0.02] px-3 py-2.5 text-[9px] leading-relaxed text-paper/35">
                Ready X opens twice: <strong className="text-paper/60">(1) sign</strong> the Payee approval, then <strong className="text-paper/60">(2) send</strong> the private confirmation. No funds move yet.
              </div>

              <button
                type="button"
                onClick={handleAcceptRekber}
                disabled={busy || !session}
                className="w-full rounded-xl bg-signal px-4 py-3.5 text-sm font-medium text-ink disabled:opacity-30"
              >
                {coordinationPhase === "payee-signature"
                  ? "1/2 · Sign in Ready X…"
                  : coordinationPhase === "payee-send"
                    ? "2/2 · Send approval in Ready X…"
                    : pendingPayeeAcceptance
                      ? "Continue approval →"
                      : "Approve as Payee →"}
              </button>
            </div>
          )}

        {accepted &&
          rekberConfigured &&
          createAction &&
          !acceptAction &&
          role === "payer" && (
            <div className="rounded-xl bg-paper/[0.025] p-4 text-center">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border border-signal/25 border-t-signal" />
              <p className="mt-3 text-sm text-paper/65">
                Waiting for the Payee
              </p>
              <p className="mt-1 text-[10px] text-paper/30">
                No funds have moved. The Payee must complete both wallet confirmations.
              </p>
            </div>
          )}

        {accepted &&
          rekberConfigured &&
          acceptAction &&
          !funded &&
          role === "payer" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-signal/[0.045] p-4 ring-1 ring-signal/15">
                <p className="text-[9px] uppercase tracking-[0.13em] text-signal/70">
                  Payee approval complete
                </p>
                <p className="mt-1 text-xs leading-relaxed text-paper/38">
                  Review the agreed amount and fees before funds are locked.
                </p>
              </div>

              <EscrowPriceBreakdown
                amount={accepted.amount}
                asset={accepted.asset}
              />
              <p className="rounded-xl border border-amber/25 bg-amber/[0.04] px-3 py-2.5 text-[10px] leading-relaxed text-paper/42">
                <strong className="text-amber">Payment step:</strong> this is the first action that moves the agreed amount plus the current on-chain VINSS service fee into Rekber Escrow.
              </p>
              <button
                type="button"
                onClick={handleFund}
                disabled={
                  busy ||
                  !localSecrets ||
                  coordinationAuthorized !== true
                }
                className="w-full rounded-xl bg-amber px-4 py-3.5 text-sm font-medium text-ink disabled:opacity-30"
              >
                {busy
                  ? "Confirm payment in Ready X…"
                  : coordinationAuthorized === null
                    ? "Verifying wallet approvals…"
                    : coordinationAuthorized === false
                      ? "Wallet approvals do not match"
                      : "Secure payment →"}
              </button>
            </div>
          )}

        {accepted &&
          rekberConfigured &&
          acceptAction &&
          !funded &&
          role === "payee" && (
            <div className="rounded-xl bg-paper/[0.025] p-4 text-center">
              <p className="text-sm text-paper/65">
                Ready for funding
              </p>
              <p className="mt-1 text-[10px] text-paper/30">
                Waiting for the Payer to secure the agreed amount in Rekber Escrow.
              </p>
            </div>
          )}

        {accepted && funded && !settled && (
          <div className="space-y-3">
            <div className="rounded-xl bg-signal/[0.065] p-4 ring-1 ring-signal/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.13em] text-signal">
                    Payment secured
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-paper">
                    {accepted.amount}
                    <span className="ml-2 text-base text-paper/45">
                      {accepted.asset}
                    </span>
                  </p>
                  <p className="mt-2 text-[10px] text-paper/35">
                    Refund boundary: {formatDeadline(refundAfter)}
                  </p>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-signal text-sm text-ink">
                  ✓
                </span>
              </div>
              {fundingProofTx && (
                <a
                  href={explorerUrl(
                    fundingProofTx,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-[10px] text-signal"
                >
                  Funding proof ↗
                </a>
              )}
            </div>

            {custodyCommitment &&
              custodyState &&
              role && (
                <RekberProtectionPanel
                  session={session}
                  custodyCommitment={
                    custodyCommitment
                  }
                  state={custodyState}
                  role={role}
                  secrets={localSecrets}
                  dealOfferLocator={
                    dealOfferLocator
                  }
                  payerAddress={
                    agreedPayerAddress
                  }
                  payeeAddress={
                    agreedPayeeAddress
                  }
                  offerSnapshot={
                    createAction
                      ?.offerSnapshot ??
                    null
                  }
                  rekberSetup={
                    createAction
                  }
                  rekberAcceptance={
                    acceptAction
                  }
                  escrowActions={
                    escrowActions
                  }
                  peerAddress={
                    peerAddress
                  }
                  privateDisputeAction={
                    ownDisputeEvidenceRecord
                      ?.action ?? null
                  }
                  mutualRefundConsentAction={
                    mutualRefundConsentRecord
                      ?.action ?? null
                  }
                  onSendCoordination={
                    onSendCoordination
                  }
                  busy={busy}
                  setBusy={setBusy}
                  setError={setError}
                />
              )}

            {role === "payer" && !releaseRecord && (
              <button
                type="button"
                onClick={handleAuthorizeRelease}
                disabled={
                  busy ||
                  !localSecrets ||
                  !custodyState?.fulfillmentConfirmed ||
                  custodyState.revisionPending ||
                  custodyState.disputed
                }
                className="w-full rounded-xl bg-signal px-4 py-3.5 text-sm font-medium text-ink disabled:opacity-30"
              >
                {busy
                  ? "Authorizing release…"
                  : "Approve settlement release →"}
              </button>
            )}

            {role === "payer" && releaseRecord && (
              <div className="rounded-xl bg-paper/[0.025] p-4 text-center">
                <p className="text-sm text-paper/65">
                  Release approved
                </p>
                <p className="mt-1 text-[10px] text-paper/30">
                  Waiting for the payee to combine both private keys and claim payment.
                </p>
              </div>
            )}

            {role === "payee" && !releaseAuthorizationSecret && (
              <div className="rounded-xl bg-paper/[0.025] p-4 text-center">
                <p className="text-sm text-paper/65">
                  Waiting for payer approval
                </p>
                <p className="mt-1 text-[10px] text-paper/30">
                  Your claim key alone cannot release the funds.
                </p>
              </div>
            )}

            {role === "payee" && releaseAuthorizationSecret && (
              <button
                type="button"
                onClick={handleClaimPayment}
                disabled={busy || !localSecrets?.payeeClaimSecret}
                className="w-full rounded-xl bg-signal px-4 py-3.5 text-sm font-medium text-ink disabled:opacity-30"
              >
                {busy
                  ? "Claiming private payment…"
                  : "Claim settlement payment →"}
              </button>
            )}

            {role === "payer" && (
              <button
                type="button"
                onClick={handleRefund}
                disabled={
                  busy ||
                  !refundAvailable ||
                  !localSecrets?.refundSecret
                }
                className="w-full rounded-xl border border-wire/70 px-4 py-3 text-xs text-paper/55 disabled:opacity-25"
              >
                {refundAvailable
                  ? "Refund after timeout"
                  : `Refund unlocks ${formatDeadline(refundAfter)}`}
              </button>
            )}
          </div>
        )}

        {accepted && settled && (
          <div className="space-y-3">
            <div
              className={
                released
                  ? "rounded-xl bg-signal/[0.07] p-4 ring-1 ring-signal/20"
                  : "rounded-xl bg-amber/[0.055] p-4 ring-1 ring-amber/20"
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className={
                      released
                        ? "text-[9px] font-medium uppercase tracking-[0.14em] text-signal"
                        : "text-[9px] font-medium uppercase tracking-[0.14em] text-amber"
                    }
                  >
                    {resolved
                      ? "Resolved"
                      : released
                        ? "Settled"
                        : "Refunded"}
                  </p>

                  {resolved ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-paper/75">
                        Payer · {resolutionPayerDisplay} {accepted.asset}
                      </p>
                      <p className="text-sm font-medium text-paper/75">
                        Payee · {resolutionPayeeDisplay} {accepted.asset}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-3xl font-semibold text-paper">
                      {accepted.amount}
                      <span className="ml-2 text-base font-normal text-paper/45">
                        {accepted.asset}
                      </span>
                    </p>
                  )}

                  <p className="mt-2 text-xs leading-relaxed text-paper/48">
                    {resolved
                      ? "The disputed principal was settled using the authorized Payer/Payee split. This Escrow is now closed."
                      : released
                        ? "Payment released to the Payee. This Escrow is now closed."
                        : "Principal returned to the Payer. This Escrow is now closed."}
                  </p>
                </div>

                <span
                  className={
                    released
                      ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal text-sm text-ink"
                      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber text-sm text-ink"
                  }
                >
                  {resolved
                    ? "↔"
                    : released
                      ? "✓"
                      : "↩"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-wire/45 pt-3">
                <span className="text-[9px] text-paper/28">
                  Escrow closed
                </span>

                <span className="text-[9px] text-paper/40">
                  {formatDeadline(
                    custodyState?.settledAt ??
                      0,
                  )}
                </span>
              </div>

              {!released && (
                <p className="mt-3 text-[9px] leading-relaxed text-paper/30">
                  The VINSS service fee paid during funding is non-refundable and is separate from the principal refund or resolution split.
                </p>
              )}

              {settlementProofTx && (
                <a
                  href={explorerUrl(
                    settlementProofTx,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[10px] text-signal"
                >
                  View transaction ↗
                </a>
              )}
            </div>

            {released && (
              <div className="rounded-xl bg-paper/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-paper/65">
                      NFT Settlement Certificate
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-paper/32">
                      Optional public evidence. Your wallet and amount become publicly linkable — private messages and Offer terms stay hidden.
                    </p>
                    <details className="group mt-1.5">
                      <summary className="cursor-pointer list-none text-[9px] text-signal/80 [&::-webkit-details-marker]:hidden">
                        Learn more ▾
                      </summary>
                      <p className="mt-1.5 text-[9px] leading-relaxed text-paper/28">
                        Claiming links this wallet and role to the custody proof, so the token, amount, and timing can be correlated by anyone. This is separate from your private conversation and Offer, which are never exposed.
                      </p>
                    </details>
                    {role === "payee" && (
                      <p className="mt-2 text-[9px] leading-relaxed text-amber/70">
                        Confirm the payment appears in your private wallet balance before claiming your certificate.
                      </p>
                    )}
                  </div>
                  <span className="text-lg text-signal">
                    ◇
                  </span>
                </div>

                {!certificateConfigured ? (
                  <p className="mt-3 rounded-lg bg-amber/[0.04] px-3 py-2 text-[9px] text-amber/75">
                    Certificate contract is not deployed on this network yet.
                  </p>
                ) : certificateClaimed ? (
                  <div className="mt-3 rounded-lg bg-signal/[0.055] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] text-signal">
                        ✓ Certificate claimed
                      </span>
                      <span className="flex items-center gap-3">
                        {certificateTokenId && (
                          <a
                            href={`/certificate/${certificateTokenId.toString()}`}
                            className="text-[9px] text-signal"
                          >
                            Certificate ↗
                          </a>
                        )}
                        {certificateTx && (
                          <a
                            href={explorerUrl(
                              certificateTx,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] text-signal"
                          >
                            Tx ↗
                          </a>
                        )}
                      </span>
                    </div>
                  </div>
                ) : certificateTx ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-paper/[0.025] px-3 py-2.5">
                    <span className="text-[10px] text-paper/45">
                      Confirming certificate…
                    </span>
                    <a
                      href={explorerUrl(certificateTx)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9px] text-signal"
                    >
                      Tx ↗
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaimCertificate}
                    disabled={
                      busy ||
                      !localSecrets?.certificateSecret
                    }
                    className="mt-3 w-full rounded-xl border border-signal/35 px-4 py-3 text-xs font-medium text-signal disabled:opacity-30"
                  >
                    {busy
                      ? "Claiming certificate…"
                      : role === "payee"
                        ? "I confirmed payment — claim certificate →"
                        : "Claim my public certificate →"}
                  </button>
                )}
              </div>
            )}

            {!resolved && (
              <SettlementFeedback
                outcome={
                  released
                    ? "released"
                    : "refunded"
                }
                role={role}
                dealType={
                  accepted.dealType
                }
              />
            )}
          </div>
        )}

        {custodyCommitment && (
          <details className="group rounded-xl bg-paper/[0.015] p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[9px] text-paper/28 [&::-webkit-details-marker]:hidden">
              <span>Technical details</span>
              <span className="group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="mt-3 space-y-2 border-t border-wire/40 pt-3 font-mono text-[8px] text-paper/30">
              <p className="break-all">
                custody: 0x{custodyCommitment.toString(16)}
              </p>
              <p>
                role: {role ?? "unknown"}
              </p>
              <p>
                state: {settled ? (resolved ? "resolved" : released ? "released" : "refunded") : funded ? "funded" : "coordinating"}
              </p>
            </div>
          </details>
        )}
      </div>
        {/* VINSS_REFUND_COUNTDOWN */}
        {funded &&
          !settled &&
          refundAfter > 0 && (
            <div className="mx-4 mb-4 rounded-xl border border-wire/60 bg-black/10 p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-paper/35">
                    Refund protection
                  </p>

                  <p
                    className={
                      refundAvailable
                        ? "mt-1 text-sm font-medium text-amber"
                        : "mt-1 text-sm font-medium text-paper/75"
                    }
                  >
                    {refundAvailable
                      ? "Refund available now"
                      : `${refundCountdown} remaining`}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[8px] uppercase tracking-[0.1em] text-paper/25">
                    Deadline
                  </p>

                  <p className="mt-1 text-[10px] text-paper/45">
                    {formatDeadline(
                      refundAfter,
                    )}
                  </p>
                </div>
              </div>

              <p className="mt-2 border-t border-wire/40 pt-2 text-[9px] leading-relaxed text-paper/30">
                Release must complete before this deadline. After it passes,
                the payer can recover unsettled funds.
              </p>
            </div>
          )}

    </section>
  );
}
