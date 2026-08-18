#[derive(Drop, starknet::Event)]
pub struct InviteCreated {
    #[key]
    pub commitment: felt252,
    pub expires_at: felt252,
}

#[derive(Drop, starknet::Event)]
pub struct InviteConsumed {
    #[key]
    pub commitment: felt252,
}
