use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, starknet::Store, PartialEq, Debug)]
pub struct SettlementCertificateRecord {
    pub token_id: felt252,
    pub custody_commitment: felt252,
    pub role: u8,
    pub recipient: ContractAddress,
    pub settled_at: u64,
    pub issued_at: u64,
}

