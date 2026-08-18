use starknet::Store;

#[derive(Serde, Copy, Drop, PartialEq, Debug, Store)]
pub struct InviteEntry {
    pub expires_at: u64,
    pub consumed: bool,
    pub exists: bool,
}

#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub enum InviteOperation {
    Create,
    Consume,
}
