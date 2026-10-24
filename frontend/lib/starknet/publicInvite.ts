import { constants, ec, hash, shortString, type WalletAccountV6 } from "starknet";
import { NETWORK, PUBLIC_RAIL_ADDRESS } from "./constants";
import { getProvider } from "./walletClient";
import { assertPublicRailReady } from "./vinssExecution";
import { lockRoomMode } from "./transactionMode";
import { normalizeStarknetAddress } from "./unshield";
const chainId = NETWORK === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA;
const tag = shortString.encodeShortString;
export function computePublicInviteCapability(secret: string, creator: string) {
  const claimPublicKey = ec.starkCurve.getStarkKey(secret);
  const commitment = hash.computePoseidonHashOnElements([
    tag("VINSS_PUBLIC_INVITE_V1"), chainId, PUBLIC_RAIL_ADDRESS, creator, claimPublicKey,
  ]);
  return { claimPublicKey, commitment };
}
export async function publicInviteConsumedBy(commitment: string, address: string): Promise<boolean> {
  if (!PUBLIC_RAIL_ADDRESS) return false;
  const result = await getProvider().callContract({ contractAddress: PUBLIC_RAIL_ADDRESS,
    entrypoint: "get_invite_consumer", calldata: [commitment] });
  const consumer = result[0] ?? "0x0";
  return BigInt(consumer) !== 0n && normalizeStarknetAddress(consumer) === normalizeStarknetAddress(address);
}
/** Prove possession of the encrypted invite key without revealing it onchain. */
export async function consumePublicInvite(account: WalletAccountV6, secret: string, commitment: string): Promise<{ transaction_hash: string }> {
  await assertPublicRailReady(account);
  const rawDigest = hash.computePoseidonHashOnElements([
    tag("VINSS_PUBLIC_CONSUME_V1"), chainId, PUBLIC_RAIL_ADDRESS, account.address, commitment,
  ]);
  const digest = "0x" + (BigInt(rawDigest) % (1n << 251n)).toString(16);
  const signature = ec.starkCurve.sign(digest, secret);
  lockRoomMode(account);
  return account.execute({ contractAddress: PUBLIC_RAIL_ADDRESS, entrypoint: "consume_invite",
    calldata: [commitment, "0x" + signature.r.toString(16), "0x" + signature.s.toString(16)] });
}
