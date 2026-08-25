// Settlement Certificate tests.
//
// A certificate is optional public evidence. It can only be claimed after a
// successful release, never after refund, and each address-bound party claim
// can be consumed once. Each wallet must claim its own public ERC-721; a
// counterparty cannot mint the other party's acknowledgement. Private
// Offer/chat fields never enter this contract.

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

use crate::escrow_rekber::commitments::{
    compute_payee_claim_commitment,
    compute_refund_commitment,
    compute_release_authorization_commitment,
};
use crate::escrow_rekber::interfaces::{
    IVinssEscrowRekberDispatcher,
    IVinssEscrowRekberDispatcherTrait,
};
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

const PRIVACY_POOL: felt252 = 0x123;
const CUSTODY: felt252 = 0x3101;
const RELEASE_AUTH_SECRET: felt252 = 0x711;
const PAYEE_CLAIM_SECRET: felt252 = 0x722;
const REFUND_SECRET: felt252 = 0x733;
const PAYER_CERT_SECRET: felt252 = 0x744;
const PAYEE_CERT_SECRET: felt252 = 0x755;
const PAYER: felt252 = 0x901;
const PAYEE: felt252 = 0x902;
const REVENUE_NOTE: felt252 = 0x811;
const OUTPUT_NOTE: felt252 = 0x822;
const DEPOSIT_TIME: u64 = 1000;
const RELEASE_TIME: u64 = 1500;
const REFUND_AFTER: u64 = 2000;
const PRINCIPAL: u128 = 10000_u128;
const FEE: u128 = 200_u128;

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

fn payer() -> ContractAddress {
    PAYER.try_into().unwrap()
}

fn payee() -> ContractAddress {
    PAYEE.try_into().unwrap()
}

fn deploy_contracts() -> (ContractAddress, ContractAddress, ContractAddress) {
    let token_class = declare("MockClaimERC20")
        .unwrap()
        .contract_class();
    let (token_address, _) = token_class.deploy(@array![]).unwrap();

    let rekber_class = declare("VinssEscrowRekber")
        .unwrap()
        .contract_class();
    let (rekber_address, _) = rekber_class
        .deploy(@array![PRIVACY_POOL])
        .unwrap();

    let certificate_class = declare("VinssSettlementCertificate")
        .unwrap()
        .contract_class();
    let mut constructor_calldata = array![
        rekber_address.into(),
    ];
    let base_uri: ByteArray =
        "https://vinss-nu.vercel.app/api/certificates/";
    base_uri.serialize(ref constructor_calldata);
    let (certificate_address, _) = certificate_class
        .deploy(@constructor_calldata)
        .unwrap();

    (rekber_address, certificate_address, token_address)
}

fn fund_custody(
    rekber: @IVinssEscrowRekberDispatcher,
    token: @IMockClaimERC20Dispatcher,
    rekber_address: ContractAddress,
    token_address: ContractAddress,
) {
    start_cheat_block_timestamp(rekber_address, DEPOSIT_TIME);
    token.mint(rekber_address, (PRINCIPAL + FEE).into());
    start_cheat_caller_address(rekber_address, privacy_pool());

    let calldata = array![
        1,
        CUSTODY,
        compute_release_authorization_commitment(
            CUSTODY,
            RELEASE_AUTH_SECRET,
        ),
        compute_payee_claim_commitment(CUSTODY, PAYEE_CLAIM_SECRET),
        compute_refund_commitment(CUSTODY, REFUND_SECRET),
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
        REFUND_AFTER.into(),
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE,
    ];
    rekber.privacy_invoke(calldata.span());
}

fn consume_fee_allowance(
    token: @IMockClaimERC20Dispatcher,
    token_address: ContractAddress,
    rekber_address: ContractAddress,
) {
    start_cheat_caller_address(token_address, privacy_pool());
    token.transfer_from(
        rekber_address,
        privacy_pool(),
        FEE.into(),
    );
    stop_cheat_caller_address(token_address);
}

