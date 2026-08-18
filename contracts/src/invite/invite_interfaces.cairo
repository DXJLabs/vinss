use privacy::objects::OpenNoteDeposit;

use crate::invite::invite_types::{
    InviteEntry,
    InviteOperation,
};

#[starknet::interface]
pub trait IVinssInvite<T> {
    fn get_invite(
        self: @T,
        commitment: felt252,
    ) -> InviteEntry;

    fn privacy_invoke(
        ref self: T,
        operation: InviteOperation,
        commitment: felt252,
        expires_at: u64,
        secret: felt252,
    ) -> Span<OpenNoteDeposit>;
}
