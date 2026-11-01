/** Invite deployments are independent from the active Message/Offer/Rekber rail. */
import { num } from "starknet";
import { CONTRACTS, PUBLIC_CONTRACTS, PUBLIC_RAIL_ADDRESS, PUBLIC_FEE_POLICY_ADDRESS } from "./constants";
import { transactionModeOf } from "./transactionMode";
export interface PublicInviteDeployment {
  adapter: string; invite: string; messageHelper: string; offerHelper: string;
  privateEscrowHelper: string; escrowRekber: string; feePolicy: string;
}
const fields = ["adapter", "invite", "messageHelper", "offerHelper", "privateEscrowHelper", "escrowRekber", "feePolicy"] as const;
function parseProfile(raw: string): PublicInviteDeployment {
  const value = JSON.parse(raw);
  for (const field of fields) {
    if (typeof value?.[field] !== "string" || !/^0x[\da-fA-F]{1,64}$/.test(value[field]) || BigInt(value[field]) <= 0n || BigInt(value[field]) >= (1n << 251n))
      throw new Error("Invalid public Invite deployment profile.");
    value[field] = num.toHex(value[field]);
  }
  if (new Set(fields.map(field => value[field])).size !== fields.length)
    throw new Error("Public Invite deployment targets must be distinct.");
  return Object.fromEntries(fields.map(field => [field, value[field]])) as unknown as PublicInviteDeployment;
}
function originalPublicDeployment(): PublicInviteDeployment {
  return { adapter: PUBLIC_RAIL_ADDRESS, ...PUBLIC_CONTRACTS, feePolicy: PUBLIC_FEE_POLICY_ADDRESS };
}
export function publicInviteDeployments(): PublicInviteDeployment[] {
  const raw = process.env.NEXT_PUBLIC_PUBLIC_INVITE_PROFILE;
  return raw ? [parseProfile(raw), originalPublicDeployment()] : [originalPublicDeployment()];
}
export function publicInviteDeployment(adapter?: string): PublicInviteDeployment {
  const deployments = publicInviteDeployments();
  const selected = adapter ? deployments.find(item => item.adapter && BigInt(item.adapter) === BigInt(adapter)) : deployments[0];
  if (!selected?.adapter || !selected.invite || !selected.feePolicy) throw new Error("Unknown or unconfigured public Invite deployment.");
  return selected;
}
export function shieldInviteHelpers(): string[] {
  const override = process.env.NEXT_PUBLIC_SHIELD_INVITE_OVERRIDE_ADDRESS;
  if (override && (!/^0x[\da-fA-F]{1,64}$/.test(override) || BigInt(override) <= 0n || BigInt(override) >= 1n << 251n))
    throw new Error("Invalid Shield Invite deployment.");
  return [...new Set([override, CONTRACTS.invite].filter((value): value is string => Boolean(value)).map(value => num.toHex(value)))];
}
export function inviteHelperForAccount(account?: object): string {
  return transactionModeOf(account) === "unshield" ? publicInviteDeployment().invite : shieldInviteHelpers()[0] ?? "";
}
