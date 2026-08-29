// Settlement Certificate tests.
//
// The SBT is intentionally a clean-settlement reputation artifact:
// - clean successful release => claimable;
// - refund => not claimable;
// - dispute resolution => not claimable, even if payee receives 100%.

use core::serde::Serde;
use snforge_std::{
    ContractClassTrait,
    DeclareResultTrait,
    declare,
    start_cheat_block_timestamp,
    start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use openzeppelin_interfaces::erc721::{
    IERC721Dispatcher,
    IERC721DispatcherTrait,
};

use crate::escrow_rekber::commitments::{
    compute_fulfillment_chain_step,
    compute_payee_claim_commitment,
    compute_payee_dispute_commitment,
    compute_payee_refund_consent_commitment,
    compute_payer_confirmation_commitment,
    compute_payer_dispute_commitment,
    compute_refund_commitment,
    compute_release_authorization_commitment,
};
use crate::escrow_rekber::interfaces::{
    IVinssEscrowRekberDispatcher,
    IVinssEscrowRekberDispatcherTrait,
};
use crate::escrow_rekber::types::POLICY_SUBMISSION_REVIEW;
use crate::settlement_certificate::commitments::{
    compute_certificate_claim_commitment,
    compute_certificate_token_id,
};
use crate::settlement_certificate::interfaces::{
    IVinssSettlementCertificateDispatcher,
    IVinssSettlementCertificateDispatcherTrait,
};
use crate::test_mocks::mock_erc20::{
    IMockClaimERC20Dispatcher,
    IMockClaimERC20DispatcherTrait,
};
use crate::test_mocks::mock_pragma::{
    IMockPragmaDispatcher,
    IMockPragmaDispatcherTrait,
};

const PRIVACY_POOL: felt252 = 0x123;
const RESOLVER: felt252 = 0x456;
const EXTERNAL_VERIFIER: felt252 = 0x789;

const CUSTODY: felt252 = 0x3101;
const RELEASE_AUTH_SECRET: felt252 = 0x711;
const PAYEE_CLAIM_SECRET: felt252 = 0x722;
const REFUND_SECRET: felt252 = 0x733;
const PAYER_CONFIRM_SECRET: felt252 = 0x734;
const PAYER_DISPUTE_SECRET: felt252 = 0x735;
const PAYEE_DISPUTE_SECRET: felt252 = 0x736;
const PAYEE_REFUND_CONSENT_SECRET: felt252 = 0x737;
const FULFILLMENT_SECRET: felt252 = 0x738;

const PAYER_CERT_SECRET: felt252 = 0x744;
const PAYEE_CERT_SECRET: felt252 = 0x755;
const PAYER: felt252 = 0x901;
const PAYEE: felt252 = 0x902;

const REVENUE_NOTE: felt252 = 0x811;
const OUTPUT_NOTE: felt252 = 0x822;

const DEPOSIT_TIME: u64 = 1000;
const FULFILLMENT_DEADLINE: u64 = 2000;
const REVIEW_WINDOW: u64 = 300;

const PRINCIPAL: u128 =
    100_000000000000000000_u128;
const FEE: u128 =
    2_000000000000000000_u128;

const STRK_USD_PAIR: felt252 = 'STRK/USD';
const USDC_USD_PAIR: felt252 = 'USDC/USD';
const ONE_USD: u128 = 100_000_000_u128;
const ORACLE_DECIMALS: u32 = 8;
const ORACLE_SOURCES: u32 = 2;
const ORACLE_MAX_AGE: u64 = 300;
const MINIMUM_FEE_USD_MICROS: u128 =
    1_000_000_u128;

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

fn payer() -> ContractAddress {
    PAYER.try_into().unwrap()
}

fn payee() -> ContractAddress {
    PAYEE.try_into().unwrap()
}

fn resolver() -> ContractAddress {
    RESOLVER.try_into().unwrap()
}

fn deploy_contracts() -> (
    ContractAddress,
    ContractAddress,
    ContractAddress,
) {
    let token_class =
        declare("MockClaimERC20")
            .unwrap()
            .contract_class();

    let (strk, _) =
        token_class
            .deploy(@array![])
            .unwrap();

    let (usdc, _) =
        token_class
            .deploy(@array![])
            .unwrap();

    let oracle_class =
        declare("MockPragma")
            .unwrap()
            .contract_class();

    let (oracle_address, _) =
        oracle_class
            .deploy(@array![])
            .unwrap();

    let oracle =
        IMockPragmaDispatcher {
            contract_address:
                oracle_address,
        };

    oracle.set_price(
        STRK_USD_PAIR,
        ONE_USD,
        ORACLE_DECIMALS,
        DEPOSIT_TIME,
        ORACLE_SOURCES,
        0,
    );

    oracle.set_price(
        USDC_USD_PAIR,
        ONE_USD,
        ORACLE_DECIMALS,
        DEPOSIT_TIME,
        ORACLE_SOURCES,
        0,
    );

    let fee_policy_class =
        declare("MockFeePolicy")
            .unwrap()
            .contract_class();

    let (fee_policy_address, _) =
        fee_policy_class
            .deploy(
                @array![
                    FEE.into(),
                    MINIMUM_FEE_USD_MICROS.into(),
                ],
            )
            .unwrap();

    let rekber_class =
        declare("VinssEscrowRekber")
            .unwrap()
            .contract_class();

    let rekber_constructor = array![
        PRIVACY_POOL,
        oracle_address.into(),
        fee_policy_address.into(),
        RESOLVER,
        EXTERNAL_VERIFIER,
        strk.into(),
        usdc.into(),
        STRK_USD_PAIR,
        USDC_USD_PAIR,
        MINIMUM_FEE_USD_MICROS.into(),
        ORACLE_MAX_AGE.into(),
        ORACLE_SOURCES.into(),
    ];

    let (rekber, _) =
        rekber_class
            .deploy(@rekber_constructor)
            .unwrap();

    let certificate_class =
        declare(
            "VinssSettlementCertificate",
        )
            .unwrap()
            .contract_class();

    let mut cert_constructor =
        array![rekber.into()];

    let base_uri: ByteArray =
        "https://vinss-nu.vercel.app/api/certificates/";

    base_uri.serialize(
        ref cert_constructor,
    );

    let (certificate, _) =
        certificate_class
            .deploy(
                @cert_constructor,
            )
            .unwrap();

    (
        rekber,
        certificate,
        strk,
    )
}

fn fund(
    rekber_address: ContractAddress,
    token_address: ContractAddress,
) {
    let token =
        IMockClaimERC20Dispatcher {
            contract_address:
                token_address,
        };

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME,
    );

    token.mint(
        rekber_address,
        (PRINCIPAL + FEE).into(),
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            1,
            CUSTODY,
            compute_release_authorization_commitment(
                CUSTODY,
                RELEASE_AUTH_SECRET,
            ),
            compute_payee_claim_commitment(
                CUSTODY,
                PAYEE_CLAIM_SECRET,
            ),
            compute_refund_commitment(
                CUSTODY,
                REFUND_SECRET,
            ),
            compute_payer_confirmation_commitment(
                CUSTODY,
                PAYER_CONFIRM_SECRET,
            ),
            compute_payer_dispute_commitment(
                CUSTODY,
                PAYER_DISPUTE_SECRET,
            ),
            compute_payee_dispute_commitment(
                CUSTODY,
                PAYEE_DISPUTE_SECRET,
            ),
            compute_payee_refund_consent_commitment(
                CUSTODY,
                PAYEE_REFUND_CONSENT_SECRET,
            ),
            compute_fulfillment_chain_step(
                CUSTODY,
                FULFILLMENT_SECRET,
            ),
            0,
            compute_certificate_claim_commitment(
                CUSTODY,
                1,
                payer(),
                PAYER_CERT_SECRET,
            ),
            compute_certificate_claim_commitment(
                CUSTODY,
                2,
                payee(),
                PAYEE_CERT_SECRET,
            ),
            FULFILLMENT_DEADLINE.into(),
            REVIEW_WINDOW.into(),
            POLICY_SUBMISSION_REVIEW.into(),
            1,
            0,
            token_address.into(),
            PRINCIPAL.into(),
            FEE.into(),
            REVENUE_NOTE,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );
}

