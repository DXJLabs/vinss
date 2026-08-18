use snforge_std::{
    ContractClassTrait,
    DeclareResultTrait,
    declare,
    start_cheat_block_timestamp,
    start_cheat_caller_address,
};
use starknet::ContractAddress;

use crate::invite::invite_interfaces::{
    IVinssInviteDispatcher,
    IVinssInviteDispatcherTrait,
};
use crate::invite::vinss_invite::compute_invite_commitment;

use crate::test_mocks::mock_erc20::{
    IMockClaimERC20Dispatcher,
    IMockClaimERC20DispatcherTrait,
};

const PRIVACY_POOL: felt252 = 0x123;
const OTHER_CALLER: felt252 = 0x456;
const TEST_SECRET: felt252 = 0xabcdef;
const TEST_OPEN_NOTE_ID: felt252 = 0x12345;
const OPEN_NOTE_AMOUNT: u128 = 1_u128;

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

fn other_caller() -> ContractAddress {
    OTHER_CALLER.try_into().unwrap()
}

fn deploy_contract() -> (ContractAddress, ContractAddress) {
    let token_class = declare("MockClaimERC20")
        .unwrap()
        .contract_class();

    let (token_address, _) = token_class
        .deploy(@array![])
        .unwrap();

    let contract = declare("VinssInvite")
        .unwrap()
        .contract_class();

    let constructor_calldata = array![
        PRIVACY_POOL,
        token_address.into(),
    ];

    let (contract_address, _) = contract
        .deploy(@constructor_calldata)
        .unwrap();

    // Give the helper enough balance for the OpenNoteDeposit path.
    let token = IMockClaimERC20Dispatcher {
        contract_address: token_address,
    };

    token.mint(
        contract_address,
        10_u128.into(),
    );

    (contract_address, token_address)
}

fn create_invite(
    dispatcher: @IVinssInviteDispatcher,
    contract_address: ContractAddress,
    secret: felt252,
    expires_at: u64,
) {
    start_cheat_caller_address(
        contract_address,
        privacy_pool(),
    );

    let commitment = compute_invite_commitment(secret);

    let calldata = array![
        0,
        commitment,
        expires_at.into(),
        TEST_OPEN_NOTE_ID,
    ];

    dispatcher.privacy_invoke(calldata.span());
}

fn consume_invite(
    dispatcher: @IVinssInviteDispatcher,
    contract_address: ContractAddress,
    secret: felt252,
) {
    start_cheat_caller_address(
        contract_address,
        privacy_pool(),
    );

    let calldata = array![
        1,
        secret,
        TEST_OPEN_NOTE_ID,
    ];

    dispatcher.privacy_invoke(calldata.span());
}

#[test]
fn constructor_stores_privacy_pool() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    assert(
        dispatcher.get_privacy_pool() == privacy_pool(),
        'pool mismatch',
    );
}

#[test]
fn create_invite_stores_commitment() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    let commitment =
        compute_invite_commitment(TEST_SECRET);

    create_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
        2000,
    );

    let invite = dispatcher.get_invite(commitment);

    assert(invite.exists, 'invite missing');
    assert(!invite.consumed, 'invite consumed');
    assert(invite.expires_at == 2000, 'bad expiry');
}

#[test]
fn create_returns_one_wei_open_note_deposit() {
    let (contract_address, token_address) =
        deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    start_cheat_caller_address(
        contract_address,
        privacy_pool(),
    );

    let commitment =
        compute_invite_commitment(TEST_SECRET);

    let calldata = array![
        0,
        commitment,
        2000,
        TEST_OPEN_NOTE_ID,
    ];

    let deposits =
        dispatcher.privacy_invoke(calldata.span());

    assert(deposits.len() == 1, 'missing deposit');

    let deposit = *deposits.at(0);

    assert(
        deposit.note_id == TEST_OPEN_NOTE_ID,
        'bad note id',
    );

    assert(
        deposit.token == token_address,
        'bad token',
    );

    assert(
        deposit.amount == OPEN_NOTE_AMOUNT,
        'bad amount',
    );
}

#[test]
fn consume_invite_marks_consumed() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    create_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
        2000,
    );

    consume_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
    );

    let commitment =
        compute_invite_commitment(TEST_SECRET);

    let invite = dispatcher.get_invite(commitment);

    assert(invite.exists, 'invite missing');
    assert(invite.consumed, 'not consumed');
}

#[test]
#[should_panic(expected: 'INVITE_EXISTS')]
fn duplicate_create_is_rejected() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    create_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
        2000,
    );

    create_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
        2000,
    );
}

#[test]
#[should_panic(expected: 'INVITE_CONSUMED')]
fn invite_cannot_be_consumed_twice() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    create_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
        2000,
    );

    consume_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
    );

    consume_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
    );
}

#[test]
#[should_panic(expected: 'INVITE_NOT_FOUND')]
fn unknown_secret_is_rejected() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    consume_invite(
        @dispatcher,
        contract_address,
        0x999999,
    );
}

#[test]
#[should_panic(expected: 'INVITE_EXPIRED')]
fn expired_invite_cannot_be_created() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        2000,
    );

    create_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
        1999,
    );
}

#[test]
#[should_panic(expected: 'INVITE_EXPIRED')]
fn expired_invite_cannot_be_consumed() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    create_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
        1500,
    );

    start_cheat_block_timestamp(
        contract_address,
        1501,
    );

    consume_invite(
        @dispatcher,
        contract_address,
        TEST_SECRET,
    );
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_POOL')]
fn non_privacy_pool_caller_is_rejected() {
    let (contract_address, _) = deploy_contract();

    let dispatcher = IVinssInviteDispatcher {
        contract_address,
    };

    start_cheat_block_timestamp(
        contract_address,
        1000,
    );

    start_cheat_caller_address(
        contract_address,
        other_caller(),
    );

    let commitment =
        compute_invite_commitment(TEST_SECRET);

    let calldata = array![
        0,
        commitment,
        2000,
        TEST_OPEN_NOTE_ID,
    ];

    dispatcher.privacy_invoke(calldata.span());
}
