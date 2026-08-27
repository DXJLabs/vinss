// VINSS Rekber tests.
//
// These tests focus on money invariants and the "nakal / mangkir" business
// rules, not merely happy-path UI behavior.

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
    compute_fulfillment_chain_step,
    compute_payee_claim_commitment,
    compute_payee_dispute_commitment,
    compute_payee_refund_consent_commitment,
    compute_payer_confirmation_commitment,
    compute_payer_dispute_commitment,
    compute_refund_commitment,
    compute_release_authorization_commitment,
    compute_revision_chain_step,
};
use crate::escrow_rekber::interfaces::{
    IVinssEscrowRekberDispatcher,
    IVinssEscrowRekberDispatcherTrait,
};
use crate::escrow_rekber::types::{
    POLICY_COUNTERPARTY_CONFIRM,
    POLICY_SUBMISSION_REVIEW,
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
const OTHER_CALLER: felt252 = 0x999;

const CUSTODY: felt252 = 0x2101;
const RELEASE_AUTH_SECRET: felt252 = 0xa11ce;
const PAYEE_CLAIM_SECRET: felt252 = 0xb0b;
const REFUND_SECRET: felt252 = 0xcafe;
const PAYER_CONFIRM_SECRET: felt252 = 0xd001;
const PAYER_DISPUTE_SECRET: felt252 = 0xd002;
const PAYEE_DISPUTE_SECRET: felt252 = 0xd003;
const PAYEE_REFUND_CONSENT_SECRET: felt252 = 0xd004;

const FULFILLMENT_TAIL_SECRET: felt252 = 0xf002;
const REVISION_SECRET: felt252 = 0xe001;

const PAYER_CERT_COMMITMENT: felt252 = 0xc311;
const PAYEE_CERT_COMMITMENT: felt252 = 0xc322;

const REVENUE_NOTE: felt252 = 0x444;
const OUTPUT_NOTE: felt252 = 0x555;

const DEPOSIT_TIME: u64 = 1000;
const FULFILLMENT_DEADLINE: u64 = 2000;
const REVIEW_WINDOW: u64 = 300;
const ORACLE_MAX_AGE: u64 = 300;
const ORACLE_SOURCES: u32 = 2;

const STRK_USD_PAIR: felt252 = 'STRK/USD';
const USDC_USD_PAIR: felt252 = 'USDC/USD';
const ORACLE_DECIMALS: u32 = 8;
const ONE_USD: u128 = 100_000_000_u128;

// $1 test-only floor. Production value is a constructor parameter.
const MINIMUM_FEE_USD_MICROS: u128 = 1_000_000_u128;

// 100 STRK => percentage fee = 2 STRK, which is above the $1 test floor.
const PRINCIPAL: u128 =
    100_000000000000000000_u128;
const PERCENTAGE_FEE: u128 =
    2_000000000000000000_u128;

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

fn resolver() -> ContractAddress {
    RESOLVER.try_into().unwrap()
}

fn external_verifier() -> ContractAddress {
    EXTERNAL_VERIFIER.try_into().unwrap()
}

fn other_caller() -> ContractAddress {
    OTHER_CALLER.try_into().unwrap()
}

fn fulfillment_first_secret() -> felt252 {
    // Two-reveal chain:
    // H(first) = head
    // H(second/tail) = first
    compute_fulfillment_chain_step(
        CUSTODY,
        FULFILLMENT_TAIL_SECRET,
    )
}

fn fulfillment_chain_head() -> felt252 {
    compute_fulfillment_chain_step(
        CUSTODY,
        fulfillment_first_secret(),
    )
}

fn revision_chain_head() -> felt252 {
    compute_revision_chain_step(
        CUSTODY,
        REVISION_SECRET,
    )
}

fn deploy_contracts() -> (
    ContractAddress,
    ContractAddress,
    ContractAddress,
    ContractAddress,
) {
    let token_class =
        declare("MockClaimERC20")
            .unwrap()
            .contract_class();

    let (strk, _) =
        token_class.deploy(@array![])
            .unwrap();

    let (usdc, _) =
        token_class.deploy(@array![])
            .unwrap();

    let oracle_class =
        declare("MockPragma")
            .unwrap()
            .contract_class();

    let (oracle_address, _) =
        oracle_class.deploy(@array![])
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
                    PERCENTAGE_FEE.into(),
                    MINIMUM_FEE_USD_MICROS.into(),
                ],
            )
            .unwrap();

    let rekber_class =
        declare("VinssEscrowRekber")
            .unwrap()
            .contract_class();

    let constructor = array![
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
            .deploy(@constructor)
            .unwrap();

    (
        rekber,
        strk,
        usdc,
        oracle_address,
    )
}

