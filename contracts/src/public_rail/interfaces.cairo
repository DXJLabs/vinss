use starknet::ContractAddress;
use crate::invite::invite_types::InviteEntry;

#[starknet::interface]
pub trait IVinssPublicRail<TState> {
    fn initialize(
        ref self: TState,
        invite: ContractAddress,
        message: ContractAddress,
        offer: ContractAddress,
        escrow_action: ContractAddress,
        rekber: ContractAddress,
        fee_policy: ContractAddress,
    );
    fn get_configuration(self: @TState) -> Span<ContractAddress>;
    fn create_invite(ref self: TState, calldata: Span<felt252>, claim_public_key: felt252);
    fn consume_invite(
        ref self: TState, commitment: felt252, signature_r: felt252, signature_s: felt252,
    );
    fn get_invite(self: @TState, commitment: felt252) -> InviteEntry;
    fn get_invite_consumer(self: @TState, commitment: felt252) -> ContractAddress;
    fn post_message(ref self: TState, calldata: Span<felt252>, locator_nonce: felt252);
    fn post_offer(ref self: TState, calldata: Span<felt252>, locator_nonce: felt252);
    fn post_escrow_action(
        ref self: TState,
        calldata: Span<felt252>,
        quoted_workflow_fee: u128,
        locator_nonce: felt252,
    );
    fn fund_custody(ref self: TState, calldata: Span<felt252>, payee: ContractAddress);
    fn act_custody(ref self: TState, calldata: Span<felt252>);
    fn get_custody_parties(
        self: @TState, commitment: felt252,
    ) -> (ContractAddress, ContractAddress);
}

#[starknet::interface]
pub trait IVinssPublicFeePolicy<TState> {
    fn get_shield_policy(self: @TState) -> ContractAddress;
}
