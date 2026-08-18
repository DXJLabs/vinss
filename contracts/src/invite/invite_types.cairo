#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct InviteEntry {
    pub expires_at: felt252,
    pub consumed: bool,
    pub exists: bool,
}
