// Rekber V2 settlement tests.
//
// V2 removes unilateral release: payment can leave custody only when the
// payer release authorization and the payee claim preimage are both valid.
// Timeout refund remains a separate payer recovery path.

use snforge_std::{
    ContractClassTrait,
    DeclareResultTrait,
    declare,
    start_cheat_block_timestamp,
    start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

use crate::escrow_rekber_v2::commitments::{
    compute_payee_claim_commitment,
    compute_refund_commitment,
    compute_release_authorization_commitment,
};
use crate::escrow_rekber_v2::interfaces::{
    IVinssEscrowRekberV2Dispatcher,
    IVinssEscrowRekberV2DispatcherTrait,
};
use crate::settlement_certificate::commitments::compute_certificate_claim_commitment;
use crate::test_mocks::mock_erc20::{
    IMockClaimERC20Dispatcher,
    IMockClaimERC20DispatcherTrait,
};

const PRIVACY_POOL: felt252 = 0x123;
const CUSTODY: felt252 = 0x2101;
const RELEASE_AUTH_SECRET: felt252 = 0xa11ce;
const PAYEE_CLAIM_SECRET: felt252 = 0xb0b;
const REFUND_SECRET: felt252 = 0xcafe;
const PAYER_CERT_SECRET: felt252 = 0xc311;
const PAYEE_CERT_SECRET: felt252 = 0xc322;
const PAYER: felt252 = 0x901;
const PAYEE: felt252 = 0x902;
const REVENUE_NOTE: felt252 = 0x444;
const OUTPUT_NOTE: felt252 = 0x555;
const DEPOSIT_TIME: u64 = 1000;
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

fn deploy_contracts() -> (ContractAddress, ContractAddress) {
    let token_class = declare("MockClaimERC20")
        .unwrap()
        .contract_class();
    let (token_address, _) = token_class.deploy(@array![]).unwrap();

    let rekber_class = declare("VinssEscrowRekberV2")
        .unwrap()
        .contract_class();
    let (rekber_address, _) = rekber_class
        .deploy(@array![PRIVACY_POOL])
        .unwrap();

    (rekber_address, token_address)
}

fn fund_default_custody(
    rekber: @IVinssEscrowRekberV2Dispatcher,
    token: @IMockClaimERC20Dispatcher,
    rekber_address: ContractAddress,
    token_address: ContractAddress,
) {
    start_cheat_block_timestamp(rekber_address, DEPOSIT_TIME);
    token.mint(rekber_address, (PRINCIPAL + FEE).into());
    start_cheat_caller_address(rekber_address, privacy_pool());

    let release_authorization_commitment =
        compute_release_authorization_commitment(
            CUSTODY,
            RELEASE_AUTH_SECRET,
        );
    let payee_claim_commitment =
        compute_payee_claim_commitment(CUSTODY, PAYEE_CLAIM_SECRET);
    let refund_commitment =
        compute_refund_commitment(CUSTODY, REFUND_SECRET);
    let payer_certificate_commitment =
        compute_certificate_claim_commitment(
            CUSTODY,
            1,
            payer(),
            PAYER_CERT_SECRET,
        );
    let payee_certificate_commitment =
        compute_certificate_claim_commitment(
            CUSTODY,
            2,
            payee(),
            PAYEE_CERT_SECRET,
        );

    let calldata = array![
        1,
        CUSTODY,
        release_authorization_commitment,
        payee_claim_commitment,
        refund_commitment,
        payer_certificate_commitment,
        payee_certificate_commitment,
        REFUND_AFTER.into(),
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE,
    ];

    let deposits = rekber.privacy_invoke(calldata.span());
    assert(deposits.len() == 1, 'missing fee output');
}

fn consume_fee_allowance(
    token: @IMockClaimERC20Dispatcher,
    token_address: ContractAddress,
    rekber_address: ContractAddress,
) {
    start_cheat_caller_address(token_address, privacy_pool());
    let ok = token.transfer_from(
        rekber_address,
        privacy_pool(),
        FEE.into(),
    );
    assert(ok, 'fee pull failed');
    stop_cheat_caller_address(token_address);
}

#[test]
fn deposit_records_both_release_authorities_and_full_principal() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberV2Dispatcher {
        contract_address: rekber_address,
    };

    fund_default_custody(@rekber, @token, rekber_address, token_address);

    let custody = rekber.get_custody(CUSTODY);
    assert(custody.amount == PRINCIPAL, 'principal changed');
    assert(!custody.consumed, 'consumed early');
    assert(!custody.refunded, 'refunded early');
    assert(
        custody.release_authorization_commitment ==
            compute_release_authorization_commitment(
                CUSTODY,
                RELEASE_AUTH_SECRET,
            ),
        'bad release authority',
    );
    assert(
        custody.payee_claim_commitment ==
            compute_payee_claim_commitment(CUSTODY, PAYEE_CLAIM_SECRET),
        'bad payee claim',
    );
    assert(
        rekber.get_reserved_amount(token_address) == PRINCIPAL,
        'bad reserve',
    );
}