fn release_custody(
    rekber: @IVinssEscrowRekberDispatcher,
    rekber_address: ContractAddress,
) {
    start_cheat_block_timestamp(rekber_address, RELEASE_TIME);
    let release = array![
        2,
        CUSTODY,
        RELEASE_AUTH_SECRET,
        PAYEE_CLAIM_SECRET,
        OUTPUT_NOTE,
    ];
    rekber.privacy_invoke(release.span());
}

fn claim_payer_certificate(
    certificate: @IVinssSettlementCertificateDispatcher,
    certificate_address: ContractAddress,
) {
    start_cheat_caller_address(certificate_address, payer());
    certificate.claim(
        CUSTODY,
        1,
        PAYER_CERT_SECRET,
    );
}

#[test]
fn released_settlement_allows_one_certificate_per_party() {
    let (rekber_address, certificate_address, token_address) =
        deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher {
        contract_address: rekber_address,
    };
    let certificate = IVinssSettlementCertificateDispatcher {
        contract_address: certificate_address,
    };

    fund_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);
    release_custody(@rekber, rekber_address);

    start_cheat_block_timestamp(certificate_address, RELEASE_TIME + 10);
    claim_payer_certificate(@certificate, certificate_address);

    let payer_token_id = compute_certificate_token_id(CUSTODY, 1);
    let payer_record = certificate.get_certificate(payer_token_id);
    assert(payer_record.recipient == payer(), 'bad payer owner');
    assert(payer_record.role == 1, 'bad payer role');
    assert(payer_record.settled_at == RELEASE_TIME, 'bad settle proof');
    assert(certificate.is_claimed(CUSTODY, 1), 'payer not claimed');

    start_cheat_caller_address(certificate_address, payee());
    certificate.claim(
        CUSTODY,
        2,
        PAYEE_CERT_SECRET,
    );

    let payee_token_id = compute_certificate_token_id(CUSTODY, 2);
    let payee_record = certificate.get_certificate(payee_token_id);
    assert(payee_record.recipient == payee(), 'bad payee owner');
    assert(payee_record.role == 2, 'bad payee role');
    assert(payer_token_id != payee_token_id, 'duplicate token id');
}

#[test]
#[should_panic(expected: 'REKBER_NOT_RELEASED')]
fn certificate_cannot_be_claimed_before_settlement() {
    let (rekber_address, certificate_address, token_address) =
        deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher {
        contract_address: rekber_address,
    };
    let certificate = IVinssSettlementCertificateDispatcher {
        contract_address: certificate_address,
    };

    fund_custody(@rekber, @token, rekber_address, token_address);
    claim_payer_certificate(@certificate, certificate_address);
}

#[test]
#[should_panic(expected: 'REKBER_WAS_REFUNDED')]
fn refunded_rekber_cannot_mint_success_certificate() {
    let (rekber_address, certificate_address, token_address) =
        deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher {
        contract_address: rekber_address,
    };
    let certificate = IVinssSettlementCertificateDispatcher {
        contract_address: certificate_address,
    };

    fund_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER);
    let refund = array![3, CUSTODY, REFUND_SECRET, OUTPUT_NOTE];
    rekber.privacy_invoke(refund.span());

    claim_payer_certificate(@certificate, certificate_address);
}

#[test]
#[should_panic(expected: 'BAD_CERT_CLAIM')]
fn certificate_claim_is_bound_to_the_calling_wallet() {
    let (rekber_address, certificate_address, token_address) =
        deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher {
        contract_address: rekber_address,
    };
    let certificate = IVinssSettlementCertificateDispatcher {
        contract_address: certificate_address,
    };

    fund_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);
    release_custody(@rekber, rekber_address);

    start_cheat_caller_address(certificate_address, payee());
    certificate.claim(
        CUSTODY,
        1,
        PAYER_CERT_SECRET,
    );
}

#[test]
#[should_panic(expected: 'CERT_ALREADY_CLAIMED')]
fn certificate_claim_cannot_be_replayed() {
    let (rekber_address, certificate_address, token_address) =
        deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher {
        contract_address: rekber_address,
    };
    let certificate = IVinssSettlementCertificateDispatcher {
        contract_address: certificate_address,
    };

    fund_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);
    release_custody(@rekber, rekber_address);

    claim_payer_certificate(@certificate, certificate_address);
    claim_payer_certificate(@certificate, certificate_address);
}
