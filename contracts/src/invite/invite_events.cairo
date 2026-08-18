#[derive(Drop, starknet::Event)]
pub struct InviteCreated {
    #[key]
    pub commitment: felt252,
    pub expires_at: u64,
}

#[derive(Drop, starknet::Event)]
pub struct InviteConsumed {
    #[key]
    pub commitment: felt252,
}
