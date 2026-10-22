/**
 * Native STRK20 unshield: shielded balance -> PUBLIC Starknet recipient.
 * Never inserts a VINSS revenue transfer or helper invocation.
 */
const PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

export function normalizeStarknetAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(address)) {
    throw new Error("Invalid Starknet hex address");
  }
  const value = BigInt(address);
  if (value <= 0n || value >= PRIME) throw new Error("Invalid Starknet address field");
  return "0x" + value.toString(16);
}
function validDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Unsupported token decimals");
  }
}
/** Decimal strings avoid floating-point rounding for transferred principal. */
export function parseTokenUnits(amount: string, decimals: number): bigint {
  validDecimals(decimals);
  if (!/^(0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
    throw new Error("Invalid token amount");
  }
  const [whole = "0", fractional = ""] = amount.split(".");
  if (fractional.length > decimals) throw new Error("Too many token decimals");
  const result = BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fractional.padEnd(decimals, "0") || "0");
  if (result <= 0n) throw new Error("Unshield amount must be positive");
  if (result >= PRIME) throw new Error("Amount exceeds STRK20 felt limit");
  return result;
}
export function formatTokenUnits(units: bigint, decimals: number): string {
  validDecimals(decimals);
  if (units < 0n) throw new Error("Negative token units");
  if (decimals === 0) return units.toString();
  const digits = units.toString().padStart(decimals + 1, "0");
  const fractional = digits.slice(-decimals).replace(/0+$/, "");
  return digits.slice(0, -decimals) + (fractional ? "." + fractional : "");
}
export interface NativeUnshieldAction {
  type: "withdraw";
  token: string;
  amount: string;
  recipient: string;
}
export interface UnshieldRequest {
  token: string;
  recipient: string;
  amount: string;
  decimals: number;
}
/** The transferred amount is principal, NOT an application fee. */
export function buildUnshieldAction(request: UnshieldRequest): NativeUnshieldAction {
  return {
    type: "withdraw",
    token: normalizeStarknetAddress(request.token),
    recipient: normalizeStarknetAddress(request.recipient),
    amount: "0x" + parseTokenUnits(request.amount, request.decimals).toString(16),
  };
}
