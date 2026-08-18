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

use crate::private_escrow::private_escrow_interfaces::{
    IVinssPrivateEscrowHelperDispatcher,
    IVinssPrivateEscrowHelperDispatcherTrait,
};

use crate::utils::constants::{
    VINSS_PRIVATE_ESCROW_COMMITMENT_DOMAIN,
    VINSS_PRIVATE_ESCROW_ENVELOPE_VERSION,
};

const PRIVACY_POOL: felt252 = 0x123;
const OTHER_CALLER: felt252 = 0x456;

const SENDER_TAG: felt252 = 0x111;
const RECIPIENT_TAG: felt252 = 0x222;

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

fn other_caller() -> ContractAddress {
    OTHER_CALLER.try_into().unwrap()
}

fn deploy_contract() -> ContractAddress {
    let contract = declare("VinssPrivateEscrowHelper")
        .unwrap()
        .contract_class();

    let (address, _) = contract
        .deploy(@array![PRIVACY_POOL])
        .unwrap();

    address
}

fn compute_commitment(
    locator: felt252,
    sender_tag: felt252,
    recipient_tag: felt252,
    chunks: Span<felt252>,
) -> felt252 {
    let count: u64 = chunks.len().try_into().unwrap();

    let mut input = array![
        VINSS_PRIVATE_ESCROW_COMMITMENT_DOMAIN,
        VINSS_PRIVATE_ESCROW_ENVELOPE_VERSION.into(),
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
        VINSS_PRIVATE_ESCROW_ENVELOPE_VERSION.into(),
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

    calldata
}

#[test]
fn stores_private_escrow_v2_record() {
    let address = deploy_contract();

    let dispatcher = IVinssPrivateEscrowHelperDispatcher {
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

    let deposits = dispatcher.privacy_invoke(calldata.span());

    assert(deposits.len() == 0, 'unexpected deposit');

    let record = dispatcher.get_private_escrow_action(locator);

    assert(
        record.envelope_version
            == VINSS_PRIVATE_ESCROW_ENVELOPE_VERSION,
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
        'bad chunk count',
    );

    assert(
        dispatcher.get_private_escrow_payload_chunk(
            locator,
            1,
        ) == 22,
        'bad ciphertext chunk',
    );
}

#[test]
#[should_panic(expected: 'NOT_PRIVACY_POOL')]
fn rejects_non_pool_caller() {
    let address = deploy_contract();

    let dispatcher = IVinssPrivateEscrowHelperDispatcher {
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
#[should_panic(expected: 'ZERO_ESCROW_SENDER')]
fn rejects_zero_sender_tag() {
    let address = deploy_contract();

    let dispatcher = IVinssPrivateEscrowHelperDispatcher {
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
#[should_panic(expected: 'ZERO_ESCROW_RECIPIENT')]
fn rejects_zero_recipient_tag() {
    let address = deploy_contract();

    let dispatcher = IVinssPrivateEscrowHelperDispatcher {
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
#[should_panic(expected: 'ESCROW_COMMIT_MISMATCH')]
fn rejects_invalid_commitment() {
    let address = deploy_contract();

    let dispatcher = IVinssPrivateEscrowHelperDispatcher {
        contract_address: address,
    };

    let calldata = array![
        VINSS_PRIVATE_ESCROW_ENVELOPE_VERSION.into(),
        0xabc,
        SENDER_TAG,
        RECIPIENT_TAG,
        0x999,
        1,
        11,
    ];

    start_cheat_caller_address(
        address,
        privacy_pool(),
    );

    dispatcher.privacy_invoke(calldata.span());
}

#[test]
#[should_panic(expected: 'ESCROW_LOCATOR_USED')]
fn rejects_locator_replay() {
    let address = deploy_contract();

    let dispatcher = IVinssPrivateEscrowHelperDispatcher {
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
    let address = deploy_contract();

    let dispatcher = IVinssPrivateEscrowHelperDispatcher {
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
            selector!("PrivateEscrowActionCommitted"),
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
