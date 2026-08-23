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
  computeRekberV2RefundCommitment,
  computeReleaseAuthorizationCommitment,
  depositEscrowV2,
  generatePayeeSettlementSecrets,
  generatePayerSettlementSecrets,
  generateRekberV2CustodyCommitment,
  getRekberV2Custody,
  getRekberV2Proof,
  isSettlementCertificateClaimed,
  refundEscrowV2,
  releaseEscrowV2,
  type RekberV2CustodyState,
  type SettlementRole,
} from "@/lib/deal-room/settlementV2";
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
  NETWORK,
} from "@/lib/starknet/constants";
import {
  humanizeError,
} from "@/lib/errors/uiError";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import {
  explorerUrl,
  shortAddress,
} from "@/components/room/conversation/chatFormat";

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

function canonicalLocator(
  value: string | undefined,
): string {
  if (!value) return "";
  return value
    .replace(/^0x/, "")
    .toLowerCase();
}

function toBigInt(
  value: string | undefined,
): bigint | null {
  if (!value) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatDeadline(
  unixSeconds: number,
): string {
  if (!unixSeconds) return "—";

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(unixSeconds * 1000),
  );
}

function hasCustody(
  action: EscrowActionPayload,
  custody: bigint | null,
): boolean {
  if (!custody) return false;
  const parsed = toBigInt(
    action.custodyCommitment,
  );
  return parsed === custody;
}

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
    useState<RekberV2CustodyState | null>(null);
  const [fundingProofTx, setFundingProofTx] =
    useState("");
  const [settlementProofTx, setSettlementProofTx] =
    useState("");
  const [certificateClaimed, setCertificateClaimed] =
    useState(false);
  const [certificateTx, setCertificateTx] =
    useState("");
  const [backupCopied, setBackupCopied] =
    useState(false);
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

  const legacyPrepared = useMemo(
    () =>
      [...offerEntries]
        .reverse()
        .find((entry) => {
          const action = entry.offerAction;

          return (
            action?.kind === "prepare_escrow" &&
            action.rekberVersion !== 2 &&
            Boolean(action.custodyCommitment) &&
            canonicalLocator(
              action.parentOfferLocator,
            ) ===
              canonicalLocator(
                acceptedOffer?.actionLocator,
              )
          );
        }) ?? null,
    [
      acceptedOffer?.actionLocator,
      offerEntries,
    ],
  );

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

  const createRecord =
    localCreate ?? discoveredCreate;
  const createAction =
    createRecord?.action ?? null;
  const legacyDeal = Boolean(
    legacyPrepared &&
      !createAction,
  );

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
    localAccept ?? discoveredAccept;
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

  const refundAfter = Number(
    createAction?.refundAfter ??
      custodyState?.refundAfter ??
      0,
  );
  const refundAvailable =
    Boolean(refundAfter) &&
    Math.floor(Date.now() / 1000) >=
      refundAfter;

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
      !expected.payerCertificateCommitment ||
      !expected.payeeClaimCommitment ||
      !expected.payeeCertificateCommitment ||
      !refundAfter
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
      custodyState.refundCommitment ===
        expected.refundCommitment &&
      custodyState.payerCertificateCommitment ===
        expected.payerCertificateCommitment &&
      custodyState.payeeCertificateCommitment ===
        expected.payeeCertificateCommitment &&
      custodyState.refundAfter ===
        refundAfter &&
      custodyState.amount ===
        expectedAmount &&
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
        computeRekberV2RefundCommitment(
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
  const released =
    settled && !custodyState?.refunded;
  const v2Configured = Boolean(
    CONTRACTS.escrowRekberV2,
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
      !v2Configured
    ) {
      setCustodyState(null);
      return;
    }

    let cancelled = false;

    const sync = async () => {
      const next =
        await getRekberV2Custody(
          custodyCommitment,
        );

      if (cancelled) return;
      setCustodyState(next);

      if (next) {
        const funding =
          await getRekberV2Proof(
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
        const outcome = next.refunded
          ? "refunded"
          : "released";
        const proof =
          await getRekberV2Proof(
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
      5000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    custodyCommitment,
    v2Configured,
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
    if (
      coordinationLockRef.current ||
      !session ||
      !channelKey ||
      !acceptedOffer ||
      !accepted ||
      !peerAddress ||
      legacyDeal ||
      createAction ||
      role !== "payer"
    ) {
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
    setBusy(true);
    setError(null);

    let pending = pendingPayerSetup;

    try {
      if (!pending) {
        setCoordinationPhase(
          "payer-signature",
        );

        const custody =
          generateRekberV2CustodyCommitment();
        const secrets =
          generatePayerSettlementSecrets();
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
            computeRekberV2RefundCommitment(
              custody,
              secrets.refundSecret,
            ).toString(),
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
      setError(
        humanizeError(
          error,
          "Escrow setup is not complete. Tap Continue setup to reuse the same approval.",
        ),
      );
    } finally {
      coordinationLockRef.current = false;
      setCoordinationPhase("idle");
      setBusy(false);
    }
  }

  async function handleAcceptRekber() {
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

    coordinationLockRef.current = true;
    setBusy(true);
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
          generatePayeeSettlementSecrets();
        const stored: StoredRekberSecrets = {
          version: 2,
          custodyCommitment:
            custodyCommitment.toString(),
          role: "payee",
          payeeClaimSecret:
            secrets.payeeClaimSecret.toString(),
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
      setError(
        humanizeError(
          error,
          "Escrow approval is not complete. Tap continue to reuse the same approval.",
        ),
      );
    } finally {
      coordinationLockRef.current = false;
      setCoordinationPhase("idle");
      setBusy(false);
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
      !payerCertificateCommitment ||
      !payeeClaimCommitment ||
      !payeeCertificateCommitment ||
      !refundAfter ||
      !settlementAsset?.address
    ) {
      setError(
        "Secure Escrow commitments are incomplete. Sync the room and try again.",
      );
      return;
    }

    setBusy(true);
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
        await depositEscrowV2(
          session.account,
          {
            custodyCommitment,
            releaseAuthorizationCommitment,
            payeeClaimCommitment,
            refundCommitment,
            payerCertificateCommitment,
            payeeCertificateCommitment,
            refundAfter,
            token:
              settlementAsset.address,
            amount,
          },
        );

      setFundingProofTx(
        result.transactionHash,
      );
      setCustodyState(
        await getRekberV2Custody(
          custodyCommitment,
        ),
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
      setError(
        humanizeError(
          error,
          "We couldn't secure the payment.",
        ),
      );
    } finally {
      setBusy(false);
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
      settled ||
      releaseRecord
    ) {
      return;
    }

    setBusy(true);
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
      setError(
        humanizeError(
          error,
          "We couldn't authorize release.",
        ),
      );
    } finally {
      setBusy(false);
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

    setBusy(true);
    setError(null);

    try {
      const result =
        await releaseEscrowV2(
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

      setCustodyState(
        await getRekberV2Custody(
          custodyCommitment,
        ),
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
      setError(
        humanizeError(
          error,
          "We couldn't claim the settlement.",
        ),
      );
    } finally {
      setBusy(false);
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

    setBusy(true);
    setError(null);

    try {
      const result =
        await refundEscrowV2(
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
      setCustodyState(
        await getRekberV2Custody(
          custodyCommitment,
        ),
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
      setError(
        humanizeError(
          error,
          "We couldn't refund the Escrow payment.",
        ),
      );
    } finally {
      setBusy(false);
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

    setBusy(true);
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
      setError(
        humanizeError(
          error,
          "We couldn't claim the settlement certificate.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyBackup() {
    if (!localSecrets) return;

    await navigator.clipboard.writeText(
      JSON.stringify(
        localSecrets,
        null,
        2,
      ),
    );
    setBackupCopied(true);
    window.setTimeout(
      () => setBackupCopied(false),
      1800,
    );
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
    "Role",
    "Approval",
    "Funds",
    "Settlement",
    "Proof",
  ];

  return (
    <section className="overflow-hidden rounded-2xl bg-vault/70 ring-1 ring-wire/60">
      <header className="border-b border-wire/50 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-signal/75">
              Secure payment via STRK20
            </p>
            <h3 className="mt-1 text-xl font-medium text-paper">
              VINSS Escrow
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-paper/38">
              The Payer secures the funds. The Payee claims them after the work is approved.
            </p>
          </div>

          <span
            className={
              NETWORK === "mainnet"
                ? "rounded-full bg-signal/[0.08] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-signal"
                : "rounded-full bg-amber/[0.08] px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-amber"
            }
          >
            {NETWORK === "mainnet"
              ? "Mainnet"
              : "Sepolia"}
            {" · V2"}
          </span>
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
                      ? "mt-1.5 truncate text-[8px] text-paper/55"
                      : "mt-1.5 truncate text-[8px] text-paper/22"
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

      <div className="space-y-4 p-4">
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
          <div className="rounded-xl bg-paper/[0.025] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.13em] text-paper/28">
                  Agreed amount
                </p>
                <p className="mt-2 text-2xl font-semibold text-paper">
                  {accepted.amount}
                  <span className="ml-2 text-sm font-medium text-paper/45">
                    {accepted.asset}
                  </span>
                </p>
              </div>
              <span className="text-[10px] text-signal">
                ✓ Approved
              </span>
            </div>
          </div>
        )}

        {accepted && legacyDeal && (
          <div className="rounded-xl border border-amber/25 bg-amber/[0.04] p-4">
            <p className="text-xs font-medium text-amber">
              Existing Escrow V1 deal
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-paper/35">
              This agreement may already hold funds in the legacy Escrow contract. It cannot be migrated into V2. Do not fund it again; create a new Offer when testing V2 settlement.
            </p>
          </div>
        )}

        {accepted && !legacyDeal && !v2Configured && (
          <div className="rounded-xl border border-amber/25 bg-amber/[0.04] p-4">
            <p className="text-xs font-medium text-amber">
              Secure settlement is not deployed on this network
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-paper/35">
              Configure NEXT_PUBLIC_ESCROW_REKBER_V2_ADDRESS after the V2 contract passes testnet release and refund verification.
            </p>
          </div>
        )}

        {accepted && createAction && role && (
          <div className="rounded-xl bg-paper/[0.025] p-3 ring-1 ring-wire/55">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.12em] text-paper/28">
                  This wallet's role · locked
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

        {accepted && !legacyDeal && v2Configured && !createAction && (
          <div className="space-y-3">
            <div className="rounded-xl bg-signal/[0.045] p-4 ring-1 ring-signal/15">
              <p className="text-[9px] uppercase tracking-[0.12em] text-signal/70">
                Role set by the original Offer
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
                    Step 1 · Prepare Escrow
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
                  Ready X opens twice: <strong className="text-paper/60">(1) sign</strong> the approval, then <strong className="text-paper/60">(2) send</strong> the private setup. Complete both once.
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
                    ? "1/2 · Sign in Ready X…"
                    : coordinationPhase === "payer-send"
                      ? "2/2 · Send setup in Ready X…"
                      : pendingPayerSetup
                        ? "Continue setup →"
                        : "Prepare Escrow →"}
                </button>
              </>
            )}
          </div>
        )}

        {accepted &&
          v2Configured &&
          createAction &&
          !acceptAction &&
          role === "payee" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-signal/[0.045] p-4">
                <p className="text-sm font-medium text-paper/75">
                  Escrow request received
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
          v2Configured &&
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
          v2Configured &&
          acceptAction &&
          !funded &&
          role === "payer" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-paper/[0.03] p-4">
                <p className="text-[9px] uppercase tracking-[0.13em] text-signal/70">
                  Payee approved
                </p>
                <p className="mt-2 text-3xl font-semibold text-paper">
                  {accepted.amount}
                  <span className="ml-2 text-base text-paper/45">
                    {accepted.asset}
                  </span>
                </p>
                <div className="mt-4 border-t border-wire/45 pt-3">
                  <FeeBreakdown
                    amount={accepted.amount}
                    unit={accepted.asset}
                    label="VINSS fee"
                    feeBps={100}
                  />
                </div>
              </div>
              <p className="rounded-xl border border-amber/25 bg-amber/[0.04] px-3 py-2.5 text-[10px] leading-relaxed text-paper/42">
                <strong className="text-amber">Funding step:</strong> this is the first action that debits the agreed amount plus the 1% VINSS fee and locks it in the Escrow contract.
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
                      : "Secure funds →"}
              </button>
            </div>
          )}

        {accepted &&
          v2Configured &&
          acceptAction &&
          !funded &&
          role === "payee" && (
            <div className="rounded-xl bg-paper/[0.025] p-4 text-center">
              <p className="text-sm text-paper/65">
                Escrow approved
              </p>
              <p className="mt-1 text-[10px] text-paper/30">
                Waiting for the Payer to deposit the agreed amount into the Escrow contract.
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

            {role === "payer" && !releaseRecord && (
              <button
                type="button"
                onClick={handleAuthorizeRelease}
                disabled={busy || !localSecrets}
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
              <p
                className={
                  released
                    ? "text-[9px] uppercase tracking-[0.13em] text-signal"
                    : "text-[9px] uppercase tracking-[0.13em] text-amber"
                }
              >
                {released
                  ? "Settlement released"
                  : "Escrow refunded"}
              </p>
              <p className="mt-2 text-sm text-paper/70">
                {released
                  ? "The payee claimed the secured payment."
                  : "The payer recovered the payment after the timeout."}
              </p>
              <p className="mt-2 text-[9px] text-paper/28">
                Settled {formatDeadline(custodyState?.settledAt ?? 0)}
              </p>
              {settlementProofTx && (
                <a
                  href={explorerUrl(
                    settlementProofTx,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[10px] text-signal"
                >
                  Settlement evidence ↗
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
                      Optional public evidence claimed by this wallet itself. Claiming links this wallet and role to the custody proof; public token, amount, and timing can be correlated. Private messages and Offer terms stay hidden.
                    </p>
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
          </div>
        )}

        {localSecrets && custodyCommitment && (
          <details className="group rounded-xl border border-wire/45 bg-paper/[0.015] p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[9px] text-paper/32 [&::-webkit-details-marker]:hidden">
              <span>Recovery backup</span>
              <span className="group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="mt-3 border-t border-wire/40 pt-3">
              <p className="text-[9px] leading-relaxed text-danger/70">
                These one-time secrets control settlement or recovery. Keep the backup private and offline.
              </p>
              <button
                type="button"
                onClick={handleCopyBackup}
                className="mt-3 rounded-lg border border-wire/70 px-3 py-2 text-[9px] text-paper/55"
              >
                {backupCopied
                  ? "Copied ✓"
                  : "Copy recovery JSON"}
              </button>
            </div>
          </details>
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
                state: {settled ? (released ? "released" : "refunded") : funded ? "funded" : "coordinating"}
              </p>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
