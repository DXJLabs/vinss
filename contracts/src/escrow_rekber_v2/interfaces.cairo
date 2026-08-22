use starknet::ContractAddress;

use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
use crate::escrow_rekber_v2::types::EscrowRekberV2Custody;

/// Rekber V2 requires two independent release secrets.
///
/// Deposit calldata:
/// [1, custody, release_auth_commitment, payee_claim_commitment,
///  refund_commitment, payer_certificate_commitment,
///  payee_certificate_commitment, refund_after, token, principal,
///  revenue_open_note_id]
///
/// Release calldata:
/// [2, custody, release_authorization_secret, payee_claim_secret,
///  output_note_id]
///
/// Refund calldata:
/// [3, custody, refund_secret, output_note_id]
#[starknet::interface]
pub trait IVinssEscrowRekberV2<TState> {
    fn privacy_invoke(
        ref self: TState,
        calldata: Span<felt252>,
    ) -> Span<OpenNoteDeposit>;

    fn compute_release_authorization_commitment(
        self: @TState,
        custody_commitment: felt252,
        secret: felt252,
    ) -> felt252;

    fn compute_payee_claim_commitment(
        self: @TState,
        custody_commitment: felt252,
        secret: felt252,
    ) -> felt252;

    fn compute_refund_commitment(
        self: @TState,
        custody_commitment: felt252,
        secret: felt252,
    ) -> felt252;

    fn get_privacy_pool(self: @TState) -> ContractAddress;

    fn custody_exists(
        self: @TState,
        custody_commitment: felt252,
    ) -> bool;

    fn get_custody(
        self: @TState,
        custody_commitment: felt252,
    ) -> EscrowRekberV2Custody;

    fn get_reserved_amount(
        self: @TState,
        token: ContractAddress,
    ) -> u128;
}

