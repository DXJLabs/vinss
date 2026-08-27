/*
 * Hash attachment bytes locally before encrypted upload/review.
 * The helper never uploads or logs file contents.
 */
export async function sha256FileHex(
  file: File,
): Promise<string> {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );

  return (
    "0x" +
    Array.from(
      new Uint8Array(digest),
    )
      .map((value) =>
        value
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