fn consume_fee(
    rekber_address: ContractAddress,
    token_address: ContractAddress,
) {
    let token =
        IMockClaimERC20Dispatcher {
            contract_address:
                token_address,
        };

    start_cheat_caller_address(
        token_address,
        privacy_pool(),
    );

    token.transfer_from(
        rekber_address,
        privacy_pool(),
        FEE.into(),
    );

    stop_cheat_caller_address(
        token_address,
    );
}

fn submit_fulfillment(
    rekber_address: ContractAddress,
) {
    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME + 10,
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            4,
            CUSTODY,
            FULFILLMENT_SECRET,
            0xabc,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );
}

fn release_clean(
    rekber_address: ContractAddress,
) {
    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            2,
            CUSTODY,
            RELEASE_AUTH_SECRET,
            PAYEE_CLAIM_SECRET,
            OUTPUT_NOTE,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );
}

#[test]
fn clean_release_can_mint_both_soulbound_certificates() {
    let (
        rekber_address,
        certificate_address,
        token_address,
    ) = deploy_contracts();

    fund(
        rekber_address,
        token_address,
    );
    consume_fee(
        rekber_address,
        token_address,
    );
    submit_fulfillment(
        rekber_address,
    );
    release_clean(
        rekber_address,
    );

    let certificate =
        IVinssSettlementCertificateDispatcher {
            contract_address:
                certificate_address,
        };

    start_cheat_caller_address(
        certificate_address,
        payer(),
    );

    let payer_token =
        certificate.claim(
            CUSTODY,
            1,
            PAYER_CERT_SECRET,
        );

    stop_cheat_caller_address(
        certificate_address,
    );

    start_cheat_caller_address(
        certificate_address,
        payee(),
    );

    let payee_token =
        certificate.claim(
            CUSTODY,
            2,
            PAYEE_CERT_SECRET,
        );

    assert(
        payer_token ==
            compute_certificate_token_id(
                CUSTODY,
                1,
            ),
        'payer token mismatch',
    );

    assert(
        payee_token ==
            compute_certificate_token_id(
                CUSTODY,
                2,
            ),
        'payee token mismatch',
    );
}

