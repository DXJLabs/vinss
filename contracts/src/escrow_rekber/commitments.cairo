use core::poseidon::poseidon_hash_span;

// Rekber commitment domains.
//
// Each secret is bound to a custody commitment before funding.
// Only the preimage is revealed when the corresponding settlement
// path is executed.
pub const RELEASE_AUTH_DOMAIN: felt252 =
    'VINSS_RELEASE_AUTH';
pub const PAYEE_CLAIM_DOMAIN: felt252 =
    'VINSS_PAYEE_CLAIM';
pub const REFUND_DOMAIN: felt252 =
    'VINSS_ESCROW_REFUND';

/// Computes the payer release-authorization commitment.
///
/// The resulting hash binds the payer secret to one custody.
pub fn compute_release_authorization_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    poseidon_hash_span(
        array![
            RELEASE_AUTH_DOMAIN,
            custody_commitment,
            secret,
        ]
            .span(),
    )
}

/// Computes the payee claim commitment.
///
/// Release requires this independently generated payee preimage
/// together with the payer release authorization.
pub fn compute_payee_claim_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    poseidon_hash_span(
        array![
            PAYEE_CLAIM_DOMAIN,
            custody_commitment,
            secret,
        ]
            .span(),
    )
}

/// Computes the payer refund commitment.
///
/// The refund preimage becomes usable only after `refund_after`.
pub fn compute_refund_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    poseidon_hash_span(
        array![
            REFUND_DOMAIN,
            custody_commitment,
            secret,
        ]
            .span(),
    )
}