fn deposit_calldata(
    token: ContractAddress,
    policy: u8,
    fulfillment_rounds: u8,
    revision_rounds: u8,
    fee: u128,
) -> Array<felt252> {
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
        fulfillment_chain_head(),
        if revision_rounds == 0 {
            0
        } else {
            revision_chain_head()
        },
        PAYER_CERT_COMMITMENT,
        PAYEE_CERT_COMMITMENT,
        FULFILLMENT_DEADLINE.into(),
        REVIEW_WINDOW.into(),
        policy.into(),
        fulfillment_rounds.into(),
        revision_rounds.into(),
        token.into(),
        PRINCIPAL.into(),
        fee.into(),
        REVENUE_NOTE,
    ]
}

fn fund(
    rekber_address: ContractAddress,
    token_address: ContractAddress,
    policy: u8,
    fulfillment_rounds: u8,
    revision_rounds: u8,
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
        (PRINCIPAL +
            PERCENTAGE_FEE)
            .into(),
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        deposit_calldata(
            token_address,
            policy,
            fulfillment_rounds,
            revision_rounds,
            PERCENTAGE_FEE,
        )
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

    let ok =
        token.transfer_from(
            rekber_address,
            privacy_pool(),
            PERCENTAGE_FEE.into(),
        );

    assert(ok, 'fee pull failed');

    stop_cheat_caller_address(
        token_address,
    );
}

fn submit_first(
    rekber_address: ContractAddress,
    evidence: felt252,
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
            4,
            CUSTODY,
            fulfillment_first_secret(),
            evidence,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );
}

#[test]
fn oracle_fee_uses_two_percent_when_larger() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME,
    );

    assert(
        rekber.quote_rekber_fee(
            strk,
            PRINCIPAL,
        ) == PERCENTAGE_FEE,
        'percentage fee mismatch',
    );
}

#[test]
fn oracle_fee_uses_usd_floor_for_small_strk_deal() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME,
    );

    let ten_strk: u128 =
        10_000000000000000000_u128;

    let one_strk: u128 =
        1_000000000000000000_u128;

    assert(
        rekber.quote_rekber_fee(
            strk,
            ten_strk,
        ) == one_strk,
        'USD floor mismatch',
    );
}

#[test]
#[should_panic(expected: 'ORACLE_PRICE_STALE')]
fn stale_oracle_price_is_fail_closed() {
    let (
        rekber_address,
        strk,
        _,
        oracle_address,
    ) = deploy_contracts();

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    let oracle =
        IMockPragmaDispatcher {
            contract_address:
                oracle_address,
        };

    oracle.set_price(
        STRK_USD_PAIR,
        ONE_USD,
        ORACLE_DECIMALS,
        DEPOSIT_TIME -
            ORACLE_MAX_AGE -
            1,
        ORACLE_SOURCES,
        0,
    );

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME,
    );

    rekber.quote_rekber_fee(
        strk,
        PRINCIPAL,
    );
}

