/** Rekber custody, release, refund, and Settlement Certificate operations. */

import type { WalletAccountV6 } from "starknet";
import { hash, num } from "starknet";
import { getProvider } from "@/lib/starknet/walletClient";
import { CONTRACTS } from "@/lib/starknet/constants";
import {
  shortStringToFelt,
  toFelt,
} from "@/lib/privacy/envelope";
import { quoteRekberFee } from "@/lib/starknet/feePolicy";

const RELEASE_AUTH_DOMAIN =
  "VINSS_RELEASE_AUTH";
const PAYEE_CLAIM_DOMAIN =
  "VINSS_PAYEE_CLAIM";
const REFUND_DOMAIN =
  "VINSS_ESCROW_REFUND";
const PAYER_CONFIRM_DOMAIN =
  "VINSS_PAYER_CONFIRM";
const PAYER_DISPUTE_DOMAIN =
  "VINSS_PAYER_DISPUTE";
const PAYEE_DISPUTE_DOMAIN =
  "VINSS_PAYEE_DISPUTE";
const PAYEE_REFUND_CONSENT_DOMAIN =
  "VINSS_REFUND_CONSENT";
const FULFILLMENT_CHAIN_DOMAIN =
  "VINSS_FULFILL_CHAIN";
const REVISION_CHAIN_DOMAIN =
  "VINSS_REVISION_CHAIN";
const CERTIFICATE_CLAIM_DOMAIN =
  "VINSS_CERT_CLAIM";
const CERTIFICATE_TOKEN_DOMAIN =
  "VINSS_CERT_TOKEN";

export type SettlementRole =
  | "payer"
  | "payee";

export interface PayerSettlementSecrets {
  releaseAuthorizationSecret: bigint;
  refundSecret: bigint;
  payerConfirmationSecret: bigint;
  payerDisputeSecret: bigint;
  revisionChainHead: bigint;
  revisionChainSecrets: bigint[];
  certificateSecret: bigint;
}

export interface PayeeSettlementSecrets {
  payeeClaimSecret: bigint;
  payeeDisputeSecret: bigint;
  payeeRefundConsentSecret: bigint;
  fulfillmentChainHead: bigint;
  fulfillmentChainSecrets: bigint[];
  certificateSecret: bigint;
}

export interface RekberCustodyState {
  custodyCommitment: bigint;
  releaseAuthorizationCommitment: bigint;
  payeeClaimCommitment: bigint;
  refundCommitment: bigint;
  payerConfirmationCommitment: bigint;
  payerDisputeCommitment: bigint;
  payeeDisputeCommitment: bigint;
  payeeRefundConsentCommitment: bigint;
  fulfillmentChainHead: bigint;
  revisionChainHead: bigint;
  payerCertificateCommitment: bigint;
  payeeCertificateCommitment: bigint;
  token: string;
  amount: bigint;
  feeAmount: bigint;
  refundAfter: number;
  reviewWindow: number;
  reviewDeadline: number;
  revisionDeadline: number;
  verificationPolicy: number;
  fulfillmentRoundsRemaining: number;
  revisionRoundsRemaining: number;
  fulfillmentEvidenceCommitment: bigint;
  fulfillmentSubmitted: boolean;
  fulfillmentConfirmed: boolean;
  revisionPending: boolean;
  disputed: boolean;
  resolutionAuthorized: boolean;
  consumed: boolean;
  refunded: boolean;
  createdAt: number;
  fulfilledAt: number;
  settledAt: number;
}

export interface RekberProof {
  kind: "funded" | "released" | "refunded";
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface SettlementCertificateRecord {
  tokenId: bigint;
  custodyCommitment: bigint;
  role: SettlementRole;
  recipient: string;
  settledAt: number;
  issuedAt: number;
}

function randomFelt(): bigint {
  let value = 0n;

  while (value === 0n) {
    const bytes = crypto.getRandomValues(
      new Uint8Array(31),
    );

    value = BigInt(
      `0x${Array.from(bytes)
        .map((byte) =>
          byte.toString(16).padStart(2, "0"),
        )
        .join("")}`,
    );
  }

  return value;
}

function poseidon(
  domain: string,
  values: Array<bigint | string>,
): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements([
      String(shortStringToFelt(domain)),
      ...values.map(String),
    ]),
  );
}