#[test]
#[should_panic(expected: 'REKBER_WAS_REFUNDED')]
fn refunded_custody_cannot_mint_success_certificate() {
    let (
        rekber_address,
        certificate_address,
        token_address,
    ) = deploy_contracts();

    fund(
        rekber_address,
        token_address,
    );
    consume_fee(
        rekber_address,
        token_address,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        FULFILLMENT_DEADLINE,
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            3,
            CUSTODY,
            REFUND_SECRET,
            OUTPUT_NOTE,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );

    let certificate =
        IVinssSettlementCertificateDispatcher {
            contract_address:
                certificate_address,
        };

    start_cheat_caller_address(
        certificate_address,
        payer(),
    );

    certificate.claim(
        CUSTODY,
        1,
        PAYER_CERT_SECRET,
    );
}

#[test]
#[should_panic(expected: 'REKBER_WAS_DISPUTED')]
fn disputed_payee_win_does_not_mint_clean_success_sbt() {
    let (
        rekber_address,
        certificate_address,
        token_address,
    ) = deploy_contracts();

    fund(
        rekber_address,
        token_address,
    );
    consume_fee(
        rekber_address,
        token_address,
    );
    submit_fulfillment(
        rekber_address,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            6,
            CUSTODY,
            2,
            PAYEE_DISPUTE_SECRET,
            0xdead,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );

    start_cheat_caller_address(
        rekber_address,
        resolver(),
    );

    rekber.authorize_dispute_resolution(
        CUSTODY,
        0xfeed,
        0,
        PRINCIPAL,
    );

    stop_cheat_caller_address(
        rekber_address,
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            10,
            CUSTODY,
            2,
            PAYEE_CLAIM_SECRET,
            OUTPUT_NOTE,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );

    let certificate =
        IVinssSettlementCertificateDispatcher {
            contract_address:
                certificate_address,
        };

    start_cheat_caller_address(
        certificate_address,
        payee(),
    );

    certificate.claim(
        CUSTODY,
        2,
        PAYEE_CERT_SECRET,
    );
}


