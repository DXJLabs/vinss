import type {
  Signature,
  TypedData,
  WalletAccountV6,
} from "starknet";
import {
  num,
} from "starknet";

import {
  BACKEND_URL,
} from "@/lib/starknet/constants";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";
import type {
  DisputeAgentPartyPacket,
  EscrowActionPayload,
  EscrowOfferSnapshot,
} from "@/types/deal-room";
import type {
  RekberCustodyState,
  SettlementRole,
} from "@/lib/deal-room/settlement";

export interface DisputeAgentCase {
  custodyCommitment: string;
  verificationClass:
    | "objective"
    | "digital_review"
    | "offchain";
  principal: {
    asset: string;
    rawAmount: string;
  };
  acceptedTerms: {
    dealType: string;
    summary: string;
    obligations: string[];
    completionCriteria: string[];
    deadline?: string;
    reviewPeriodSeconds?: number;
  };
  fulfillment: {
    submitted: boolean;
    confirmed: boolean;
    evidenceCommitment: string;
    submittedAt?: string;
  };
  payer: DisputeAgentPartyPacket;
  payee: DisputeAgentPartyPacket;
  onChain: {
    disputed: boolean;
    consumed: boolean;
    resolutionAuthorized: boolean;
    fulfillmentSubmitted: boolean;
    fulfillmentConfirmed: boolean;
  };
}

export interface DisputeAgentChallenge {
  network: "sepolia" | "mainnet";
  caseCommitment: string;
  typedData: {
    payer: TypedData;
    payee: TypedData;
  };
}

export interface DisputeAgentDecision {
  decision:
    | "payer"
    | "payee"
    | "split"
    | "needs_review";
  payerBps: number;
  payeeBps: number;
  confidence: number;
  reason: string;
  evidenceCommitment: string;
  flags: string[];
}

export interface DisputeExecutionResult {
  status:
    | "authorized"
    | "already_authorized"
    | "not_enabled"
    | "not_eligible";
  transactionHash?: string;
  payerAmount?: string;
  payeeAmount?: string;
}

export interface DisputeAgentResult {
  caseCommitment: string;
  decision: DisputeAgentDecision;
  policy: {
    status:
      | "AUTO_RESOLVE"
      | "NEEDS_REVIEW"
      | "REJECTED";
    reasons: string[];
  };
  provider: string;
  model: string;
  network: string;
  execution: DisputeExecutionResult;
}

/**
 * Minimal proof that the Payer/Payee are the wallets that signed the original
 * Rekber Agreement. No private Rekber secret/preimage is disclosed.
 */
export interface DisputeRekberBinding {
  setup: {
    custodyCommitment: string;
    dealOfferLocator: string;
    dealTermsCommitment: string;
    payerAddress: string;
    payeeAddress: string;
    releaseAuthorizationCommitment: string;
    refundCommitment: string;
    payerConfirmationCommitment: string;
    payerDisputeCommitment: string;
    revisionChainHead: string;
    payerCertificateCommitment: string;
    fulfillmentDeadline: string;
    signature: string[];
  };
  acceptance: {
    custodyCommitment: string;
    dealOfferLocator: string;
    dealTermsCommitment: string;
    payerAddress: string;
    payeeAddress: string;
    payeeClaimCommitment: string;
    payeeDisputeCommitment: string;
    payeeRefundConsentCommitment: string;
    fulfillmentChainHead: string;
    payeeCertificateCommitment: string;
    fulfillmentDeadline: string;
    signature: string[];
  };
}

function bindingField(
  value: string | undefined,
  label: string,
): string {
  if (!value) {
    throw new Error(
      `Rekber arbitration binding is missing ${label}.`,
    );
  }

  return value;
}

