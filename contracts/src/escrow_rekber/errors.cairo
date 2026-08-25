// Rekber contract error constants.
//
// Short felt252 values are used so failures remain compatible with
// Starknet contract assertions while still identifying the violated
// custody or accounting invariant.

// Action and calldata validation.
pub const INVALID_ACTION: felt252 = 'BAD_REKBER_ACTION';
pub const INVALID_CALLDATA: felt252 = 'BAD_REKBER_DATA';
// Custody lifecycle validation.
pub const ZERO_CUSTODY: felt252 = 'ZERO_CUSTODY_COMMIT';
pub const ZERO_COMMITMENT: felt252 = 'ZERO_REKBER_COMMIT';
pub const DUPLICATE_COMMITMENT: felt252 = 'DUP_REKBER_COMMIT';
pub const DUPLICATE_CUSTODY: felt252 = 'CUSTODY_ALREADY_EXISTS';
pub const CUSTODY_NOT_FOUND: felt252 = 'CUSTODY_NOT_FOUND';
pub const CUSTODY_CONSUMED: felt252 = 'CUSTODY_ALREADY_CONSUMED';
// Settlement secret validation.
pub const ZERO_SECRET: felt252 = 'ZERO_ESCROW_SECRET';
pub const BAD_RELEASE_AUTH: felt252 = 'BAD_RELEASE_AUTH';
pub const BAD_PAYEE_CLAIM: felt252 = 'BAD_PAYEE_CLAIM';
pub const BAD_REFUND_SECRET: felt252 = 'BAD_REFUND_SECRET';
// Settlement timing validation.
pub const INVALID_REFUND_AFTER: felt252 = 'BAD_REFUND_AFTER';
pub const RELEASE_WINDOW_CLOSED: felt252 = 'RELEASE_WINDOW_CLOSED';
pub const REFUND_TOO_EARLY: felt252 = 'REFUND_TOO_EARLY';
// Token custody and reserve accounting.
pub const FUNDS_NOT_RECEIVED: felt252 = 'FUNDS_NOT_RECEIVED';
pub const APPROVAL_FAILED: felt252 = 'APPROVAL_FAILED';
pub const APPROVAL_NOT_EXACT: felt252 = 'APPROVAL_NOT_EXACT';
pub const STALE_ALLOWANCE: felt252 = 'STALE_ALLOWANCE';
pub const RESERVE_INVARIANT: felt252 = 'RESERVE_INVARIANT';
pub const FEE_TOO_SMALL: felt252 = 'ESCROW_FEE_TOO_SMALL';
