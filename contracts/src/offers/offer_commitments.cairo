use core::poseidon::poseidon_hash_span;

use crate::utils::constants::{
    OFFER_ENVELOPE_HEADER_FELTS,
    VINSS_OFFER_COMMITMENT_DOMAIN,
};

pub fn compute_offer_action_commitment(
    envelope_version: u8,
    offer_action_locator: felt252,
    sender_tag: felt252,
    recipient_tag: felt252,
    payload_chunk_count: u64,
    calldata: Span<felt252>,
) -> felt252 {
    let mut hash_input =
        ArrayTrait::<felt252>::new();

    hash_input.append(
        VINSS_OFFER_COMMITMENT_DOMAIN,
    );
    hash_input.append(envelope_version.into());
    hash_input.append(offer_action_locator);
    hash_input.append(sender_tag);
    hash_input.append(recipient_tag);
    hash_input.append(payload_chunk_count.into());

    let mut chunk_index: u64 = 0;

    loop {
        if chunk_index == payload_chunk_count {
            break;
        }

        let chunk_offset: usize = chunk_index
            .try_into()
            .expect('Offer chunk overflow');

        let calldata_index =
            OFFER_ENVELOPE_HEADER_FELTS
            + chunk_offset;

        hash_input.append(
            *calldata.at(calldata_index),
        );

        chunk_index += 1;
    };

    poseidon_hash_span(hash_input.span())
}