export function buildDisputeRekberBinding(
  setup: EscrowActionPayload,
  acceptance: EscrowActionPayload,
): DisputeRekberBinding {
  if (
    setup.kind !== "create" ||
    acceptance.kind !== "accept" ||
    setup.coordinationVersion !== 3 ||
    acceptance.coordinationVersion !== 3 ||
    !setup.coordinationSignature?.length ||
    !acceptance.coordinationSignature?.length
  ) {
    throw new Error(
      "The signed Rekber Agreement is not ready for arbitration.",
    );
  }

  return {
    setup: {
      custodyCommitment:
        bindingField(setup.custodyCommitment, "setup custody"),
      dealOfferLocator:
        bindingField(setup.dealOfferLocator, "setup deal"),
      dealTermsCommitment:
        bindingField(setup.dealTermsCommitment, "private terms commitment"),
      payerAddress:
        bindingField(setup.senderAddress, "payer"),
      payeeAddress:
        bindingField(setup.recipientAddress, "payee"),
      releaseAuthorizationCommitment:
        bindingField(setup.releaseAuthorizationCommitment, "release commitment"),
      refundCommitment:
        bindingField(setup.refundCommitment, "refund commitment"),
      payerConfirmationCommitment:
        bindingField(setup.payerConfirmationCommitment, "payer confirmation commitment"),
      payerDisputeCommitment:
        bindingField(setup.payerDisputeCommitment, "payer dispute commitment"),
      revisionChainHead:
        bindingField(setup.revisionChainHead, "revision chain"),
      payerCertificateCommitment:
        bindingField(setup.payerCertificateCommitment, "payer certificate commitment"),
      fulfillmentDeadline:
        bindingField(setup.refundAfter, "fulfillment deadline"),
      signature:
        setup.coordinationSignature,
    },
    acceptance: {
      custodyCommitment:
        bindingField(acceptance.custodyCommitment, "acceptance custody"),
      dealOfferLocator:
        bindingField(acceptance.dealOfferLocator, "acceptance deal"),
      dealTermsCommitment:
        bindingField(acceptance.dealTermsCommitment, "acceptance private terms commitment"),
      payerAddress:
        bindingField(acceptance.recipientAddress, "acceptance payer"),
      payeeAddress:
        bindingField(acceptance.senderAddress, "acceptance payee"),
      payeeClaimCommitment:
        bindingField(acceptance.payeeClaimCommitment, "payee claim commitment"),
      payeeDisputeCommitment:
        bindingField(acceptance.payeeDisputeCommitment, "payee dispute commitment"),
      payeeRefundConsentCommitment:
        bindingField(acceptance.payeeRefundConsentCommitment, "refund consent commitment"),
      fulfillmentChainHead:
        bindingField(acceptance.fulfillmentChainHead, "fulfillment chain"),
      payeeCertificateCommitment:
        bindingField(acceptance.payeeCertificateCommitment, "payee certificate commitment"),
      fulfillmentDeadline:
        bindingField(acceptance.refundAfter, "acceptance fulfillment deadline"),
      signature:
        acceptance.coordinationSignature,
    },
  };
}

export interface EscrowCoordinationRecord {
  action: EscrowActionPayload;
}

function felt(
  value: bigint,
): string {
  return num.toHex(value);
}

function verificationClass(
  policy: number,
): DisputeAgentCase["verificationClass"] {
  if (policy === 3) {
    return "objective";
  }

  if (policy === 2) {
    return "offchain";
  }

  return "digital_review";
}

/*
 * Mainnet-fast evidence is text-only. File evidence can later append
 * attachment items without changing this case or backend contract.
 */
export function createDisputeAgentPacket(
  role: SettlementRole,
  walletAddress: string,
  statement: string,
): DisputeAgentPartyPacket {
  const clean =
    statement.trim();

  if (!clean) {
    throw new Error(
      "Add dispute evidence before submitting it to the Agent.",
    );
  }

  return {
    role,
    walletAddress,
    consentToAgentReview: true,
    statement: clean,
    evidence: [
      {
        kind: "statement",
        label:
          `${role} evidence statement`,
        value: clean,
      },
    ],
    submittedAt:
      new Date().toISOString(),
  };
}

