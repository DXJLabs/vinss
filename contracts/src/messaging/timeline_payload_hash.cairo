use core::poseidon::poseidon_hash_span;

use crate::utils::constants::{
    MESSAGE_ENVELOPE_HEADER_FELTS, VINSS_MESSAGE_COMMITMENT_DOMAIN,
};

/// Compute the domain-separated commitment for one encrypted VINSS message.
///
/// Commitment format:
///
/// Poseidon(
///     VINSS_MESSAGE_COMMITMENT_DOMAIN,
///     envelope_version,
///     message_locator,
///     sender_tag,
///     recipient_tag,
///     payload_chunk_count,
///     ...ciphertext_chunks
/// )
///
/// SECURITY:
/// - the envelope version is committed;
/// - the one-time message locator is committed;
/// - the declared ciphertext length is committed;
/// - ciphertext ordering is committed;
/// - changing any ciphertext chunk changes the resulting commitment.
///
/// The caller must validate the exact calldata length before invoking this
/// function. Ciphertext chunks begin after the fixed six-felt header:
///
/// 0. envelope_version
/// 1. message_locator
/// 2. sender_tag
/// 3. recipient_tag
/// 4. claimed payload_commitment
/// 5. payload_chunk_count
/// 6... ciphertext_chunks
pub fn compute_message_commitment(
    envelope_version: u8,
    message_locator: felt252,
    sender_tag: felt252,
    recipient_tag: felt252,
    payload_chunk_count: u64,
    calldata: Span<felt252>,
) -> felt252 {
    let mut hash_input = ArrayTrait::<felt252>::new();

    hash_input.append(VINSS_MESSAGE_COMMITMENT_DOMAIN);
    hash_input.append(envelope_version.into());
    hash_input.append(message_locator);
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
            .expect('Chunk index overflow');

        let calldata_index = MESSAGE_ENVELOPE_HEADER_FELTS + chunk_offset;

        hash_input.append(*calldata.at(calldata_index));

        chunk_index += 1;
    };

    poseidon_hash_span(hash_input.span())
}
