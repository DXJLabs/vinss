/**
 * Converts technical wallet/network failures into safe user-facing copy.
 *
 * Callers should log the original error separately before showing this text.
 * Do not expose RPC payloads, environment names, stack traces, or wallet
 * internals directly in the UI.
 */
export function humanizeError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");

  if (/USER_REFUSED/i.test(raw)) {
    return "The wallet request was cancelled.";
  }

  if (/NOT_REGISTERED/i.test(raw)) {
    return "Activate your private wallet account before continuing.";
  }

  if (/INSUFFICIENT_PRIVATE_BALANCE/i.test(raw)) {
    return "Your private balance is not enough for this action.";
  }

  if (/PRIVACY_LEAK/i.test(raw)) {
    return "The wallet blocked this action to protect your privacy.";
  }

  if (/ESCROW_WALLET_STILL_PREPARING/i.test(raw)) {
    return "Ready X is still preparing this payment. Finish or cancel the wallet request before trying again.";
  }

  if (/ESCROW_DEPOSIT_NOT_CONFIRMED/i.test(raw)) {
    return "The payment is not confirmed on-chain yet. Do not submit it again until its status is checked.";
  }

  if (/INVALID_REQUEST_PAYLOAD/i.test(raw)) {
    return "The private wallet could not process this action. Please try again.";
  }

  if (
    raw.includes("NEXT_PUBLIC_") ||
    raw.includes(".env") ||
    raw.includes("messageHelper")
  ) {
    return "Private messaging is temporarily unavailable. Please try again in a moment.";
  }

  if (
    raw.toLowerCase().includes("rpc") ||
    raw.toLowerCase().includes("network") ||
    raw.toLowerCase().includes("wallet")
  ) {
    return "We couldn't complete that request. Please check your wallet connection and try again.";
  }

  return fallback;
}