// MAINNET-RESTORED-CERTIFICATE-REPLAY-TEST

#[test]
#[should_panic(expected: 'CERT_ALREADY_CLAIMED')]
fn certificate_claim_cannot_be_replayed_mainnet() {
    let (
        rekber_address,
        certificate_address,
        token_address,
    ) = deploy_contracts();

    fund(
        rekber_address,
        token_address,
    );
    consume_fee(
        rekber_address,
        token_address,
    );
    submit_fulfillment(
        rekber_address,
    );
    release_clean(
        rekber_address,
    );

    let certificate =
        IVinssSettlementCertificateDispatcher {
            contract_address:
                certificate_address,
        };

    start_cheat_caller_address(
        certificate_address,
        payer(),
    );

    certificate.claim(
        CUSTODY,
        1,
        PAYER_CERT_SECRET,
    );

    certificate.claim(
        CUSTODY,
        1,
        PAYER_CERT_SECRET,
    );
}


// -----------------------------------------------------------------------------
// Soulbound / non-transferable invariant
// -----------------------------------------------------------------------------

fn mint_clean_payer_certificate()
    -> (ContractAddress, felt252)
{
    let (
        rekber_address,
        certificate_address,
        token_address,
    ) = deploy_contracts();

    fund(
        rekber_address,
        token_address,
    );
    consume_fee(
        rekber_address,
        token_address,
    );
    submit_fulfillment(
        rekber_address,
    );
    release_clean(
        rekber_address,
    );

    let certificate =
        IVinssSettlementCertificateDispatcher {
            contract_address:
                certificate_address,
        };

    start_cheat_caller_address(
        certificate_address,
        payer(),
    );

    let token_id =
        certificate.claim(
            CUSTODY,
            1,
            PAYER_CERT_SECRET,
        );

    stop_cheat_caller_address(
        certificate_address,
    );

    (
        certificate_address,
        token_id,
    )
}

#[test]
#[should_panic(expected: 'CERT_NON_TRANSFERABLE')]
fn settlement_certificate_transfer_is_blocked() {
    let (
        certificate_address,
        token_id,
    ) = mint_clean_payer_certificate();

    let erc721 = IERC721Dispatcher {
        contract_address:
            certificate_address,
    };

    start_cheat_caller_address(
        certificate_address,
        payer(),
    );

    erc721.transfer_from(
        payer(),
        payee(),
        token_id.into(),
    );
}

#[test]
#[should_panic(expected: 'CERT_NON_TRANSFERABLE')]
fn settlement_certificate_safe_transfer_is_blocked() {
    let (
        certificate_address,
        token_id,
    ) = mint_clean_payer_certificate();

    let erc721 = IERC721Dispatcher {
        contract_address:
            certificate_address,
    };

    start_cheat_caller_address(
        certificate_address,
        payer(),
    );

    erc721.safe_transfer_from(
        payer(),
        payee(),
        token_id.into(),
        array![].span(),
    );
}
