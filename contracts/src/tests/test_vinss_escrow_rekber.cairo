// Escrow Rekber contract test scenarios.
//
// Scope:
// - validate Rekber custody and settlement invariants;
// - keep Offer-specific terms out of this contract test because those remain
//   encrypted in Offer / Private Escrow coordination;
// - mirror the actual Cairo release/refund commitment formulas;
// - model the Privacy Pool as the only authorized caller.
//
// Core lifecycle under test:
// deposit -> release
// deposit -> refund
//
// Failure paths also verify time boundaries, secret mismatch, replay,
// duplicate custody, funding, and caller authorization.

use snforge_std::{
    ContractClassTrait,
    DeclareResultTrait,
    declare,
    start_cheat_block_timestamp,
    start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;

use crate::test_mocks::mock_erc20::{
    IMockClaimERC20Dispatcher,
    IMockClaimERC20DispatcherTrait,
};
use crate::escrow_rekber::escrow_rekber_commitments::{
    compute_private_escrow_refund_commitment,
    compute_private_escrow_release_commitment,
};
use crate::escrow_rekber::escrow_rekber_interfaces::{
    IVinssEscrowRekberDispatcher,
    IVinssEscrowRekberDispatcherTrait,
};

const PRIVACY_POOL: felt252 = 0x123;
const OTHER_CALLER: felt252 = 0x456;
const CUSTODY: felt252 = 0x111;
const RELEASE_SECRET: felt252 = 0xabc123;
const REFUND_SECRET: felt252 = 0xdef456;
const REVENUE_NOTE: felt252 = 0x444;
const OUTPUT_NOTE: felt252 = 0x555;
const DEPOSIT_TIME: u64 = 1000;
const REFUND_AFTER: u64 = 2000;
const PRINCIPAL: u128 = 10000_u128;
const FEE: u128 = 200_u128;

// Fixed configured Privacy Pool address used by the test contract.
fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

// Separate caller used to prove direct non-Pool calls are rejected.
fn other_caller() -> ContractAddress {
    OTHER_CALLER.try_into().unwrap()
}

// Deploy a fresh mock ERC-20 and Rekber instance for each scenario.
// Test isolation matters because custody, allowance and reserve state are mutable.
fn deploy_contracts() -> (ContractAddress, ContractAddress) {
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

    (rekber_address, token_address)
}

// Create one valid custody using the production commitment formulas.
//
// The wallet/Privacy Pool flow is represented by:
// 1. mint principal + 2% fee to Rekber;
// 2. invoke DEPOSIT as the configured Privacy Pool;
// 3. store domain-separated release/refund commitments.
fn fund_default_custody(
    rekber: @IVinssEscrowRekberDispatcher,
    token: @IMockClaimERC20Dispatcher,
    rekber_address: ContractAddress,
    token_address: ContractAddress,
) {
    start_cheat_block_timestamp(rekber_address, DEPOSIT_TIME);

    token.mint(
        rekber_address,
        (PRINCIPAL + FEE).into(),
    );

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    let release_commitment =
        compute_private_escrow_release_commitment(
            CUSTODY,
            RELEASE_SECRET,
        );
    let refund_commitment =
        compute_private_escrow_refund_commitment(
            CUSTODY,
            REFUND_SECRET,
        );

    let calldata = array![
        1,
        CUSTODY,
        release_commitment,
        refund_commitment,
        REFUND_AFTER.into(),
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE,
    ];

    rekber.privacy_invoke(calldata.span());
}

// Simulate the Privacy Pool consuming the fee OpenNoteDeposit.
//
// Deposit leaves an exact 2% token allowance for the Pool. Release/refund
// expects no stale allowance before approving the full principal output,
// so the test explicitly consumes the fee first.
fn consume_fee_allowance(
    token: @IMockClaimERC20Dispatcher,
    token_address: ContractAddress,
    rekber_address: ContractAddress,
) {
    start_cheat_caller_address(
        token_address,
        privacy_pool(),
    );

    let ok = token.transfer_from(
        rekber_address,
        privacy_pool(),
        FEE.into(),
    );
    assert(ok, 'fee pull failed');

    assert(
        token.allowance(
            rekber_address,
            privacy_pool(),
        ) == 0,
        'fee allowance remains',
    );

    // Important: this cheat targets the mock ERC-20 itself. If it remains
    // active, the later Rekber -> ERC-20 approve call is also seen as coming
    // from PRIVACY_POOL, so the mock writes allowance for the wrong owner and
    // Rekber correctly detects APPROVAL_NOT_EXACT.
    stop_cheat_caller_address(token_address);
}

// Happy path: deposit.
//
// Verifies that the VINSS 2% fee is returned separately while the custody
// still records and reserves the complete principal.
#[test]
fn deposit_keeps_full_principal_and_returns_two_percent_fee() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    start_cheat_block_timestamp(rekber_address, DEPOSIT_TIME);
    token.mint(rekber_address, (PRINCIPAL + FEE).into());
    start_cheat_caller_address(rekber_address, privacy_pool());

    let release_commitment =
        compute_private_escrow_release_commitment(CUSTODY, RELEASE_SECRET);
    let refund_commitment =
        compute_private_escrow_refund_commitment(CUSTODY, REFUND_SECRET);

    let calldata = array![
        1,
        CUSTODY,
        release_commitment,
        refund_commitment,
        REFUND_AFTER.into(),
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE,
    ];

    let deposits = rekber.privacy_invoke(calldata.span());
    assert(deposits.len() == 1, 'missing fee');

    let fee_output = *deposits.at(0);
    assert(fee_output.note_id == REVENUE_NOTE, 'bad fee note');
    assert(fee_output.token == token_address, 'bad fee token');
    assert(fee_output.amount == FEE, 'bad fee amount');

    let custody = rekber.get_custody(CUSTODY);
    assert(custody.amount == PRINCIPAL, 'principal reduced');
    assert(!custody.consumed, 'consumed early');
    assert(!custody.refunded, 'refunded early');
    assert(
        rekber.get_reserved_amount(token_address) == PRINCIPAL,
        'bad reserve',
    );
    assert(
        token.allowance(rekber_address, privacy_pool()) == FEE.into(),
        'bad fee allowance',
    );
}

