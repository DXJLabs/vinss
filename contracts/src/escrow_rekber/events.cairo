use starknet::ContractAddress;

// Public Rekber lifecycle events.
//
// Events expose only custody/evidence commitments and accounting state needed
// for verification/indexing. Private Offer text, file contents, participant
// identities, and dispute plaintext remain encrypted off-chain.

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberCustodyFunded {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub token: ContractAddress,

    // Keep the first three data positions stable for simple indexers.
    pub amount: u128,
    pub fulfillment_deadline: u64,
    pub timestamp: u64,

    pub fee_amount: u128,
    pub review_window: u64,
    pub verification_policy: u8,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberFulfillmentSubmitted {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub evidence_commitment: felt252,
    pub timestamp: u64,
    pub rounds_remaining: u8,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberFulfillmentConfirmed {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub evidence_commitment: felt252,
    pub review_deadline: u64,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberRevisionRequested {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub reason_commitment: felt252,
    pub revision_deadline: u64,
    pub timestamp: u64,
    pub rounds_remaining: u8,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberDisputeOpened {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub evidence_commitment: felt252,
    pub opened_by_role: u8,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberDisputeResolutionAuthorized {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub resolution_commitment: felt252,
    pub payer_amount: u128,
    pub payee_amount: u128,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberResolutionClaimed {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub output_note_id: felt252,
    pub role: u8,
    pub amount: u128,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberCustodyReleased {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub output_note_id: felt252,
    pub timestamp: u64,
    pub release_mode: u8,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberCustodyRefunded {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub output_note_id: felt252,
    pub timestamp: u64,
    pub refund_mode: u8,
}

#[derive(Drop, starknet::Event)]
pub struct EscrowRekberCustodyResolved {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub resolution_commitment: felt252,
    pub payer_amount: u128,
    pub payee_amount: u128,
    pub timestamp: u64,
}
