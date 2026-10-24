import { normalizeStarknetAddress } from "./unshield.ts";

export interface ExpectedPublicTransfer {
  transactionHash: string;
  token: string;
  sender: string;
  recipient: string;
  amountUnits: bigint;
  transferSelector: string;
}
export type PublicTransferReceiptResult =
  | { status: "pending" | "reverted" }
  | { status: "confirmed"; networkFee: { amount: bigint; unit: "WEI" | "FRI" } | null };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}
function integer(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0x[\da-fA-F]+|\d+)$/.test(value)) {
    throw new Error("Invalid receipt integer.");
  }
  return BigInt(value);
}
function sameAddress(value: unknown, expected: string): boolean {
  return typeof value === "string" && normalizeStarknetAddress(value) === normalizeStarknetAddress(expected);
}
function matchesTransfer(value: unknown, expected: ExpectedPublicTransfer): boolean {
  try {
    const event = record(value);
    if (!sameAddress(event.from_address, expected.token)) return false;
    if (!Array.isArray(event.keys) || !Array.isArray(event.data)) return false;
    if (integer(event.keys[0]) !== integer(expected.transferSelector)) return false;
    let sender: unknown, recipient: unknown, low: unknown, high: unknown;
    // Legacy ERC-20 and SNIP-13 indexed Transfer layouts.
    if (event.keys.length === 1 && event.data.length === 4) {
      [sender, recipient, low, high] = event.data;
    } else if (event.keys.length === 3 && event.data.length === 2) {
      [, sender, recipient] = event.keys;
      [low, high] = event.data;
    } else return false;
    if (!sameAddress(sender, expected.sender) || !sameAddress(recipient, expected.recipient)) return false;
    const lo = integer(low), hi = integer(high);
    if (lo >= (1n << 128n) || hi >= (1n << 128n)) return false;
    return lo + (hi << 128n) === expected.amountUnits;
  } catch { return false; }
}

/** Confirm only an accepted, successful INVOKE with the exact wallet transfer. */
export function verifyPublicTransferReceipt(value: unknown, expected: ExpectedPublicTransfer): PublicTransferReceiptResult {
  if (expected.amountUnits <= 0n || expected.amountUnits >= (1n << 256n)) {
    throw new Error("Invalid expected public transfer amount.");
  }
  const receipt = record(value);
  if (integer(receipt.transaction_hash) !== integer(expected.transactionHash)) {
    throw new Error("RPC receipt does not match the requested transaction hash.");
  }
  if (receipt.type !== "INVOKE") throw new Error("Expected an INVOKE transaction.");
  if (receipt.finality_status !== "ACCEPTED_ON_L2" && receipt.finality_status !== "ACCEPTED_ON_L1") {
    return { status: "pending" };
  }
  if (receipt.execution_status === "REVERTED") return { status: "reverted" };
  if (receipt.execution_status !== "SUCCEEDED") throw new Error("Receipt execution status is not verified.");
  if (!Array.isArray(receipt.events) || !receipt.events.some(event => matchesTransfer(event, expected))) {
    throw new Error("No matching ERC-20 Transfer for the expected sender, recipient, token and amount.");
  }
  const fee = record(receipt.actual_fee);
  let networkFee: { amount: bigint; unit: "WEI" | "FRI" } | null = null;
  if (fee.unit === "WEI" || fee.unit === "FRI") {
    try { networkFee = { amount: integer(fee.amount), unit: fee.unit }; } catch { /* Unverifiable gas is not a fee quote. */ }
  }
  return { status: "confirmed", networkFee };
}
