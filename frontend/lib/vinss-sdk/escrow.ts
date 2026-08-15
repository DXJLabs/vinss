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
 * 2) Settlement (contracts/private_escrow_settlement/
 *    private_escrow_settlement_interfaces.cairo): a *different*, public,
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
 *    contracts/private_escrow_settlement/private_escrow_settlement_interfaces.cairo
 *    — so the selector below applies to both call sites in this file.
 */

import type { WalletAccountV6 } from "starknet";
import { hash } from "starknet";
import { CONTRACTS } from "../starknet/constants";
import {
  commitPayload,
  encryptPayload,
  generateActionLocator,
  ENVELOPE_VERSION,
  toFelt,
  type ChannelKey,
} from "./envelope";
import type { EscrowActionPayload, SendActionResult } from "./types";

const ESCROW_COMMITMENT_DOMAIN = "VINSS_ESCROW_COMMIT_V1"; // confirm exact
// name in contracts/utils/constants.cairo at build time.

async function invokeHelper(
  account: WalletAccountV6,
  contractAddress: string,
  calldata: string[],
): Promise<{ transaction_hash: string }> {
  return account.strk20InvokeTransaction([
    {
      type: "invoke",
      contract: contractAddress,
      calldata: [
        hash.getSelectorFromName("privacy_invoke"),
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
  const ciphertextChunks = await encryptPayload(channelKey, payload);
  const payloadCommitment = commitPayload(
    ESCROW_COMMITMENT_DOMAIN,
    ENVELOPE_VERSION,
    actionLocator,
    ciphertextChunks.length,
    ciphertextChunks,
  );

  // Every calldata item must be a 0x-prefixed FELT string — plain
  // .map(String) on a bigint produced decimal strings and was the actual
  // cause of INVALID_REQUEST_PAYLOAD. toFelt() fixes that.
  const calldata = [
    ENVELOPE_VERSION,
    actionLocator,
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

// --- Settlement (public commitments, moves real ERC-20 custody) ------------

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
 * private_escrow_settlement_interfaces.cairo: `compute_release_commitment(
 * custody_commitment, release_secret)`). Generating it any other order
 * breaks the contract's expected input composition.
 */
export function generateCustodyCommitment(): bigint {
  return randomFelt();
}

/** Mirrors VinssPrivateEscrowSettlement.compute_release_commitment. */
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

/** Mirrors VinssPrivateEscrowSettlement.compute_refund_commitment. */
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
    refundAfter: number; // unix seconds
    token: string;
    amount: bigint;
  },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.privateEscrowSettlement) {
    throw new Error(
      "NEXT_PUBLIC_PRIVATE_ESCROW_SETTLEMENT_ADDRESS is not set — see .env.local.example.",
    );
  }
  const calldata = [
    toFelt(1),
    toFelt(params.custodyCommitment),
    toFelt(params.releaseCommitment),
    toFelt(params.refundCommitment),
    toFelt(params.refundAfter),
    params.token,
    toFelt(params.amount),
  ];
  const response = await invokeHelper(
    account,
    CONTRACTS.privateEscrowSettlement,
    calldata,
  );
  return { transactionHash: response.transaction_hash };
}

export async function releaseEscrow(
  account: WalletAccountV6,
  params: { custodyCommitment: bigint; releaseSecret: bigint; outputNoteId: bigint },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.privateEscrowSettlement) {
    throw new Error(
      "NEXT_PUBLIC_PRIVATE_ESCROW_SETTLEMENT_ADDRESS is not set — see .env.local.example.",
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
    CONTRACTS.privateEscrowSettlement,
    calldata,
  );
  return { transactionHash: response.transaction_hash };
}

export async function refundEscrow(
  account: WalletAccountV6,
  params: { custodyCommitment: bigint; refundSecret: bigint; outputNoteId: bigint },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.privateEscrowSettlement) {
    throw new Error(
      "NEXT_PUBLIC_PRIVATE_ESCROW_SETTLEMENT_ADDRESS is not set — see .env.local.example.",
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
    CONTRACTS.privateEscrowSettlement,
    calldata,
  );
  return { transactionHash: response.transaction_hash };
}