#[test]
fn no_fulfillment_timeout_refunds_full_principal() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    consume_fee(
        rekber_address,
        strk,
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

    let outputs =
        rekber.privacy_invoke(
            array![
                3,
                CUSTODY,
                REFUND_SECRET,
                OUTPUT_NOTE,
            ]
                .span(),
        );

    assert(
        outputs.len() == 1,
        'refund output missing',
    );
    assert(
        (*outputs.at(0)).amount ==
            PRINCIPAL,
        'principal changed',
    );

    let custody =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        custody.consumed &&
            custody.refunded,
        'refund state mismatch',
    );
    assert(
        rekber.get_reserved_amount(
            strk,
        ) == 0,
        'reserve remains',
    );
}

#[test]
#[should_panic(expected: 'REFUND_BLOCKED_FULFILL')]
fn fulfillment_blocks_unilateral_payer_refund() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    submit_first(
        rekber_address,
        0xabc,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        FULFILLMENT_DEADLINE +
            REVIEW_WINDOW,
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
}

#[test]
fn payer_silence_after_review_allows_payee_auto_release() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    consume_fee(
        rekber_address,
        strk,
    );

    let submit_time =
        DEPOSIT_TIME + 10;

    start_cheat_block_timestamp(
        rekber_address,
        submit_time,
    );
    submit_first(
        rekber_address,
        0xabc,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    let custody =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        custody.fulfillment_confirmed,
        'review did not start',
    );
    assert(
        custody.review_deadline ==
            submit_time +
                REVIEW_WINDOW,
        'review deadline mismatch',
    );

    start_cheat_block_timestamp(
        rekber_address,
        custody.review_deadline,
    );
    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    let outputs =
        rekber.privacy_invoke(
            array![
                8,
                CUSTODY,
                PAYEE_CLAIM_SECRET,
                OUTPUT_NOTE,
            ]
                .span(),
        );

    assert(
        (*outputs.at(0)).amount ==
            PRINCIPAL,
        'auto release changed principal',
    );
}

#[test]
fn physical_policy_requires_payer_receipt_confirmation() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_COUNTERPARTY_CONFIRM,
        1,
        0,
    );

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME + 10,
    );
    submit_first(
        rekber_address,
        0xface,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address:
                rekber_address,
        };

    let before =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        before.fulfillment_submitted,
        'submission missing',
    );
    assert(
        !before.fulfillment_confirmed,
        'seller started inspection alone',
    );
    assert(
        before.review_deadline == 0,
        'review started too early',
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            5,
            CUSTODY,
            PAYER_CONFIRM_SECRET,
            0xface,
        ]
            .span(),
    );

    let after =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        after.fulfillment_confirmed,
        'payer confirmation missing',
    );
    assert(
        after.review_deadline != 0,
        'review not started',
    );
}

#[test]
fn bounded_revision_then_resubmission_gets_fresh_review_window() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME + 10,
    );
    submit_first(
        rekber_address,
        0xaaa,
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
            7,
            CUSTODY,
            REVISION_SECRET,
            0xbeef,
        ]
            .span(),
    );

    let revision =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        revision.revision_pending,
        'revision not pending',
    );
    assert(
        !revision.fulfillment_confirmed,
        'old review remained active',
    );

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME + 20,
    );

    rekber.privacy_invoke(
        array![
            4,
            CUSTODY,
            FULFILLMENT_TAIL_SECRET,
            0xbbb,
        ]
            .span(),
    );

    let resubmitted =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        !resubmitted.revision_pending &&
            resubmitted.fulfillment_confirmed,
        'resubmission not active',
    );
    assert(
        resubmitted
            .fulfillment_evidence_commitment ==
            0xbbb,
        'new evidence not bound',
    );
}

#[test]
fn mutual_refund_after_fulfillment_requires_both_parties() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    consume_fee(
        rekber_address,
        strk,
    );
    submit_first(
        rekber_address,
        0xabc,
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

    let outputs =
        rekber.privacy_invoke(
            array![
                9,
                CUSTODY,
                REFUND_SECRET,
                PAYEE_REFUND_CONSENT_SECRET,
                OUTPUT_NOTE,
            ]
                .span(),
        );

    assert(
        (*outputs.at(0)).amount ==
            PRINCIPAL,
        'mutual refund changed principal',
    );

    let custody =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        custody.refunded &&
            custody.consumed,
        'mutual refund not final',
    );
}

