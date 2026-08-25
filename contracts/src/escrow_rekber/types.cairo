use starknet::ContractAddress;

/// Public custody state for Rekber.
///
/// Deal terms and participant identities never enter this record. Token,
/// amount, timeout, one-time commitments and settlement state are public.
#[derive(Copy, Drop, Serde, starknet::Store, PartialEq, Debug)]
pub struct EscrowRekberCustody {
    pub custody_commitment: felt252,
    pub release_authorization_commitment: felt252,
    pub payee_claim_commitment: felt252,
    pub refund_commitment: felt252,
    pub payer_certificate_commitment: felt252,
    pub payee_certificate_commitment: felt252,
    pub token: ContractAddress,
    pub amount: u128,
    pub refund_after: u64,
    pub consumed: bool,
    pub refunded: bool,
    pub created_at: u64,
    pub settled_at: u64,
}