function generateSecretChain(
  custodyCommitment: bigint,
  rounds: number,
  domain: string,
): {
  head: bigint;
  secrets: bigint[];
} {
  if (!Number.isInteger(rounds) || rounds < 0 || rounds > 8) {
    throw new Error("Invalid Rekber secret-chain round count.");
  }

  if (rounds === 0) {
    return {
      head: 0n,
      secrets: [],
    };
  }

  const secrets =
    new Array<bigint>(rounds);

  secrets[rounds - 1] =
    randomFelt();

  for (
    let index = rounds - 2;
    index >= 0;
    index--
  ) {
    secrets[index] = poseidon(
      domain,
      [
        custodyCommitment,
        secrets[index + 1]!,
      ],
    );
  }

  return {
    head: poseidon(
      domain,
      [
        custodyCommitment,
        secrets[0]!,
      ],
    ),
    secrets,
  };
}

export function generatePayerSettlementSecrets(
  custodyCommitment: bigint,
  revisionRounds: number,
): PayerSettlementSecrets {
  const revisionChain =
    generateSecretChain(
      custodyCommitment,
      revisionRounds,
      REVISION_CHAIN_DOMAIN,
    );

  return {
    releaseAuthorizationSecret:
      randomFelt(),
    refundSecret:
      randomFelt(),
    payerConfirmationSecret:
      randomFelt(),
    payerDisputeSecret:
      randomFelt(),
    revisionChainHead:
      revisionChain.head,
    revisionChainSecrets:
      revisionChain.secrets,
    certificateSecret:
      randomFelt(),
  };
}

export function generatePayeeSettlementSecrets(
  custodyCommitment: bigint,
  fulfillmentRounds: number,
): PayeeSettlementSecrets {
  const fulfillmentChain =
    generateSecretChain(
      custodyCommitment,
      fulfillmentRounds,
      FULFILLMENT_CHAIN_DOMAIN,
    );

  return {
    payeeClaimSecret:
      randomFelt(),
    payeeDisputeSecret:
      randomFelt(),
    payeeRefundConsentSecret:
      randomFelt(),
    fulfillmentChainHead:
      fulfillmentChain.head,
    fulfillmentChainSecrets:
      fulfillmentChain.secrets,
    certificateSecret:
      randomFelt(),
  };
}

export function generateRekberCustodyCommitment(): bigint {
  return randomFelt();
}

export function computeReleaseAuthorizationCommitment(
  custodyCommitment: bigint,
  secret: bigint,
): bigint {
  return poseidon(
    RELEASE_AUTH_DOMAIN,
    [custodyCommitment, secret],
  );
}

export function computePayeeClaimCommitment(
  custodyCommitment: bigint,
  secret: bigint,
): bigint {
  return poseidon(
    PAYEE_CLAIM_DOMAIN,
    [custodyCommitment, secret],
  );
}

export function computeRekberRefundCommitment(
  custodyCommitment: bigint,
  secret: bigint,
): bigint {
  return poseidon(
    REFUND_DOMAIN,
    [custodyCommitment, secret],
  );
}

export function computePayerConfirmationCommitment(
  custodyCommitment: bigint,
  secret: bigint,
): bigint {
  return poseidon(
    PAYER_CONFIRM_DOMAIN,
    [custodyCommitment, secret],
  );
}

export function computePayerDisputeCommitment(
  custodyCommitment: bigint,
  secret: bigint,
): bigint {
  return poseidon(
    PAYER_DISPUTE_DOMAIN,
    [custodyCommitment, secret],
  );
}

export function computePayeeDisputeCommitment(
  custodyCommitment: bigint,
  secret: bigint,
): bigint {
  return poseidon(
    PAYEE_DISPUTE_DOMAIN,
    [custodyCommitment, secret],
  );
}