export function buildDisputeAgentCase(
  input: {
    custodyCommitment: bigint;
    state: RekberCustodyState;
    offerSnapshot: EscrowOfferSnapshot;
    payerPacket: DisputeAgentPartyPacket;
    payeePacket: DisputeAgentPartyPacket;
  },
): DisputeAgentCase {
  const {
    custodyCommitment,
    state,
    offerSnapshot,
    payerPacket,
    payeePacket,
  } = input;

  const paymentTerms =
    offerSnapshot.paymentTerms.trim();
  const conditions =
    offerSnapshot.conditions?.trim() ?? "";

  /*
   * Accepted Offer remains the authority. We do not pull unrelated chat into
   * Agent context. Conditions become completion criteria when present.
   */
  const obligations = [
    paymentTerms ||
      `Complete the accepted ${offerSnapshot.dealType ?? "deal"} obligation.`,
  ];

  const completionCriteria = [
    conditions ||
      "Fulfillment must match the Accepted Offer and submitted evidence.",
  ];

  return {
    custodyCommitment:
      felt(custodyCommitment),
    verificationClass:
      verificationClass(
        state.verificationPolicy,
      ),
    principal: {
      asset:
        offerSnapshot.asset,
      rawAmount:
        state.amount.toString(),
    },
    acceptedTerms: {
      dealType:
        offerSnapshot.dealType ??
        "other",
      summary:
        `${offerSnapshot.amount} ${offerSnapshot.asset} · ${paymentTerms || "Accepted private deal"}`,
      obligations,
      completionCriteria,
      deadline:
        offerSnapshot.expiresAt,
      reviewPeriodSeconds:
        state.reviewWindow ||
        undefined,
    },
    fulfillment: {
      submitted:
        state.fulfillmentSubmitted,
      confirmed:
        state.fulfillmentConfirmed,
      evidenceCommitment:
        felt(
          state
            .fulfillmentEvidenceCommitment,
        ),
      submittedAt:
        state.fulfilledAt
          ? new Date(
              state.fulfilledAt *
                1000,
            ).toISOString()
          : undefined,
    },
    payer:
      payerPacket,
    payee:
      payeePacket,
    onChain: {
      disputed:
        state.disputed,
      consumed:
        state.consumed,
      resolutionAuthorized:
        state.resolutionAuthorized,
      fulfillmentSubmitted:
        state.fulfillmentSubmitted,
      fulfillmentConfirmed:
        state.fulfillmentConfirmed,
    },
  };
}

export function findLatestDisputeAgentPacket<
  T extends EscrowCoordinationRecord,
>(
  actions: readonly T[],
  custodyCommitment: bigint,
  walletAddress: string,
): T | null {
  return (
    [...actions]
      .reverse()
      .find(
        (item) =>
          item.action.kind ===
            "dispute" &&
          item.action
            .custodyCommitment &&
          BigInt(
            item.action
              .custodyCommitment,
          ) ===
            custodyCommitment &&
          Boolean(
            item.action
              .disputeAgentPacket,
          ) &&
          sameStarknetAddress(
            item.action
              .disputeAgentPacket!
              .walletAddress,
            walletAddress,
          ),
      ) ?? null
  );
}

export function findLatestDisputeAgentSignature<
  T extends EscrowCoordinationRecord,
>(
  actions: readonly T[],
  custodyCommitment: bigint,
  walletAddress: string,
  caseCommitment: string,
): T | null {
  return (
    [...actions]
      .reverse()
      .find(
        (item) =>
          item.action.kind ===
            "dispute" &&
          item.action
            .custodyCommitment &&
          BigInt(
            item.action
              .custodyCommitment,
          ) ===
            custodyCommitment &&
          item.action
            .disputeAgentCaseCommitment ===
            caseCommitment &&
          Boolean(
            item.action
              .disputeAgentSignature
              ?.length,
          ) &&
          Boolean(
            item.action
              .senderAddress &&
              sameStarknetAddress(
                item.action
                  .senderAddress,
                walletAddress,
              ),
          ),
      ) ?? null
  );
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const response =
    await fetch(
      `${BACKEND_URL}${path}`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
        body:
          JSON.stringify(body),
      },
    );

  const data =
    (await response.json()) as
      Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      typeof data.error ===
        "string"
        ? data.error
        : "Dispute Agent request failed.",
    );
  }

  return data as T;
}

export function requestDisputeAgentChallenge(
  disputeCase: DisputeAgentCase,
  binding: DisputeRekberBinding,
): Promise<DisputeAgentChallenge> {
  return postJson(
    "/dispute/challenge",
    {
      case: disputeCase,
      binding,
    },
  );
}

export function evaluateDisputeWithAgent(
  disputeCase: DisputeAgentCase,
  attestations: {
    payer: string[];
    payee: string[];
  },
  binding: DisputeRekberBinding,
): Promise<DisputeAgentResult> {
  return postJson(
    "/dispute/evaluate",
    {
      case: disputeCase,
      attestations,
      binding,
    },
  );
}

function signatureToStrings(
  signature: Signature,
): string[] {
  if (Array.isArray(signature)) {
    return signature.map(
      (item) =>
        num.toHex(item),
    );
  }

  return [
    num.toHex(signature.r),
    num.toHex(signature.s),
  ];
}

export async function signDisputeAgentChallenge(
  account: WalletAccountV6,
  typedData: TypedData,
): Promise<string[]> {
  return signatureToStrings(
    await account.signMessage(
      typedData,
    ),
  );
}
