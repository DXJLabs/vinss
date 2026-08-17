/**
 * Shield — deposit public STRK into the privacy pool.
 *
 * Must be its own transaction, run once before ANY other STRK20 action on a
 * fresh account/pool (transfer, invoke, withdraw). This is what publishes
 * the account's viewing key on-chain; skipping it is what NOT_REGISTERED
 * means. See docs/STRK20_INTEGRATION.md-equivalent notes in the tipjar
 * reference for why this must stay decoupled from any private transfer.
 */

import type { STRK20_ACTION, WalletAccountV6 } from "starknet";
import { STRK_ADDRESS } from "../starknet/constants";
import { toFelt } from "./envelope";

export function buildShieldActions(
  amount: bigint,
  tokenAddress: string = STRK_ADDRESS,
): STRK20_ACTION[] {
  return [{ type: "deposit", token: tokenAddress, amount: toFelt(amount) }];
}

/**
 * Sends the shield deposit. Expect TWO wallet prompts on a token's first
 * ever shield (ERC-20 approve, then the pool deposit) — the pool forbids
 * batching them. Wait for on-chain confirmation, then wait ~10 blocks
 * before the note is spendable by transfer/invoke.
 */
export async function shield(
  account: WalletAccountV6,
  amount: bigint,
  tokenAddress: string = STRK_ADDRESS,
): Promise<{ transactionHash: string }> {
  const actions = buildShieldActions(amount, tokenAddress);
  const response = await account.strk20InvokeTransaction(actions);
  return { transactionHash: response.transaction_hash };
}
