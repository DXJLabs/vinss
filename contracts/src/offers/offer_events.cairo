#[derive(Drop, starknet::Event)]
pub struct OfferActionCommitted {
    #[key]
    pub offer_action_locator: felt252,
    pub payload_commitment: felt252,
    pub sender_tag: felt252,
    pub recipient_tag: felt252,
}