export function computePayeeRefundConsentCommitment(
  custodyCommitment: bigint,
  secret: bigint,
): bigint {
  return poseidon(
    PAYEE_REFUND_CONSENT_DOMAIN,
    [custodyCommitment, secret],
  );
}

export function computeCertificateClaimCommitment(
  custodyCommitment: bigint,
  role: SettlementRole,
  recipient: string,
  secret: bigint,
): bigint {
  return poseidon(
    CERTIFICATE_CLAIM_DOMAIN,
    [
      custodyCommitment,
      role === "payer" ? 1n : 2n,
      BigInt(num.toHex(recipient)),
      secret,
    ],
  );
}

export function computeCertificateTokenId(
  custodyCommitment: bigint,
  role: SettlementRole,
): bigint {
  return poseidon(
    CERTIFICATE_TOKEN_DOMAIN,
    [
      custodyCommitment,
      role === "payer" ? 1n : 2n,
    ],
  );
}

function requireRekberAddress(): string {
  if (!CONTRACTS.escrowRekber) {
    throw new Error(
      "Rekber is not configured for this network.",
    );
  }

  return CONTRACTS.escrowRekber;
}

export async function depositEscrow(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    releaseAuthorizationCommitment: bigint;
    payeeClaimCommitment: bigint;
    refundCommitment: bigint;
    payerConfirmationCommitment: bigint;
    payerDisputeCommitment: bigint;
    payeeDisputeCommitment: bigint;
    payeeRefundConsentCommitment: bigint;
    fulfillmentChainHead: bigint;
    revisionChainHead: bigint;
    payerCertificateCommitment: bigint;
    payeeCertificateCommitment: bigint;
    refundAfter: number;
    reviewWindow: number;
    verificationPolicy: number;
    fulfillmentRounds: number;
    revisionRounds: number;
    token: string;
    amount: bigint;
  },
): Promise<{ transactionHash: string }> {
  const escrow =
    requireRekberAddress();
  const rawTreasury =
    process.env
      .NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!rawTreasury) {
    throw new Error(
      "VINSS treasury is not configured for this network.",
    );
  }

  const treasury =
    num.toHex(rawTreasury);
  const token =
    num.toHex(params.token);

  // Rekber requires an exact quote. Fetch it immediately before Ready X
  // constructs the funding transaction.
  const fee =
    await quoteRekberFee(
      token,
      params.amount,
    );

  const payload = [
    toFelt(1),
    toFelt(params.custodyCommitment),
    toFelt(
      params.releaseAuthorizationCommitment,
    ),
    toFelt(params.payeeClaimCommitment),
    toFelt(params.refundCommitment),
    toFelt(
      params.payerConfirmationCommitment,
    ),
    toFelt(
      params.payerDisputeCommitment,
    ),
    toFelt(
      params.payeeDisputeCommitment,
    ),
    toFelt(
      params.payeeRefundConsentCommitment,
    ),
    toFelt(params.fulfillmentChainHead),
    toFelt(params.revisionChainHead),
    toFelt(
      params.payerCertificateCommitment,
    ),
    toFelt(
      params.payeeCertificateCommitment,
    ),
    toFelt(params.refundAfter),
    toFelt(params.reviewWindow),
    toFelt(params.verificationPolicy),
    toFelt(params.fulfillmentRounds),
    toFelt(params.revisionRounds),
    token,
    toFelt(params.amount),
    toFelt(fee),
    "${openNoteIds[0]}",
  ];

  const response =
    await account.strk20InvokeTransaction([
      {
        type: "withdraw",
        token,
        amount: toFelt(
          params.amount + fee,
        ),
        recipient: escrow,
      },
      {
        type: "transfer",
        token,
        amount: "OPEN",
        recipient: treasury,
      },
      {
        type: "invoke",
        contract: escrow,
        calldata: [
          toFelt(payload.length),
          ...payload,
        ],
      },
    ]);

  return {
    transactionHash:
      response.transaction_hash,
  };
}

