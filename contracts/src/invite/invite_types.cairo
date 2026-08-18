#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct InviteEntry {
    pub expires_at: u64,
    pub consumed: bool,
    pub exists: bool,
}
