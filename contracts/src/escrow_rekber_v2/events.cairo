use starknet::ContractAddress;

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberV2CustodyFunded {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub token: ContractAddress,
    pub amount: u128,
    pub refund_after: u64,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberV2CustodyReleased {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub output_note_id: felt252,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberV2CustodyRefunded {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub output_note_id: felt252,
    pub timestamp: u64,
}