async function invokeSettlement(
  account: WalletAccountV6,
  payload: string[],
): Promise<{ transactionHash: string }> {
  const custodyValue = payload[1];

  if (!custodyValue) {
    throw new Error(
      "Settlement custody commitment is missing.",
    );
  }

  const custodyCommitment = BigInt(
    custodyValue,
  );

  const custody =
    await getRekberCustody(
      custodyCommitment,
    );

  if (!custody) {
    throw new Error(
      "Rekber custody could not be loaded.",
    );
  }

  const token = num.toHex(custody.token);

  // The wallet must create the OPEN note itself.
  // The helper then returns an OpenNoteDeposit that
  // fills this exact wallet-generated note.
  const calldata = [
    ...payload,
    "${openNoteIds[0]}",
  ];

  const response =
    await account.strk20InvokeTransaction([
      {
        type: "transfer",
        token,
        amount: "OPEN",
        recipient: num.toHex(
          account.address,
        ),
      },
      {
        type: "invoke",
        contract:
          requireRekberAddress(),
        calldata: [
          toFelt(calldata.length),
          ...calldata,
        ],
      },
    ]);

  return {
    transactionHash:
      response.transaction_hash,
  };
}

export async function releaseEscrow(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    releaseAuthorizationSecret: bigint;
    payeeClaimSecret: bigint;
  },
): Promise<{ transactionHash: string }> {
  return invokeSettlement(account, [
    toFelt(2),
    toFelt(params.custodyCommitment),
    toFelt(
      params.releaseAuthorizationSecret,
    ),
    toFelt(params.payeeClaimSecret),
  ]);
}

export async function refundEscrow(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    refundSecret: bigint;
  },
): Promise<{ transactionHash: string }> {
  return invokeSettlement(account, [
    toFelt(3),
    toFelt(params.custodyCommitment),
    toFelt(params.refundSecret),
  ]);
}

export interface RekberStateInvoke {
  contract: string;
  calldata: string[];
}

function buildRekberStateInvoke(
  action: number,
  custodyCommitment: bigint,
  secret: bigint,
  evidenceCommitment: bigint,
): RekberStateInvoke {
  if (
    custodyCommitment === 0n ||
    secret === 0n ||
    evidenceCommitment === 0n
  ) {
    throw new Error(
      "Rekber lifecycle commitment is incomplete.",
    );
  }

  return {
    contract: requireRekberAddress(),
    calldata: [
      toFelt(action),
      toFelt(custodyCommitment),
      toFelt(secret),
      toFelt(evidenceCommitment),
    ],
  };
}

export function buildSubmitFulfillmentInvoke(
  params: {
    custodyCommitment: bigint;
    chainSecret: bigint;
    evidenceCommitment: bigint;
  },
): RekberStateInvoke {
  return buildRekberStateInvoke(
    4,
    params.custodyCommitment,
    params.chainSecret,
    params.evidenceCommitment,
  );
}

export function buildConfirmFulfillmentInvoke(
  params: {
    custodyCommitment: bigint;
    confirmationSecret: bigint;
    evidenceCommitment: bigint;
  },
): RekberStateInvoke {
  return buildRekberStateInvoke(
    5,
    params.custodyCommitment,
    params.confirmationSecret,
    params.evidenceCommitment,
  );
}

export function buildRequestRevisionInvoke(
  params: {
    custodyCommitment: bigint;
    chainSecret: bigint;
    reasonCommitment: bigint;
  },
): RekberStateInvoke {
  return buildRekberStateInvoke(
    7,
    params.custodyCommitment,
    params.chainSecret,
    params.reasonCommitment,
  );
}

