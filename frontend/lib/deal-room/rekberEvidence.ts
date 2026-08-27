/*
 * Commit private delivery/revision evidence without publishing its plaintext.
 *
 * This digest is domain data, not a UI concern. The 250-bit mask keeps the
 * value comfortably inside Starknet's felt range while preserving a stable
 * deterministic commitment for both sides.
 */
export async function computeRekberEvidenceCommitment(
  parts: string[],
): Promise<bigint> {
  const bytes =
    new TextEncoder().encode(
      parts.join("\u001f"),
    );

  const digest =
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        bytes,
      ),
    );

  const hex =
    Array.from(digest)
      .map((byte) =>
        byte
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");

  const value =
    BigInt(`0x${hex}`) &
    ((1n << 250n) - 1n);

  return value || 1n;
}
