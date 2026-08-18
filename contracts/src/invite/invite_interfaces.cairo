use starknet::ContractAddress;

use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
use crate::invite::invite_types::InviteEntry;

#[starknet::interface]
pub trait IVinssInvite<TContractState> {
    /// InvokeExternal calldata:
    ///
    /// Create:
    /// [0, commitment, expires_at]
    ///
    /// Consume:
    /// [1, secret]
    fn privacy_invoke(
        ref self: TContractState,
        calldata: Span<felt252>,
    ) -> Span<OpenNoteDeposit>;

    fn get_privacy_pool(
        self: @TContractState,
    ) -> ContractAddress;

    fn get_invite(
        self: @TContractState,
        commitment: felt252,
    ) -> InviteEntry;
}
