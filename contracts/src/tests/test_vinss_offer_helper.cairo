use core::poseidon::poseidon_hash_span;

use snforge_std::{
    ContractClassTrait,
    DeclareResultTrait,
    Event,
    EventSpyAssertionsTrait,
    declare,
    spy_events,
    start_cheat_caller_address,
};

use starknet::ContractAddress;

use crate::test_mocks::mock_erc20::{
    IMockClaimERC20Dispatcher,
    IMockClaimERC20DispatcherTrait,
};

use crate::offers::offer_interfaces::{
    IVinssOfferHelperDispatcher,
    IVinssOfferHelperDispatcherTrait,
};

use crate::utils::constants::{
    VINSS_OFFER_COMMITMENT_DOMAIN,
    VINSS_OFFER_ENVELOPE_VERSION,
};

const PRIVACY_POOL: felt252 = 0x123;
const OFFER_REVENUE: u128 = 10000000000000000000_u128;
const TEST_OPEN_NOTE_ID: felt252 = 0x12345;
const OTHER_CALLER: felt252 = 0x456;

const SENDER_TAG: felt252 = 0x111;
const RECIPIENT_TAG: felt252 = 0x222;

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

    let contract = declare("VinssOfferHelper")
        .unwrap()
        .contract_class();

    let constructor_calldata = array![
        PRIVACY_POOL,
        token_address.into(),
    ];

    let (address, _) = contract
        .deploy(@constructor_calldata)
        .unwrap();

    let token = IMockClaimERC20Dispatcher {
        contract_address: token_address,
    };

    token.mint(
        address,
        OFFER_REVENUE.into(),
    );

    (address, token_address)
}

fn compute_commitment(
    locator: felt252,
    sender_tag: felt252,
    recipient_tag: felt252,
    chunks: Span<felt252>,
) -> felt252 {
    let count: u64 = chunks
        .len()
        .try_into()
        .unwrap();

    let mut input = array![
        VINSS_OFFER_COMMITMENT_DOMAIN,
        VINSS_OFFER_ENVELOPE_VERSION.into(),
        locator,
        sender_tag,
        recipient_tag,
        count.into(),
    ];

    let mut i: usize = 0;

    loop {
        if i == chunks.len() {
            break;
        }

        input.append(*chunks.at(i));
        i += 1;
    };

    poseidon_hash_span(input.span())
}

fn make_calldata(
    locator: felt252,
    sender_tag: felt252,
    recipient_tag: felt252,
    chunks: Span<felt252>,
) -> Array<felt252> {
    let commitment = compute_commitment(
        locator,
        sender_tag,
        recipient_tag,
        chunks,
    );

    let mut calldata = array![
        VINSS_OFFER_ENVELOPE_VERSION.into(),
        locator,
        sender_tag,
        recipient_tag,
        commitment,
        chunks.len().into(),
    ];

    let mut i: usize = 0;

    loop {
        if i == chunks.len() {
            break;
        }

        calldata.append(*chunks.at(i));
        i += 1;
    };

    calldata.append(TEST_OPEN_NOTE_ID);

    calldata
}

#[test]
fn constructor_stores_privacy_pool() {
    let (address, _) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    assert(
        dispatcher.get_privacy_pool() == privacy_pool(),
        'pool mismatch',
    );
}

