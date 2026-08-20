/// Persisted public record for one encrypted VINSS message.
///
/// The record contains no sender address, recipient address, reusable
/// conversation identifier, plaintext message kind, or plaintext content.
/// Sender/recipient routing is represented only by one-time opaque tags.
///
/// Ciphertext chunks are stored separately under:
/// `(message_locator, chunk_index)`.
///
/// `message_locator` must be unique for every message. The VINSS client
/// integration layer derives and tracks it from private application state; the
/// helper only enforces that the same locator cannot be stored twice.
///
/// Privacy Pool replay/nullifier requirements are enforced by the containing
/// Privacy Pool transaction and are separate from this helper-level locator guard.
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct VinssMessageRecord {
    /// Version of the encrypted-message envelope and commitment format.
    pub envelope_version: u8,

    /// One-time opaque locator used to retrieve this message.
    pub message_locator: felt252,

    /// One-time sender-routing tag derived privately by the client.
    /// This is NOT a wallet address and must change for every message.
    pub sender_tag: felt252,

    /// One-time recipient-routing tag derived privately by the client.
    /// This is NOT a wallet address and must change for every message.
    pub recipient_tag: felt252,

    /// Domain-separated Poseidon commitment to the envelope fields and all
    /// ciphertext chunks.
    pub payload_commitment: felt252,

    /// Number of ciphertext chunks stored for this message.
    pub payload_chunk_count: u64,
}
