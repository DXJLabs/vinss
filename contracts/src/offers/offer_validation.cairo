use crate::utils::constants::{
    MAX_OFFER_PAYLOAD_CHUNKS,
    VINSS_OFFER_ENVELOPE_VERSION,
};
use crate::utils::errors;

pub fn assert_valid_offer_action_header(
    envelope_version: u8,
    offer_action_locator: felt252,
    sender_tag: felt252,
    recipient_tag: felt252,
    payload_commitment: felt252,
    payload_chunk_count: u64,
) {
    assert(
        envelope_version == VINSS_OFFER_ENVELOPE_VERSION,
        errors::UNSUPPORTED_OFFER_ENVELOPE_VERSION,
    );
    assert(
        offer_action_locator != 0,
        errors::ZERO_OFFER_ACTION_LOCATOR,
    );
    assert(
        sender_tag != 0,
        errors::ZERO_OFFER_SENDER_TAG,
    );
    assert(
        recipient_tag != 0,
        errors::ZERO_OFFER_RECIPIENT_TAG,
    );
    assert(
        payload_commitment != 0,
        errors::ZERO_OFFER_PAYLOAD_COMMITMENT,
    );
    assert(
        payload_chunk_count > 0,
        errors::EMPTY_OFFER_PAYLOAD,
    );
    assert(
        payload_chunk_count <= MAX_OFFER_PAYLOAD_CHUNKS,
        errors::TOO_MANY_OFFER_PAYLOAD_CHUNKS,
    );
}

pub fn assert_offer_action_exists(
    offer_action_exists: bool,
) {
    assert(
        offer_action_exists,
        errors::OFFER_ACTION_NOT_FOUND,
    );
}

pub fn assert_offer_action_not_stored(
    offer_action_exists: bool,
) {
    assert(
        !offer_action_exists,
        errors::OFFER_ACTION_LOCATOR_ALREADY_USED,
    );
}

pub fn assert_offer_payload_not_committed(
    is_committed: bool,
) {
    assert(
        !is_committed,
        errors::OFFER_PAYLOAD_ALREADY_COMMITTED,
    );
}

pub fn assert_valid_offer_chunk_index(
    chunk_index: u64,
    payload_chunk_count: u64,
) {
    assert(
        chunk_index < payload_chunk_count,
        errors::OFFER_CHUNK_INDEX_OUT_OF_BOUNDS,
    );
}
