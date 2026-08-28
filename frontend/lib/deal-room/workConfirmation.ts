import {
  getRekberCustody,
  type RekberCustodyState,
} from "@/lib/deal-room/settlement";

interface WaitForFulfillmentConfirmationInput {
  custodyCommitment: bigint;
  evidenceCommitment: bigint;
  previousRoundsRemaining: number;
  timeoutMs?: number;
  pollMs?: number;
}

/*
 * Ready X is transport, not settlement truth.
 *
 * A work submission is confirmed only when the Rekber custody itself
 * contains the exact evidence commitment and consumes one fulfillment round.
 * This also recovers mobile Ready X callbacks that fail or never return after
 * Starknet has already accepted the transaction.
 */
export async function waitForFulfillmentConfirmation({
  custodyCommitment,
  evidenceCommitment,
  previousRoundsRemaining,
  timeoutMs = 45_000,
  pollMs = 1_000,
}: WaitForFulfillmentConfirmationInput): Promise<
  RekberCustodyState | null
> {
  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const state =
        await getRekberCustody(
          custodyCommitment,
        );

      const confirmed =
        Boolean(state) &&
        state!.fulfillmentSubmitted &&
        state!.fulfillmentEvidenceCommitment ===
          evidenceCommitment &&
        state!.fulfillmentRoundsRemaining <
          previousRoundsRemaining;

      if (confirmed) {
        return state;
      }
    } catch {
      // RPC/indexer can briefly lag immediately after Ready X submission.
    }

    await new Promise<void>((resolve) =>
      window.setTimeout(
        resolve,
        pollMs,
      ),
    );
  }

  return null;
}
