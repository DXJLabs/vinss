import { constants, hash, shortString, type WalletAccountV6 } from "starknet";
import { NETWORK, PUBLIC_RAIL_ADDRESS } from "./constants";
import { transactionModeOf } from "./transactionMode";
import { generateActionLocator } from "@/lib/privacy/envelope";
export function prepareActionLocator(account: WalletAccountV6, key: Uint8Array): { actionLocator: bigint; locatorNonce?: string } {
  const nonce = generateActionLocator(key);
  if (transactionModeOf(account) !== "unshield") return { actionLocator: nonce };
  if (!PUBLIC_RAIL_ADDRESS) throw new Error("Unshield adapter is not configured.");
  return { locatorNonce: "0x" + nonce.toString(16), actionLocator: BigInt(hash.computePoseidonHashOnElements([
    shortString.encodeShortString("VINSS_PUBLIC_ACTION_V1"),
    NETWORK === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA,
    PUBLIC_RAIL_ADDRESS, account.address, "0x" + nonce.toString(16),
  ])) };
}
