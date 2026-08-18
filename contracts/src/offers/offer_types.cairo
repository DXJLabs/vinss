#[derive(
    Copy,
    Drop,
    Serde,
    PartialEq,
    Debug,
    starknet::Store,
)]
pub struct EncryptedOfferActionRecord {
    pub envelope_version: u8,
    pub offer_action_locator: felt252,
    pub sender_tag: felt252,
    pub recipient_tag: felt252,
    pub payload_commitment: felt252,
    pub payload_chunk_count: u64,
}