#[test]
fn release_requires_both_keys_and_returns_full_principal() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberV2Dispatcher {
        contract_address: rekber_address,
    };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);

    let calldata = array![
        2,
        CUSTODY,
        RELEASE_AUTH_SECRET,
        PAYEE_CLAIM_SECRET,
        OUTPUT_NOTE,
    ];
    let deposits = rekber.privacy_invoke(calldata.span());

    assert(deposits.len() == 1, 'missing settlement');
    let output = *deposits.at(0);
    assert(output.note_id == OUTPUT_NOTE, 'bad output note');
    assert(output.token == token_address, 'bad output token');
    assert(output.amount == PRINCIPAL, 'bad output amount');

    let custody = rekber.get_custody(CUSTODY);
    assert(custody.consumed, 'not consumed');
    assert(!custody.refunded, 'wrong outcome');
    assert(custody.settled_at == REFUND_AFTER - 1, 'bad timestamp');
}

#[test]
#[should_panic(expected: 'BAD_RELEASE_AUTH')]
fn payee_key_cannot_replace_payer_authorization() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberV2Dispatcher {
        contract_address: rekber_address,
    };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);

    let calldata = array![
        2,
        CUSTODY,
        PAYEE_CLAIM_SECRET,
        PAYEE_CLAIM_SECRET,
        OUTPUT_NOTE,
    ];
    rekber.privacy_invoke(calldata.span());
}

#[test]
#[should_panic(expected: 'BAD_PAYEE_CLAIM')]
fn payer_authorization_cannot_replace_payee_claim() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberV2Dispatcher {
        contract_address: rekber_address,
    };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);

    let calldata = array![
        2,
        CUSTODY,
        RELEASE_AUTH_SECRET,
        RELEASE_AUTH_SECRET,
        OUTPUT_NOTE,
    ];
    rekber.privacy_invoke(calldata.span());
}

#[test]
fn timeout_refund_returns_principal_to_a_private_output() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberV2Dispatcher {
        contract_address: rekber_address,
    };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER);

    let calldata = array![3, CUSTODY, REFUND_SECRET, OUTPUT_NOTE];
    let deposits = rekber.privacy_invoke(calldata.span());

    assert(deposits.len() == 1, 'missing refund');
    assert((*deposits.at(0)).amount == PRINCIPAL, 'refund changed');
    let custody = rekber.get_custody(CUSTODY);
    assert(custody.consumed, 'refund not consumed');
    assert(custody.refunded, 'refund flag missing');
}

#[test]
#[should_panic(expected: 'REFUND_TOO_EARLY')]
fn refund_before_timeout_is_rejected() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberV2Dispatcher {
        contract_address: rekber_address,
    };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);

    let calldata = array![3, CUSTODY, REFUND_SECRET, OUTPUT_NOTE];
    rekber.privacy_invoke(calldata.span());
}

#[test]
#[should_panic(expected: 'CUSTODY_ALREADY_CONSUMED')]
fn released_custody_cannot_be_replayed_as_refund() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberV2Dispatcher {
        contract_address: rekber_address,
    };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);
    let release = array![
        2,
        CUSTODY,
        RELEASE_AUTH_SECRET,
        PAYEE_CLAIM_SECRET,
        OUTPUT_NOTE,
    ];
    rekber.privacy_invoke(release.span());

    start_cheat_block_timestamp(rekber_address, REFUND_AFTER);
    let refund = array![3, CUSTODY, REFUND_SECRET, OUTPUT_NOTE + 1];
    rekber.privacy_invoke(refund.span());
}
