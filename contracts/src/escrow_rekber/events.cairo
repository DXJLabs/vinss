use starknet::ContractAddress;

// Public Rekber lifecycle events.
//
// Events expose custody commitments and settlement evidence required
// for indexing without publishing private deal terms or participant
// identities.

/// Emitted after principal is secured by the Rekber contract.
#[derive(Drop, starknet::Event)]
pub struct EscrowRekberCustodyFunded {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub token: ContractAddress,
    pub amount: u128,
    pub refund_after: u64,
    pub timestamp: u64,
}

/// Emitted when custody is successfully released.
#[derive(Drop, starknet::Event)]
pub struct EscrowRekberCustodyReleased {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub output_note_id: felt252,
    pub timestamp: u64,
}

/// Emitted when custody is returned through the refund path.
#[derive(Drop, starknet::Event)]
pub struct EscrowRekberCustodyRefunded {
    #[key]
    pub custody_commitment: felt252,
    #[key]
    pub output_note_id: felt252,
    pub timestamp: u64,
}

