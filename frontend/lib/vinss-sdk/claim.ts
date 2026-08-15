/**
 * Claim-link SDK — matches contracts/claim_escrow/claim_escrow_interfaces.cairo:
 *
 *   deposit calldata: [1, commitment, token, amount]
 *   claim   calldata: [2, secret, output_note_id]
 *
 * Used for shareable claim links (e.g. "pay whoever has this secret") —
 * simpler than the negotiated escrow: no release/refund split, just a
 * single secret that unlocks the deposit.
 */

import { hash, type WalletAccountV6 } from "starknet";
import { CONTRACTS } from "../starknet/constants";

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

export function generateClaimSecret(): bigint {
  return BigInt(
    "0x" +
      Array.from(crypto.getRandomValues(new Uint8Array(31)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  );
}

/** Mirrors VinssClaimEscrow.compute_commitment. */
export function computeClaimCommitment(secret: bigint): bigint {
  return BigInt(hash.computePoseidonHashOnElements([String(secret)]));
}

export async function depositClaim(
  account: WalletAccountV6,
  params: { commitment: bigint; token: string; amount: bigint },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.claimEscrow) {
    throw new Error(
      "NEXT_PUBLIC_CLAIM_ESCROW_ADDRESS is not set — see .env.local.example.",
    );
  }
  const calldata = [
    "1",
    String(params.commitment),
    params.token,
    String(params.amount),
  ];
  const response = await invokeHelper(account, CONTRACTS.claimEscrow, calldata);
  return { transactionHash: response.transaction_hash };
}

export async function claim(
  account: WalletAccountV6,
  params: { secret: bigint; outputNoteId: bigint },
): Promise<{ transactionHash: string }> {
  if (!CONTRACTS.claimEscrow) {
    throw new Error(
      "NEXT_PUBLIC_CLAIM_ESCROW_ADDRESS is not set — see .env.local.example.",
    );
  }
  const calldata = ["2", String(params.secret), String(params.outputNoteId)];
  const response = await invokeHelper(account, CONTRACTS.claimEscrow, calldata);
  return { transactionHash: response.transaction_hash };
}