async function invokeRekberWorkflowAction(
  account: WalletAccountV6,
  payload: Array<bigint | number | string>,
): Promise<{ transactionHash: string }> {
  const token =
    CONTRACTS.messageHelperOpenNoteToken;
  const rawTreasury =
    process.env
      .NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!token || !rawTreasury) {
    throw new Error(
      "Rekber replay protection is not configured.",
    );
  }

  /*
   * STRK20 currently permits only one external invoke per
   * private transaction.
   *
   * Workflow actions therefore invoke Rekber directly and
   * consume a negligible 10 wei STRK note for replay
   * protection. They never bundle MessageHelper + Rekber.
   */
  const calldata =
    payload.map((value) => toFelt(value));

  const response =
    await account.strk20InvokeTransaction([
      {
        type: "withdraw",
        token,
        amount: "0xa",
        recipient:
          num.toHex(rawTreasury),
      },
      {
        type: "invoke",
        contract:
          requireRekberAddress(),
        calldata: [
          toFelt(calldata.length),
          ...calldata,
        ],
      },
    ]);

  return {
    transactionHash:
      response.transaction_hash,
  };
}

export async function submitRekberFulfillment(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    chainSecret: bigint;
    evidenceCommitment: bigint;
  },
): Promise<{ transactionHash: string }> {
  return invokeRekberWorkflowAction(
    account,
    [
      4,
      params.custodyCommitment,
      params.chainSecret,
      params.evidenceCommitment,
    ],
  );
}

export async function confirmRekberFulfillment(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    confirmationSecret: bigint;
    evidenceCommitment: bigint;
  },
): Promise<{ transactionHash: string }> {
  return invokeRekberWorkflowAction(
    account,
    [
      5,
      params.custodyCommitment,
      params.confirmationSecret,
      params.evidenceCommitment,
    ],
  );
}

export async function requestRekberRevision(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    chainSecret: bigint;
    reasonCommitment: bigint;
  },
): Promise<{ transactionHash: string }> {
  return invokeRekberWorkflowAction(
    account,
    [
      7,
      params.custodyCommitment,
      params.chainSecret,
      params.reasonCommitment,
    ],
  );
}

export async function getRekberCustody(
  custodyCommitment: bigint,
): Promise<RekberCustodyState | null> {
  if (!CONTRACTS.escrowRekber) {
    return null;
  }

  try {
    const result =
      await getProvider().callContract({
        contractAddress:
          CONTRACTS.escrowRekber,
        entrypoint: "get_custody",
        calldata: [
          toFelt(custodyCommitment),
        ],
      });

    return {
      custodyCommitment:
        BigInt(result[0] ?? "0"),
      releaseAuthorizationCommitment:
        BigInt(result[1] ?? "0"),
      payeeClaimCommitment:
        BigInt(result[2] ?? "0"),
      refundCommitment:
        BigInt(result[3] ?? "0"),
      payerConfirmationCommitment:
        BigInt(result[4] ?? "0"),
      payerDisputeCommitment:
        BigInt(result[5] ?? "0"),
      payeeDisputeCommitment:
        BigInt(result[6] ?? "0"),
      payeeRefundConsentCommitment:
        BigInt(result[7] ?? "0"),
      fulfillmentChainHead:
        BigInt(result[8] ?? "0"),
      revisionChainHead:
        BigInt(result[9] ?? "0"),
      payerCertificateCommitment:
        BigInt(result[10] ?? "0"),
      payeeCertificateCommitment:
        BigInt(result[11] ?? "0"),
      token:
        num.toHex(result[12] ?? "0"),
      amount:
        BigInt(result[13] ?? "0"),
      feeAmount:
        BigInt(result[14] ?? "0"),
      refundAfter:
        Number(BigInt(result[15] ?? "0")),
      reviewWindow:
        Number(BigInt(result[16] ?? "0")),
      reviewDeadline:
        Number(BigInt(result[17] ?? "0")),
      revisionDeadline:
        Number(BigInt(result[18] ?? "0")),
      verificationPolicy:
        Number(BigInt(result[19] ?? "0")),
      fulfillmentRoundsRemaining:
        Number(BigInt(result[20] ?? "0")),
      revisionRoundsRemaining:
        Number(BigInt(result[21] ?? "0")),
      fulfillmentEvidenceCommitment:
        BigInt(result[22] ?? "0"),
      fulfillmentSubmitted:
        BigInt(result[27] ?? "0") !== 0n,
      fulfillmentConfirmed:
        BigInt(result[28] ?? "0") !== 0n,
      revisionPending:
        BigInt(result[29] ?? "0") !== 0n,
      disputed:
        BigInt(result[30] ?? "0") !== 0n,
      resolutionAuthorized:
        BigInt(result[31] ?? "0") !== 0n,
      consumed:
        BigInt(result[34] ?? "0") !== 0n,
      refunded:
        BigInt(result[35] ?? "0") !== 0n,
      createdAt:
        Number(BigInt(result[36] ?? "0")),
      fulfilledAt:
        Number(BigInt(result[37] ?? "0")),
      settledAt:
        Number(BigInt(result[38] ?? "0")),
    };
  } catch {
    return null;
  }
}

