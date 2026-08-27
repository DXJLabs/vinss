use core::poseidon::poseidon_hash_span;

// -----------------------------------------------------------------------------
// Rekber secret domains
// -----------------------------------------------------------------------------
//
// Every capability is domain-separated and bound to exactly one custody.
// Participant identities and plaintext business terms remain outside the public
// custody contract.

pub const RELEASE_AUTH_DOMAIN: felt252 = 'VINSS_RELEASE_AUTH';
pub const PAYEE_CLAIM_DOMAIN: felt252 = 'VINSS_PAYEE_CLAIM';
pub const REFUND_DOMAIN: felt252 = 'VINSS_ESCROW_REFUND';
pub const PAYER_CONFIRM_DOMAIN: felt252 = 'VINSS_PAYER_CONFIRM';
pub const PAYER_DISPUTE_DOMAIN: felt252 = 'VINSS_PAYER_DISPUTE';
pub const PAYEE_DISPUTE_DOMAIN: felt252 = 'VINSS_PAYEE_DISPUTE';
pub const PAYEE_REFUND_CONSENT_DOMAIN: felt252 = 'VINSS_REFUND_CONSENT';

// One-way chains support bounded repeat actions without exposing future
// preimages when an earlier action is revealed.
pub const FULFILLMENT_CHAIN_DOMAIN: felt252 = 'VINSS_FULFILL_CHAIN';
pub const REVISION_CHAIN_DOMAIN: felt252 = 'VINSS_REVISION_CHAIN';

fn hash_secret(
    domain: felt252,
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    poseidon_hash_span(
        array![
            domain,
            custody_commitment,
            secret,
        ]
            .span(),
    )
}

pub fn compute_release_authorization_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        RELEASE_AUTH_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_payee_claim_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        PAYEE_CLAIM_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_refund_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        REFUND_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_payer_confirmation_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        PAYER_CONFIRM_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_payer_dispute_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        PAYER_DISPUTE_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_payee_dispute_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        PAYEE_DISPUTE_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_payee_refund_consent_commitment(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        PAYEE_REFUND_CONSENT_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_fulfillment_chain_step(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        FULFILLMENT_CHAIN_DOMAIN,
        custody_commitment,
        secret,
    )
}

pub fn compute_revision_chain_step(
    custody_commitment: felt252,
    secret: felt252,
) -> felt252 {
    hash_secret(
        REVISION_CHAIN_DOMAIN,
        custody_commitment,
        secret,
    )
}
