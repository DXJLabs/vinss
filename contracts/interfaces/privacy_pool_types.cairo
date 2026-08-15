use starknet::ContractAddress;

/// ABI mirror of `privacy::objects::OpenNoteDeposit` from the canonical
/// Starknet Privacy Pool source supplied with this project review.
///
/// VINSS does not modify or reimplement the Privacy Pool protocol. This type is
/// kept locally so the VINSS contract package can compile independently while
/// remaining ABI-compatible with `privacy_invoke` return data.
#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}