// Happy path: release.
//
// A valid release secret before `refund_after` consumes the custody once and
// exposes exactly one principal-sized OpenNoteDeposit for the Privacy Pool.
#[test]
fn release_before_boundary_returns_full_principal() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);

    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);

    let calldata = array![
        2,
        CUSTODY,
        RELEASE_SECRET,
        OUTPUT_NOTE,
    ];

    let deposits = rekber.privacy_invoke(calldata.span());
    assert(deposits.len() == 1, 'missing output');

    let output = *deposits.at(0);
    assert(output.note_id == OUTPUT_NOTE, 'bad output note');
    assert(output.token == token_address, 'bad output token');
    assert(output.amount == PRINCIPAL, 'principal changed');

    let custody = rekber.get_custody(CUSTODY);
    assert(custody.consumed, 'not consumed');
    assert(!custody.refunded, 'wrong path');
    assert(custody.settled_at == REFUND_AFTER - 1, 'bad settle time');
    assert(
        rekber.get_reserved_amount(token_address) == 0,
        'reserve not released',
    );
    assert(
        token.allowance(rekber_address, privacy_pool()) == PRINCIPAL.into(),
        'bad principal allowance',
    );
}

// Happy path: refund.
//
// At exactly `refund_after`, the refund path becomes valid. The full principal
// is returned and the custody is marked both consumed and refunded.
#[test]
fn refund_at_boundary_returns_full_principal() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);

    start_cheat_block_timestamp(rekber_address, REFUND_AFTER);

    let calldata = array![
        3,
        CUSTODY,
        REFUND_SECRET,
        OUTPUT_NOTE,
    ];

    let deposits = rekber.privacy_invoke(calldata.span());
    assert(deposits.len() == 1, 'missing refund');

    let output = *deposits.at(0);
    assert(output.note_id == OUTPUT_NOTE, 'bad refund note');
    assert(output.amount == PRINCIPAL, 'refund changed');

    let custody = rekber.get_custody(CUSTODY);
    assert(custody.consumed, 'not consumed');
    assert(custody.refunded, 'not refund path');
    assert(custody.settled_at == REFUND_AFTER, 'bad refund time');
    assert(
        rekber.get_reserved_amount(token_address) == 0,
        'reserve not refunded',
    );
}

// Time boundary: release is strictly valid only while
// `now < refund_after`. The exact refund boundary must reject release.
#[test]
#[should_panic(expected: 'RELEASE_WINDOW_CLOSED')]
fn release_at_or_after_boundary_is_rejected() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER);

    let calldata = array![2, CUSTODY, RELEASE_SECRET, OUTPUT_NOTE];
    rekber.privacy_invoke(calldata.span());
}

