use starknet::ContractAddress;

#[derive(Drop, starknet::Event)]
pub struct SettlementCertificateIssued {
    #[key]
    pub token_id: felt252,
    #[key]
    pub recipient: ContractAddress,
    pub custody_commitment: felt252,
    pub role: u8,
    pub settled_at: u64,
    pub issued_at: u64,
}

