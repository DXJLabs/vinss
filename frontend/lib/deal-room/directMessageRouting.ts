/*
 * Pure direct-message routing helpers.
 * Address aliases are intentionally deduplicated without canonicalizing
 * the returned value because historical ciphertext may have been routed
 * using the exact address spelling learned by the sender.
 */
export function locatorHex(value: string): string {
  return BigInt(value).toString(16);
}

export function uniqueIdentities(
  identities: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const identity of identities) {
    if (!identity?.trim()) continue;

    const exact = identity.trim().toLowerCase();

    if (!seen.has(exact)) {
      seen.add(exact);
      result.push(identity.trim());
    }
  }

  return result;
}
