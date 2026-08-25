/** Rekber custody, release, refund, and Settlement Certificate operations. */

import type { WalletAccountV6 } from "starknet";
import { hash, num } from "starknet";
import { getProvider } from "@/lib/starknet/walletClient";
import { CONTRACTS } from "@/lib/starknet/constants";
import {
  shortStringToFelt,
  toFelt,
} from "@/lib/privacy/envelope";
import { VINSS_FEES } from "@/lib/fees";

// Domain tags are immutable: changing them would invalidate saved secrets.
const RELEASE_AUTH_DOMAIN =
  "VINSS_RELEASE_AUTH_V2";
const PAYEE_CLAIM_DOMAIN =
  "VINSS_PAYEE_CLAIM_V2";
const REFUND_DOMAIN =
  "VINSS_ESCROW_REFUND_V2";
const CERTIFICATE_CLAIM_DOMAIN =
  "VINSS_CERT_CLAIM_V1";
const CERTIFICATE_TOKEN_DOMAIN =
  "VINSS_CERT_TOKEN_V1";

export type SettlementRole =
  | "payer"
  | "payee";

export interface PayerSettlementSecrets {
  releaseAuthorizationSecret: bigint;
  refundSecret: bigint;
  certificateSecret: bigint;
}

export interface PayeeSettlementSecrets {
  payeeClaimSecret: bigint;
  certificateSecret: bigint;
}

export interface RekberCustodyState {
  custodyCommitment: bigint;
  releaseAuthorizationCommitment: bigint;
  payeeClaimCommitment: bigint;
  refundCommitment: bigint;
  payerCertificateCommitment: bigint;
  payeeCertificateCommitment: bigint;
  token: string;
  amount: bigint;
  refundAfter: number;
  consumed: boolean;
  refunded: boolean;
  createdAt: number;
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

export function generatePayerSettlementSecrets(): PayerSettlementSecrets {
  return {
    releaseAuthorizationSecret:
      randomFelt(),
    refundSecret: randomFelt(),
    certificateSecret: randomFelt(),
  };
}

export function generatePayeeSettlementSecrets(): PayeeSettlementSecrets {
  return {
    payeeClaimSecret: randomFelt(),
    certificateSecret: randomFelt(),
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
    payerCertificateCommitment: bigint;
    payeeCertificateCommitment: bigint;
    refundAfter: number;
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
  const token = num.toHex(params.token);
  const fee =
    params.amount /
    BigInt(VINSS_FEES.rekber.divisor);

  if (fee <= 0n) {
    throw new Error(
      `Amount is too small for the ${VINSS_FEES.rekber.percent}% Rekber fee.`,
    );
  }

  const payload = [
    toFelt(1),
    toFelt(params.custodyCommitment),
    toFelt(
      params.releaseAuthorizationCommitment,
    ),
    toFelt(params.payeeClaimCommitment),
    toFelt(params.refundCommitment),
    toFelt(
      params.payerCertificateCommitment,
    ),
    toFelt(
      params.payeeCertificateCommitment,
    ),
    toFelt(params.refundAfter),
    token,
    toFelt(params.amount),
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
      custodyCommitment: BigInt(
        result[0] ?? "0",
      ),
      releaseAuthorizationCommitment:
        BigInt(result[1] ?? "0"),
      payeeClaimCommitment: BigInt(
        result[2] ?? "0",
      ),
      refundCommitment: BigInt(
        result[3] ?? "0",
      ),
      payerCertificateCommitment:
        BigInt(result[4] ?? "0"),
      payeeCertificateCommitment:
        BigInt(result[5] ?? "0"),
      token: num.toHex(
        result[6] ?? "0",
      ),
      amount: BigInt(
        result[7] ?? "0",
      ),
      refundAfter: Number(
        BigInt(result[8] ?? "0"),
      ),
      consumed:
        BigInt(result[9] ?? "0") !==
        0n,
      refunded:
        BigInt(result[10] ?? "0") !==
        0n,
      createdAt: Number(
        BigInt(result[11] ?? "0"),
      ),
      settledAt: Number(
        BigInt(result[12] ?? "0"),
      ),
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