// Time boundary: refund is valid only when `now >= refund_after`.
#[test]
#[should_panic(expected: 'REFUND_TOO_EARLY')]
fn refund_before_boundary_is_rejected() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);

    let calldata = array![3, CUSTODY, REFUND_SECRET, OUTPUT_NOTE];
    rekber.privacy_invoke(calldata.span());
}

// Authorization preimage: a wrong release secret must not match the
// stored Poseidon commitment and therefore cannot settle custody.
#[test]
#[should_panic(expected: 'BAD_RELEASE_SECRET')]
fn wrong_release_secret_is_rejected() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);

    let calldata = array![2, CUSTODY, RELEASE_SECRET + 1, OUTPUT_NOTE];
    rekber.privacy_invoke(calldata.span());
}

// Authorization preimage: a wrong refund secret must not match the
// stored refund commitment.
#[test]
#[should_panic(expected: 'BAD_REFUND_SECRET')]
fn wrong_refund_secret_is_rejected() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    start_cheat_block_timestamp(rekber_address, REFUND_AFTER);

    let calldata = array![3, CUSTODY, REFUND_SECRET + 1, OUTPUT_NOTE];
    rekber.privacy_invoke(calldata.span());
}

// Replay protection: once release consumes custody, a later refund
// attempt against the same custody must fail.
#[test]
#[should_panic(expected: 'CUSTODY_ALREADY_CONSUMED')]
fn custody_cannot_be_settled_twice() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);
    consume_fee_allowance(@token, token_address, rekber_address);

    start_cheat_block_timestamp(rekber_address, REFUND_AFTER - 1);
    let release = array![2, CUSTODY, RELEASE_SECRET, OUTPUT_NOTE];
    rekber.privacy_invoke(release.span());

    start_cheat_block_timestamp(rekber_address, REFUND_AFTER);
    let refund = array![3, CUSTODY, REFUND_SECRET, OUTPUT_NOTE + 1];
    rekber.privacy_invoke(refund.span());
}

// Custody identity is one-time. Reusing the same custody commitment
// would make settlement state ambiguous and must be rejected.
#[test]
#[should_panic(expected: 'CUSTODY_ALREADY_EXISTS')]
fn duplicate_custody_is_rejected() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    fund_default_custody(@rekber, @token, rekber_address, token_address);

    let release_commitment =
        compute_private_escrow_release_commitment(CUSTODY, RELEASE_SECRET);
    let refund_commitment =
        compute_private_escrow_refund_commitment(CUSTODY, REFUND_SECRET);

    let calldata = array![
        1,
        CUSTODY,
        release_commitment,
        refund_commitment,
        (REFUND_AFTER + 1).into(),
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE + 1,
    ];

    rekber.privacy_invoke(calldata.span());
}

// Trust boundary: Rekber can only be orchestrated by the configured
// STRK20 Privacy Pool, never by an arbitrary direct caller.
#[test]
#[should_panic(expected: 'NOT_PRIVACY_POOL')]
fn non_privacy_pool_caller_is_rejected() {
    let (rekber_address, token_address) = deploy_contracts();
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    start_cheat_caller_address(rekber_address, other_caller());

    let calldata = array![
        1,
        CUSTODY,
        0x222,
        0x333,
        REFUND_AFTER.into(),
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE,
    ];

    rekber.privacy_invoke(calldata.span());
}

// Funding invariant: principal alone is insufficient. Rekber must
// already hold principal + the additional 2% VINSS fee.
#[test]
#[should_panic(expected: 'FUNDS_NOT_RECEIVED')]
fn deposit_requires_principal_plus_fee() {
    let (rekber_address, token_address) = deploy_contracts();
    let token = IMockClaimERC20Dispatcher { contract_address: token_address };
    let rekber = IVinssEscrowRekberDispatcher { contract_address: rekber_address };

    start_cheat_block_timestamp(rekber_address, DEPOSIT_TIME);

    // Only principal arrives; the required extra 2% fee is missing.
    token.mint(rekber_address, PRINCIPAL.into());
    start_cheat_caller_address(rekber_address, privacy_pool());

    let release_commitment =
        compute_private_escrow_release_commitment(CUSTODY, RELEASE_SECRET);
    let refund_commitment =
        compute_private_escrow_refund_commitment(CUSTODY, REFUND_SECRET);

    let calldata = array![
        1,
        CUSTODY,
        release_commitment,
        refund_commitment,
        REFUND_AFTER.into(),
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE,
    ];

    rekber.privacy_invoke(calldata.span());
}
