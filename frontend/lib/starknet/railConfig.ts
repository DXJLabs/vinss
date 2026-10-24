import { BACKEND_URL, CONTRACTS, PUBLIC_CONTRACTS, PUBLIC_RAIL_ADDRESS, PUBLIC_BACKEND_URL, PUBLIC_FEE_POLICY_ADDRESS } from "./constants";
import { transactionModeOf } from "./transactionMode";
export function contractsForAccount(account?: object | null) {
  return transactionModeOf(account) === "unshield" ? PUBLIC_CONTRACTS : CONTRACTS;
}
export function publicRailConfigurationError(): string | null {
  if (!PUBLIC_FEE_POLICY_ADDRESS || !PUBLIC_RAIL_ADDRESS || !PUBLIC_BACKEND_URL || !PUBLIC_CONTRACTS.invite ||
      !PUBLIC_CONTRACTS.messageHelper || !PUBLIC_CONTRACTS.offerHelper ||
      !PUBLIC_CONTRACTS.privateEscrowHelper || !PUBLIC_CONTRACTS.escrowRekber ||
      !PUBLIC_CONTRACTS.messageHelperOpenNoteToken) {
    return "Unshield deployment is not configured. Configure the public adapter, helpers, STRK token and ciphertext discovery backend.";
  }
  return null;
}

export function backendForAccount(account?: object | null): string {
  if (transactionModeOf(account) !== "unshield") return BACKEND_URL;
  if (!PUBLIC_BACKEND_URL) return ""; // Never query Shield discovery under an Unshield label.
  return PUBLIC_BACKEND_URL.replace(/\/$/, "");
}