#[test]
fn dispute_resolution_split_can_only_be_claimed_by_bound_party_secrets() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    consume_fee(
        rekber_address,
        strk,
    );
    submit_first(
        rekber_address,
        0xabc,
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
            1,
            PAYER_DISPUTE_SECRET,
            0xdddd,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );

    let payer_amount =
        40_000000000000000000_u128;
    let payee_amount =
        60_000000000000000000_u128;

    start_cheat_caller_address(
        rekber_address,
        resolver(),
    );

    rekber.authorize_dispute_resolution(
        CUSTODY,
        0xfeed,
        payer_amount,
        payee_amount,
    );

    stop_cheat_caller_address(
        rekber_address,
    );

    // Payer claims only the resolver-authorized payer portion.
    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    let payer_output =
        rekber.privacy_invoke(
            array![
                10,
                CUSTODY,
                1,
                REFUND_SECRET,
                OUTPUT_NOTE,
            ]
                .span(),
        );

    assert(
        (*payer_output.at(0)).amount ==
            payer_amount,
        'payer split mismatch',
    );

    // Simulate Privacy Pool pulling that exact approved output before the next
    // claim, just like a real STRK20 transaction.
    let token =
        IMockClaimERC20Dispatcher {
            contract_address: strk,
        };

    start_cheat_caller_address(
        strk,
        privacy_pool(),
    );
    token.transfer_from(
        rekber_address,
        privacy_pool(),
        payer_amount.into(),
    );
    stop_cheat_caller_address(strk);

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    let payee_output =
        rekber.privacy_invoke(
            array![
                10,
                CUSTODY,
                2,
                PAYEE_CLAIM_SECRET,
                OUTPUT_NOTE + 1,
            ]
                .span(),
        );

    assert(
        (*payee_output.at(0)).amount ==
            payee_amount,
        'payee split mismatch',
    );

    let custody =
        rekber.get_custody(
            CUSTODY,
        );

    assert(
        custody.consumed &&
            custody.disputed,
        'dispute not finalized',
    );
    assert(
        rekber.get_reserved_amount(
            strk,
        ) == 0,
        'split reserve remains',
    );
}

#[test]
#[should_panic(expected: 'NOT_DISPUTE_RESOLVER')]
fn arbitrary_wallet_cannot_authorize_dispute_split() {
    let (
        rekber_address,
        strk,
        _,
        _,
    ) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    submit_first(
        rekber_address,
        0xabc,
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
            1,
            PAYER_DISPUTE_SECRET,
            0xdddd,
        ]
            .span(),
    );

    stop_cheat_caller_address(
        rekber_address,
    );

    start_cheat_caller_address(
        rekber_address,
        other_caller(),
    );

    rekber.authorize_dispute_resolution(
        CUSTODY,
        0xfeed,
        PRINCIPAL,
        0,
    );
}


// MAINNET-GUARD-REGRESSION-TESTS

#[test]
#[should_panic(expected: 'REVIEW_WINDOW_CLOSED')]
fn late_dispute_after_review_deadline_is_rejected() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );

    let submit_time = DEPOSIT_TIME + 10;
    start_cheat_block_timestamp(rekber_address, submit_time);
    submit_first(rekber_address, 0xabc);

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
        };

    let custody = rekber.get_custody(CUSTODY);

    start_cheat_block_timestamp(
        rekber_address,
        custody.review_deadline,
    );
    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            6,
            CUSTODY,
            1,
            PAYER_DISPUTE_SECRET,
            0xdead,
        ]
            .span(),
    );
}

#[test]
#[should_panic(expected: 'REFUND_TOO_EARLY')]
fn refund_before_fulfillment_deadline_is_rejected() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        1,
        0,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        FULFILLMENT_DEADLINE - 1,
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
}