#[test]
fn stores_offer_v2_record() {
    let (address, token_address) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    let locator = 0xabc;
    let chunks = array![11, 22, 33];

    let calldata = make_calldata(
        locator,
        SENDER_TAG,
        RECIPIENT_TAG,
        chunks.span(),
    );

    start_cheat_caller_address(
        address,
        privacy_pool(),
    );

    let deposits =
        dispatcher.privacy_invoke(calldata.span());

    assert(deposits.len() == 1, 'missing revenue');

    let deposit = *deposits.at(0);

    assert(
        deposit.note_id == TEST_OPEN_NOTE_ID,
        'bad note id',
    );

    assert(
        deposit.token == token_address,
        'bad revenue token',
    );

    assert(
        deposit.amount == OFFER_REVENUE,
        'bad revenue amount',
    );

    let record = dispatcher.get_offer_action(locator);

    assert(
        record.envelope_version
            == VINSS_OFFER_ENVELOPE_VERSION,
        'bad version',
    );

    assert(
        record.sender_tag == SENDER_TAG,
        'bad sender tag',
    );

    assert(
        record.recipient_tag == RECIPIENT_TAG,
        'bad recipient tag',
    );

    assert(
        record.payload_chunk_count == 3,
        'bad chunks',
    );

    assert(
        dispatcher.get_offer_payload_chunk(
            locator,
            1,
        ) == 22,
        'bad chunk',
    );
}

#[test]
#[should_panic(expected: 'NOT_PRIVACY_POOL')]
fn rejects_non_pool_caller() {
    let (address, _) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    let chunks = array![11];

    let calldata = make_calldata(
        0xabc,
        SENDER_TAG,
        RECIPIENT_TAG,
        chunks.span(),
    );

    start_cheat_caller_address(
        address,
        other_caller(),
    );

    dispatcher.privacy_invoke(calldata.span());
}

#[test]
#[should_panic(expected: 'ZERO_OFFER_SENDER')]
fn rejects_zero_sender_tag() {
    let (address, _) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    let chunks = array![11];

    let calldata = make_calldata(
        0xabc,
        0,
        RECIPIENT_TAG,
        chunks.span(),
    );

    start_cheat_caller_address(
        address,
        privacy_pool(),
    );

    dispatcher.privacy_invoke(calldata.span());
}

#[test]
#[should_panic(expected: 'ZERO_OFFER_RECIPIENT')]
fn rejects_zero_recipient_tag() {
    let (address, _) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    let chunks = array![11];

    let calldata = make_calldata(
        0xabc,
        SENDER_TAG,
        0,
        chunks.span(),
    );

    start_cheat_caller_address(
        address,
        privacy_pool(),
    );

    dispatcher.privacy_invoke(calldata.span());
}

#[test]
#[should_panic(expected: 'OFFER_COMMIT_MISMATCH')]
fn rejects_invalid_commitment() {
    let (address, _) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    let calldata = array![
        VINSS_OFFER_ENVELOPE_VERSION.into(),
        0xabc,
        SENDER_TAG,
        RECIPIENT_TAG,
        0x999,
        1,
        11,
        TEST_OPEN_NOTE_ID,
    ];

    start_cheat_caller_address(
        address,
        privacy_pool(),
    );

    dispatcher.privacy_invoke(calldata.span());
}

#[test]
#[should_panic(expected: 'OFFER_LOCATOR_USED')]
fn rejects_locator_replay() {
    let (address, _) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    let chunks = array![11];

    let calldata = make_calldata(
        0xabc,
        SENDER_TAG,
        RECIPIENT_TAG,
        chunks.span(),
    );

    start_cheat_caller_address(
        address,
        privacy_pool(),
    );

    dispatcher.privacy_invoke(calldata.span());
    dispatcher.privacy_invoke(calldata.span());
}

#[test]
fn event_contains_v2_routing_tags() {
    let (address, _) = deploy_contract();

    let dispatcher =
        IVinssOfferHelperDispatcher {
            contract_address: address,
        };

    let locator = 0xabc;
    let chunks = array![11];

    let calldata = make_calldata(
        locator,
        SENDER_TAG,
        RECIPIENT_TAG,
        chunks.span(),
    );

    let commitment = *calldata.at(4);

    let mut spy = spy_events();

    start_cheat_caller_address(
        address,
        privacy_pool(),
    );

    dispatcher.privacy_invoke(calldata.span());

    let expected = Event {
        keys: array![
            selector!("OfferActionCommitted"),
            locator,
        ],
        data: array![
            commitment,
            SENDER_TAG,
            RECIPIENT_TAG,
        ],
    };

    spy.assert_emitted(
        @array![(address, expected)],
    );
}