export async function getRekberProof(
  custodyCommitment: bigint,
  kind: RekberProof["kind"],
): Promise<RekberProof | null> {
  if (!CONTRACTS.escrowRekber) {
    return null;
  }

  const eventName =
    kind === "funded"
      ? "EscrowRekberCustodyFunded"
      : kind === "released"
        ? "EscrowRekberCustodyReleased"
        : "EscrowRekberCustodyRefunded";

  const result =
    await getProvider().getEvents({
      address:
        CONTRACTS.escrowRekber,
      from_block: {
        block_number: 0,
      },
      to_block: "latest",
      keys: [
        [
          hash.getSelectorFromName(
            eventName,
          ),
        ],
        [toFelt(custodyCommitment)],
      ],
      chunk_size: 20,
    });

  const event = result.events.at(-1);

  if (!event) return null;

  const timestampIndex =
    kind === "funded" ? 2 : 0;

  return {
    kind,
    transactionHash:
      event.transaction_hash,
    blockNumber:
      event.block_number ?? 0,
    timestamp: Number(
      BigInt(
        event.data[
          timestampIndex
        ] ?? "0",
      ),
    ),
  };
}

export async function claimSettlementCertificate(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    role: SettlementRole;
    certificateSecret: bigint;
  },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.settlementCertificate) {
    throw new Error(
      "Settlement Certificate is not configured for this network.",
    );
  }

  // The certificate is intentionally public ERC-721 evidence. It is claimed
  // directly by the wallet that will own it, rather than through the Privacy
  // Pool, so one counterparty cannot mint the other party's acknowledgement.
  const response = await account.execute({
    contractAddress:
      CONTRACTS.settlementCertificate,
    entrypoint: "claim",
    calldata: [
      toFelt(params.custodyCommitment),
      toFelt(
        params.role === "payer" ? 1 : 2,
      ),
      toFelt(params.certificateSecret),
    ],
  });

  return {
    transactionHash:
      response.transaction_hash,
  };
}

export async function isSettlementCertificateClaimed(
  custodyCommitment: bigint,
  role: SettlementRole,
): Promise<boolean> {
  if (!CONTRACTS.settlementCertificate) {
    return false;
  }

  const result =
    await getProvider().callContract({
      contractAddress:
        CONTRACTS.settlementCertificate,
      entrypoint: "is_claimed",
      calldata: [
        toFelt(custodyCommitment),
        toFelt(role === "payer" ? 1 : 2),
      ],
    });

  return BigInt(
    result[0] ?? "0",
  ) !== 0n;
}

export async function getSettlementCertificate(
  tokenId: bigint,
): Promise<SettlementCertificateRecord | null> {
  if (!CONTRACTS.settlementCertificate) {
    return null;
  }

  try {
    const result =
      await getProvider().callContract({
        contractAddress:
          CONTRACTS.settlementCertificate,
        entrypoint: "get_certificate",
        calldata: [toFelt(tokenId)],
      });

    return {
      tokenId: BigInt(
        result[0] ?? "0",
      ),
      custodyCommitment: BigInt(
        result[1] ?? "0",
      ),
      role:
        BigInt(result[2] ?? "0") ===
        1n
          ? "payer"
          : "payee",
      recipient: num.toHex(
        result[3] ?? "0",
      ),
      settledAt: Number(
        BigInt(result[4] ?? "0"),
      ),
      issuedAt: Number(
        BigInt(result[5] ?? "0"),
      ),
    };
  } catch {
    return null;
  }
}
