use starknet::ContractAddress;

use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
use crate::escrow_rekber::types::EscrowRekberCustody;

/// VINSS Rekber.
///
/// Participant actions execute through the configured Privacy Pool.
///
/// Two narrow public authorization hooks exist:
/// - an optional objective verifier can confirm a submitted evidence hash;
/// - a dispute resolver can authorize an exact payer/payee principal split.
///
/// Neither hook can withdraw funds to itself or choose an arbitrary recipient.
#[starknet::interface]
pub trait IVinssEscrowRekber<TState> {
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

    /// Authoritative fee quote:
    /// max(2% principal, configured USD minimum converted with Pragma).
    fn quote_rekber_fee(
        self: @TState,
        token: ContractAddress,
        principal: u128,
    ) -> u128;

    fn get_privacy_pool(self: @TState) -> ContractAddress;
    fn get_pragma_oracle(self: @TState) -> ContractAddress;
    fn get_dispute_resolver(self: @TState) -> ContractAddress;
    fn get_external_verifier(self: @TState) -> ContractAddress;

    fn get_fee_policy(
        self: @TState,
    ) -> (u128, u64, u32);

    fn get_supported_tokens(
        self: @TState,
    ) -> (ContractAddress, ContractAddress);

    fn custody_exists(
        self: @TState,
        custody_commitment: felt252,
    ) -> bool;

    fn get_custody(
        self: @TState,
        custody_commitment: felt252,
    ) -> EscrowRekberCustody;

    fn get_reserved_amount(
        self: @TState,
        token: ContractAddress,
    ) -> u128;

    /// Objective verification only changes fulfillment state.
    /// It never moves principal.
    fn confirm_external_fulfillment(
        ref self: TState,
        custody_commitment: felt252,
        evidence_commitment: felt252,
    );

    /// Resolver authorizes a principal split after a dispute.
    ///
    /// Payer later claims payer_amount with the payer refund capability.
    /// Payee later claims payee_amount with the payee claim capability.
    fn authorize_dispute_resolution(
        ref self: TState,
        custody_commitment: felt252,
        resolution_commitment: felt252,
        payer_amount: u128,
        payee_amount: u128,
    );
}
