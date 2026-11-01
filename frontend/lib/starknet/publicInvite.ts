import { constants, ec, hash, shortString, num, type WalletAccountV6 } from "starknet";
import { NETWORK, PUBLIC_RAIL_ADDRESS } from "./constants";
import { publicInviteDeployment } from "./inviteDeployment";
import { buildPublicRailCalls } from "./publicRailCalls";
import { STRK_ADDRESS } from "./constants";
import { getProvider } from "./walletClient";
import { assertPublicRailReady } from "./vinssExecution";
import { normalizeStarknetAddress } from "./unshield";
const chainId = NETWORK === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA;
const tag = shortString.encodeShortString;
export function computePublicInviteCapability(secret: string, creator: string, adapter?: string) {
  const rail = publicInviteDeployment(adapter).adapter;
  const claimPublicKey = ec.starkCurve.getStarkKey(secret);
  const commitment = hash.computePoseidonHashOnElements([
    tag("VINSS_PUBLIC_INVITE_V1"), chainId, rail, creator, claimPublicKey,
  ]);
  return { claimPublicKey, commitment };
}
export async function publicInviteConsumedBy(commitment: string, address: string, adapter?: string): Promise<boolean> {
  const rail = publicInviteDeployment(adapter).adapter;
  const result = await getProvider().callContract({ contractAddress: rail,
    entrypoint: "get_invite_consumer", calldata: [commitment] });
  const consumer = result[0] ?? "0x0";
  return BigInt(consumer) !== 0n && normalizeStarknetAddress(consumer) === normalizeStarknetAddress(address);
}
/** Prove possession of the encrypted invite key without revealing it onchain. */
export async function consumePublicInvite(account: WalletAccountV6, secret: string, commitment: string, adapter?: string): Promise<{ transaction_hash: string }> {
  const rail = publicInviteDeployment(adapter).adapter;
  await assertPublicInviteReady(account, rail);
  const rawDigest = hash.computePoseidonHashOnElements([
    tag("VINSS_PUBLIC_CONSUME_V1"), chainId, rail, account.address, commitment,
  ]);
  const digest = "0x" + (BigInt(rawDigest) % (1n << 251n)).toString(16);
  const signature = ec.starkCurve.sign(digest, secret);
  return account.execute({ contractAddress: rail, entrypoint: "consume_invite",
    calldata: [commitment, "0x" + signature.r.toString(16), "0x" + signature.s.toString(16)] });
}

/** Validate the wallet chain and pinned configuration before approving the Invite adapter. */
export async function assertPublicInviteReady(account: WalletAccountV6, adapter?: string): Promise<void> {
  await assertPublicRailReady(account);
  const profile = publicInviteDeployment(adapter);
  if (BigInt(profile.adapter) === BigInt(PUBLIC_RAIL_ADDRESS)) return;
  const expected = [process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS ?? "", STRK_ADDRESS, profile.invite,
    profile.messageHelper, profile.offerHelper, profile.privateEscrowHelper, profile.escrowRekber, profile.feePolicy];
  const actual = await getProvider().callContract({contractAddress:profile.adapter,entrypoint:"get_configuration",calldata:[]});
  if (actual.length !== 9 || BigInt(actual[0] ?? "0") !== 8n || expected.some((value,i)=>BigInt(value)!==BigInt(actual[i+1] ?? "0")))
    throw new Error("Public Invite adapter configuration does not match this deployment.");
}
export async function createPublicInvite(account: WalletAccountV6, calldata: string[], fee: bigint, claimPublicKey: string) {
  const profile = publicInviteDeployment();
  await assertPublicInviteReady(account, profile.adapter);
  const treasury = process.env.NEXT_PUBLIC_VINSS_TREASURY_ADDRESS ?? "";
  const calls = buildPublicRailCalls([
    {type:"withdraw",token:STRK_ADDRESS,amount:num.toHex(fee),recipient:profile.invite},
    {type:"transfer",token:STRK_ADDRESS,amount:"OPEN",recipient:treasury},
    {type:"invoke",contract:profile.invite,calldata:[num.toHex(calldata.length+2),...calldata,num.toHex(fee),"${openNoteIds[0]}"]},
  ], {...profile,treasury,feeToken:STRK_ADDRESS}, {inviteClaimKey:claimPublicKey});
  return account.execute(calls);
}
