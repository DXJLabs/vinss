/**
 * Escrow SDK — two contracts, two calldata shapes.
 *
 * 1) Coordination (contracts/private_escrow/private_escrow_interfaces.cairo):
 *    same 4-felt-header + ciphertext shape as messaging/offer:
 *      [envelope_version, private_escrow_action_locator,
 *       claimed_payload_commitment, payload_chunk_count, ...chunks]
 *    Used for: create, funding intent, accept, funding confirmation, cancel,
 *    refund, dispute/resolution — all encrypted, action kind stays hidden.
 *
 * 2) Rekber (contracts/escrow_rekber/
 *    escrow_rekber_interfaces.cairo): a *different*, public,
 *    commitment-based calldata shape, because this contract actually moves
 *    ERC-20 custody:
 *      deposit  [1, custody_commitment, release_commitment, refund_commitment,
 *                refund_after, token, amount]
 *      release  [2, custody_commitment, release_secret, output_note_id]
 *      refund   [3, custody_commitment, refund_secret, output_note_id]
 *
 *    custody/release/refund secrets are generated client-side and must be
 *    treated like the message channel key — never logged, never sent to the
 *    backend. Deposit/withdrawal amounts on this contract are public (the
 *    ERC-20 legs), matching STRK20_INTEGRATION_PLAN.md §3.
 *
 *    Both contracts' only external entrypoint is privacy_invoke(calldata:
 *    Span<felt252>) — confirmed against
 *    contracts/escrow_rekber/escrow_rekber_interfaces.cairo
 *    — so the selector below applies to both call sites in this file.
 */

import type { WalletAccountV6 } from "starknet";
import { hash, num } from "starknet";
import { CONTRACTS } from "../starknet/constants";
import {
  encryptPayload,
  generateActionLocator,
  shortStringToFelt,
  toFelt,
  type ChannelKey,
} from "./envelope";
import type { EscrowActionPayload, SendActionResult } from "./types";
import {
  GROUP_RECIPIENT_IDENTITY,
  deriveMessageRoutingTag,
} from "./messageRouting";

const PRIVATE_ESCROW_ENVELOPE_VERSION = 2;
const ESCROW_COMMITMENT_DOMAIN =
  "VINSS_PRIVATE_ESCROW_COMMIT_V2";

function commitPrivateEscrowPayloadV2(
  actionLocator: bigint,
  senderTag: bigint,
  recipientTag: bigint,
  ciphertextChunks: bigint[],
): bigint {
  const inputs = [
    shortStringToFelt(ESCROW_COMMITMENT_DOMAIN),
    BigInt(PRIVATE_ESCROW_ENVELOPE_VERSION),
    actionLocator,
    senderTag,
    recipientTag,
    BigInt(ciphertextChunks.length),
    ...ciphertextChunks,
  ];

  return BigInt(
    hash.computePoseidonHashOnElements(inputs.map(String)),
  );
}

async function invokeHelper(
  account: WalletAccountV6,
  contractAddress: string,
  calldata: string[],
): Promise<{ transaction_hash: string }> {
  return account.strk20InvokeTransaction([
    {
      type: "invoke",
      contract: contractAddress,
      // privacy_invoke(calldata: Span<felt252>)
      // requires Cairo Span length serialization.
      // STRK20 itself selects privacy_invoke — no selector here.
      calldata: [
        toFelt(calldata.length),
        ...calldata,
      ],
    },
  ]);
}

// --- Coordination (encrypted, negotiation-style) ---------------------------

export async function sendEscrowCoordinationAction(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: EscrowActionPayload,
): Promise<SendActionResult> {
  if (!CONTRACTS.privateEscrowHelper) {
    throw new Error(
      "NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS is not set — see .env.local.example.",
    );
  }

  const actionLocator = generateActionLocator(channelKey);

  const [senderTag, recipientTag] = await Promise.all([
    deriveMessageRoutingTag(
      channelKey,
      "sender",
      account.address,
      actionLocator,
    ),
    deriveMessageRoutingTag(
      channelKey,
      "recipient",
      GROUP_RECIPIENT_IDENTITY,
      actionLocator,
    ),
  ]);

  const ciphertextChunks = await encryptPayload(channelKey, payload);

  const payloadCommitment = commitPrivateEscrowPayloadV2(
    actionLocator,
    senderTag,
    recipientTag,
    ciphertextChunks,
  );

  const calldata = [
    PRIVATE_ESCROW_ENVELOPE_VERSION,
    actionLocator,
    senderTag,
    recipientTag,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);

  const response = await invokeHelper(
    account,
    CONTRACTS.privateEscrowHelper,
    calldata,
  );

  return {
    transactionHash: response.transaction_hash,
    actionLocator,
    payloadCommitment,
  };
}

