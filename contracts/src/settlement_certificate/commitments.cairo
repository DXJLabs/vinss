use core::poseidon::poseidon_hash_span;
use starknet::ContractAddress;

pub const CERTIFICATE_CLAIM_DOMAIN: felt252 =
    'VINSS_CERT_CLAIM';
pub const CERTIFICATE_TOKEN_DOMAIN: felt252 =
    'VINSS_CERT_TOKEN';

pub fn compute_certificate_claim_commitment(
    custody_commitment: felt252,
    role: u8,
    recipient: ContractAddress,
    secret: felt252,
) -> felt252 {
    poseidon_hash_span(
        array![
            CERTIFICATE_CLAIM_DOMAIN,
            custody_commitment,
            role.into(),
            recipient.into(),
            secret,
        ]
            .span(),
    )
}

pub fn compute_certificate_token_id(
    custody_commitment: felt252,
    role: u8,
) -> felt252 {
    poseidon_hash_span(
        array![
            CERTIFICATE_TOKEN_DOMAIN,
            custody_commitment,
            role.into(),
        ]
            .span(),
    )
}

