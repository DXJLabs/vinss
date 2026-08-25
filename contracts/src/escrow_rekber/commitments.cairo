use core::poseidon::poseidon_hash_span;

// Domain tags are immutable: changing them would invalidate saved secrets.
pub const RELEASE_AUTH_DOMAIN: felt252 =
    'VINSS_RELEASE_AUTH';
pub const PAYEE_CLAIM_DOMAIN: felt252 =
    'VINSS_PAYEE_CLAIM';
pub const REFUND_DOMAIN: felt252 =
    'VINSS_ESCROW_REFUND';

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