// --- Rekber (public commitments, moves real ERC-20 custody) ------------

export interface EscrowSecrets {
  releaseSecret: bigint;
  refundSecret: bigint;
}

function randomFelt(): bigint {
  return BigInt(
    "0x" +
      Array.from(crypto.getRandomValues(new Uint8Array(31)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  );
}

export function generateEscrowSecrets(): EscrowSecrets {
  return { releaseSecret: randomFelt(), refundSecret: randomFelt() };
}

/**
 * custody_commitment is generated FIRST, independently — it is this
 * escrow's identifier, not derived from the release/refund commitments.
 * release_commitment and refund_commitment are then computed FROM it (see
 * escrow_rekber_interfaces.cairo: `compute_release_commitment(
 * custody_commitment, release_secret)`). Generating it any other order
 * breaks the contract's expected input composition.
 */
export function generateCustodyCommitment(): bigint {
  return randomFelt();
}

/** Mirrors VinssEscrowRekber.compute_release_commitment. */
export function computeReleaseCommitment(
  custodyCommitment: bigint,
  releaseSecret: bigint,
): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements([
      String(custodyCommitment),
      String(releaseSecret),
    ]),
  );
}

/** Mirrors VinssEscrowRekber.compute_refund_commitment. */
export function computeRefundCommitment(
  custodyCommitment: bigint,
  refundSecret: bigint,
): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements([
      String(custodyCommitment),
      String(refundSecret),
    ]),
  );
}

export async function depositEscrow(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    releaseCommitment: bigint;
    refundCommitment: bigint;
    refundAfter: number;
    token: string;
    amount: bigint;
  },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.escrowRekber) {
    throw new Error(
      "NEXT_PUBLIC_ESCROW_REKBER_ADDRESS is not set.",
    );
  }

  const treasury =
    process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!treasury) {
    throw new Error(
      "NEXT_PUBLIC_VINSS_TREASURY_ADDRESS is not configured",
    );
  }

  const principal = params.amount;
  const fee = principal / 100n;

  if (fee <= 0n) {
    throw new Error(
      "Amount is too small for the 1% Rekber fee.",
    );
  }

  const total = principal + fee;
  const token = num.toHex(params.token);

  const calldata = [
    toFelt(1),
    toFelt(params.custodyCommitment),
    toFelt(params.releaseCommitment),
    toFelt(params.refundCommitment),
    toFelt(params.refundAfter),
    token,
    toFelt(principal),
  ];

  const response =
    await account.strk20InvokeTransaction([
      {
        type: "withdraw",
        token,
        amount: toFelt(total),
        recipient: CONTRACTS.escrowRekber,
      },
      {
        type: "transfer",
        token,
        amount: "OPEN",
        recipient: treasury,
      },
      {
        type: "invoke",
        contract: CONTRACTS.escrowRekber,
        calldata: [
          toFelt(calldata.length + 1),
          ...calldata,
          "${openNoteIds[0]}",
        ],
      },
    ]);

  return {
    transactionHash: response.transaction_hash,
  };
}

export async function releaseEscrow(
  account: WalletAccountV6,
  params: { custodyCommitment: bigint; releaseSecret: bigint; outputNoteId: bigint },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.escrowRekber) {
    throw new Error(
      "NEXT_PUBLIC_ESCROW_REKBER_ADDRESS is not set — see .env.local.example.",
    );
  }
  const calldata = [
    toFelt(2),
    toFelt(params.custodyCommitment),
    toFelt(params.releaseSecret),
    toFelt(params.outputNoteId),
  ];
  const response = await invokeHelper(
    account,
    CONTRACTS.escrowRekber,
    calldata,
  );
  return { transactionHash: response.transaction_hash };
}

export async function refundEscrow(
  account: WalletAccountV6,
  params: { custodyCommitment: bigint; refundSecret: bigint; outputNoteId: bigint },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.escrowRekber) {
    throw new Error(
      "NEXT_PUBLIC_ESCROW_REKBER_ADDRESS is not set — see .env.local.example.",
    );
  }
  const calldata = [
    toFelt(3),
    toFelt(params.custodyCommitment),
    toFelt(params.refundSecret),
    toFelt(params.outputNoteId),
  ];
  const response = await invokeHelper(
    account,
    CONTRACTS.escrowRekber,
    calldata,
  );
  return { transactionHash: response.transaction_hash };
}
