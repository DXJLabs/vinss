import { num, type WalletAccountV6 } from "starknet";
import { CONTRACTS, STRK_ADDRESS } from "./constants";
import { assertWalletNetwork, invokeShieldedTransaction } from "./guards";
import { getProvider } from "./walletClient";

/** Public registration lookup from the official privacy pool ABI. */
export async function getRegisteredViewingPublicKey(address: string): Promise<bigint> {
  if (!CONTRACTS.privacyPool) throw new Error("Privacy pool is not configured.");
  const result = await getProvider().callContract({
    contractAddress: CONTRACTS.privacyPool,
    entrypoint: "get_public_key",
    calldata: [num.toHex(address)],
  }, "latest");
  if (result.length !== 1) throw new Error("Unexpected viewing-key response from the pool.");
  return BigInt(result[0]!);
}

/**
 * The Wallet API delegates viewing-key registration, self-channel setup,
 * ephemeral ECDH, proving and note encryption to the user's privacy wallet.
 * Never substitute a random VINSS key for the registered wallet viewing key.
 * A returned hash is submitted, not settled: wait for a successful receipt and
 * rediscover the shielded balance before reporting success.
 */
export async function shieldStrk(account: WalletAccountV6, amount: bigint) {
  if (!STRK_ADDRESS) throw new Error("STRK is not configured for this network.");
  if (amount <= 0n || amount >= 1n << 128n) throw new Error("Shield amount must be a positive u128.");
  return invokeShieldedTransaction(account, [{
    type: "deposit", token: STRK_ADDRESS, amount: num.toHex(amount),
  }]);
}

/** Native note discovery/decryption remains inside the wallet. */
export async function discoverShieldedStrk(account: WalletAccountV6) {
  if (!STRK_ADDRESS) throw new Error("STRK is not configured for this network.");
  await assertWalletNetwork(account);
  return account.strk20Balances([STRK_ADDRESS]);
}

// TODO(unshield-starknet): add the public withdrawal flow after Shield passes
// live Alice/Bob Sepolia settlement. Existing protocol-internal withdrawals
// used by anonymizer helpers are not a user-facing Unshield feature.
// TODO(multichain): implement one ecosystem at a time after Starknet Shield.
