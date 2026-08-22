use starknet::ContractAddress;

use crate::settlement_certificate::types::SettlementCertificateRecord;

#[starknet::interface]
pub trait IVinssSettlementCertificate<TState> {
    /// Claim an optional public certificate for the calling wallet.
    ///
    /// ERC-721 ownership is public. Requiring the recipient to call directly
    /// prevents either counterparty from minting the other party's
    /// certificate without that wallet's explicit acknowledgement.
    fn claim(
        ref self: TState,
        custody_commitment: felt252,
        role: u8,
        secret: felt252,
    ) -> felt252;

    fn get_escrow_rekber_v2(self: @TState) -> ContractAddress;

    fn is_claimed(
        self: @TState,
        custody_commitment: felt252,
        role: u8,
    ) -> bool;

    fn get_certificate_token_id(
        self: @TState,
        custody_commitment: felt252,
        role: u8,
    ) -> felt252;

    fn get_certificate(
        self: @TState,
        token_id: felt252,
    ) -> SettlementCertificateRecord;
}
