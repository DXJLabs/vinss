import type {
  RekberCustodyState,
  SettlementRole,
} from "@/lib/deal-room/settlement";

/*
 * These predicates mirror Cairo guards instead of inventing frontend rules.
 * Keeping them pure prevents each component from re-implementing slightly
 * different settlement permissions.
 */
export function canConfirmCounterpartyFulfillment(
  state: RekberCustodyState,
  role: SettlementRole | null,
): boolean {
  return (
    role === "payer" &&
    !state.consumed &&
    !state.disputed &&
    state.verificationPolicy === 2 &&
    state.fulfillmentSubmitted &&
    !state.fulfillmentConfirmed
  );
}

export function canOpenRekberDispute(
  state: RekberCustodyState,
  nowSeconds: number,
): boolean {
  if (
    state.consumed ||
    state.disputed ||
    !state.fulfillmentSubmitted
  ) {
    return false;
  }

  /*
   * Policy-2 submission can be disputed before receipt confirmation.
   * Once review starts, the deadline is exclusive because AUTO_RELEASE
   * becomes valid exactly at review_deadline.
   */
  if (
    state.fulfillmentConfirmed &&
    state.reviewDeadline > 0
  ) {
    return nowSeconds < state.reviewDeadline;
  }

  return true;
}

export function canAutoReleaseRekber(
  state: RekberCustodyState,
  role: SettlementRole | null,
  nowSeconds: number,
): boolean {
  return (
    role === "payee" &&
    !state.consumed &&
    !state.disputed &&
    state.fulfillmentSubmitted &&
    state.fulfillmentConfirmed &&
    !state.revisionPending &&
    state.reviewDeadline > 0 &&
    nowSeconds >= state.reviewDeadline
  );
}

export function canClaimRekberResolution(
  state: RekberCustodyState,
  role: SettlementRole | null,
): boolean {
  if (
    !role ||
    state.consumed ||
    !state.disputed ||
    !state.resolutionAuthorized
  ) {
    return false;
  }

  return role === "payer"
    ? (
        !state.resolutionPayerClaimed &&
        state.resolutionPayerAmount > 0n
      )
    : (
        !state.resolutionPayeeClaimed &&
        state.resolutionPayeeAmount > 0n
      );
}

export function canTimeoutRefundRekber(
  state: RekberCustodyState | null,
  refundReached: boolean,
): boolean {
  return Boolean(
    refundReached &&
      state &&
      !state.consumed &&
      !state.disputed &&
      !state.fulfillmentSubmitted,
  );
}


function mutualRefundStillOpen(
  state: RekberCustodyState,
): boolean {
  return (
    !state.consumed &&
    !state.resolutionAuthorized &&
    !state.resolutionPayerClaimed &&
    !state.resolutionPayeeClaimed
  );
}

/*
 * Mutual cancellation is valid before or after fulfillment, including while a
 * dispute is open. Once the resolver authorizes a split, only resolution
 * claims may consume the remaining principal.
 */
export function canAuthorizeMutualRefundConsent(
  state: RekberCustodyState,
  role: SettlementRole | null,
): boolean {
  return (
    role === "payee" &&
    mutualRefundStillOpen(state)
  );
}

export function canCompleteMutualRefund(
  state: RekberCustodyState,
  role: SettlementRole | null,
): boolean {
  return (
    role === "payer" &&
    mutualRefundStillOpen(state)
  );
}