#[test]
#[should_panic(expected: 'BAD_REFUND_SECRET')]
fn wrong_refund_secret_is_rejected() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        1,
        0,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
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
            REFUND_SECRET + 1,
            OUTPUT_NOTE,
        ]
            .span(),
    );
}

#[test]
#[should_panic(expected: 'BAD_REFUND_CONSENT')]
fn mutual_refund_rejects_wrong_payee_consent() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    submit_first(rekber_address, 0xabc);

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
        };

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        array![
            9,
            CUSTODY,
            REFUND_SECRET,
            PAYEE_REFUND_CONSENT_SECRET + 1,
            OUTPUT_NOTE,
        ]
            .span(),
    );
}

#[test]
#[should_panic(expected: 'RESOLUTION_ALREADY_SET')]
fn resolver_authorized_split_cannot_be_overridden_by_release() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        2,
        1,
    );
    submit_first(rekber_address, 0xabc);

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
        };

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );
    rekber.privacy_invoke(
        array![
            6,
            CUSTODY,
            1,
            PAYER_DISPUTE_SECRET,
            0xdddd,
        ]
            .span(),
    );
    stop_cheat_caller_address(rekber_address);

    start_cheat_caller_address(
        rekber_address,
        resolver(),
    );
    rekber.authorize_dispute_resolution(
        CUSTODY,
        0xfeed,
        40_000000000000000000_u128,
        60_000000000000000000_u128,
    );
    stop_cheat_caller_address(rekber_address);

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
}

#[test]
#[should_panic(expected: 'NOT_PRIVACY_POOL')]
fn non_privacy_pool_caller_is_rejected() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        1,
        0,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
        };

    start_cheat_caller_address(
        rekber_address,
        other_caller(),
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
}


// MAINNET-RESTORED-MONEY-INVARIANT-TESTS

#[test]
#[should_panic(expected: 'CUSTODY_ALREADY_EXISTS')]
fn duplicate_custody_is_rejected_mainnet() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        1,
        0,
    );

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        1,
        0,
    );
}

#[test]
#[should_panic(expected: 'FUNDS_NOT_RECEIVED')]
fn deposit_requires_principal_plus_fee_mainnet() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    let token =
        IMockClaimERC20Dispatcher {
            contract_address: strk,
        };
    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME,
    );

    token.mint(
        rekber_address,
        PRINCIPAL.into(),
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        deposit_calldata(
            strk,
            POLICY_SUBMISSION_REVIEW,
            1,
            0,
            PERCENTAGE_FEE,
        )
            .span(),
    );
}

#[test]
#[should_panic(expected: 'CUSTODY_ALREADY_CONSUMED')]
fn released_custody_cannot_be_replayed_as_refund_mainnet() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    fund(
        rekber_address,
        strk,
        POLICY_SUBMISSION_REVIEW,
        1,
        0,
    );
    consume_fee(
        rekber_address,
        strk,
    );
    submit_first(
        rekber_address,
        0xabc,
    );

    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
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

    rekber.privacy_invoke(
        array![
            3,
            CUSTODY,
            REFUND_SECRET,
            OUTPUT_NOTE + 1,
        ]
            .span(),
    );
}

#[test]
#[should_panic(expected: 'REKBER_FEE_CHANGED')]
fn stale_or_wrong_fee_quote_is_rejected_mainnet() {
    let (rekber_address, strk, _, _) = deploy_contracts();

    let token =
        IMockClaimERC20Dispatcher {
            contract_address: strk,
        };
    let rekber =
        IVinssEscrowRekberDispatcher {
            contract_address: rekber_address,
        };

    start_cheat_block_timestamp(
        rekber_address,
        DEPOSIT_TIME,
    );

    token.mint(
        rekber_address,
        (PRINCIPAL + PERCENTAGE_FEE + 1_u128).into(),
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    rekber.privacy_invoke(
        deposit_calldata(
            strk,
            POLICY_SUBMISSION_REVIEW,
            1,
            0,
            PERCENTAGE_FEE + 1_u128,
        )
            .span(),
    );
}
