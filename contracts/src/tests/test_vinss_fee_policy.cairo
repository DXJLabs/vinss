use snforge_std::{
    ContractClassTrait,
    DeclareResultTrait,
    declare,
    start_cheat_block_timestamp,
    start_cheat_caller_address,
};
use starknet::ContractAddress;

use crate::fee_policy::interfaces::{
    IVinssFeePolicyDispatcher,
    IVinssFeePolicyDispatcherTrait,
};
use crate::fee_policy::types::{
    FEE_ACTION_MESSAGE,
    FEE_ACTION_OFFER,
    FEE_ACTION_REKBER,
    FEE_ACTION_ROOM_ACTIVATION,
};
use crate::test_mocks::mock_pragma::{
    IMockPragmaDispatcher,
    IMockPragmaDispatcherTrait,
};

const ADMIN: felt252 = 0x111;
const OTHER: felt252 = 0x222;
const STRK_USD_PAIR: felt252 = 0x5354524b2f555344;
const TWO_STRK: u128 = 2_000_000_000_000_000_000_u128;
const THREE_STRK: u128 = 3_000_000_000_000_000_000_u128;
const FOUR_STRK: u128 = 4_000_000_000_000_000_000_u128;
const SIX_STRK: u128 = 6_000_000_000_000_000_000_u128;
const TEN_STRK: u128 = 10_000_000_000_000_000_000_u128;

fn admin() -> ContractAddress {
    ADMIN.try_into().unwrap()
}

fn other() -> ContractAddress {
    OTHER.try_into().unwrap()
}

fn deploy_policy(
    price: u128,
    decimals: u32,
    sponsor_cost: u128,
    updated_at: u64,
) -> (ContractAddress, ContractAddress) {
    let pragma_class = declare("MockPragma")
        .unwrap()
        .contract_class();

    let (pragma_address, _) = pragma_class
        .deploy(@array![])
        .unwrap();

    let pragma = IMockPragmaDispatcher {
        contract_address: pragma_address,
    };

    pragma.set_price(
        STRK_USD_PAIR,
        price,
        decimals,
        updated_at,
        5,
        0,
    );

    let policy_class = declare("VinssFeePolicy")
        .unwrap()
        .contract_class();

    let constructor = array![
        ADMIN,
        pragma_address.into(),
        STRK_USD_PAIR,
        sponsor_cost.into(),
        300_u64.into(),
        2_u32.into(),
    ];

    let (policy_address, _) = policy_class
        .deploy(@constructor)
        .unwrap();

    (policy_address, pragma_address)
}

#[test]
fn usd_price_floor_drives_message_and_offer_at_0025_strk() {
    let (policy_address, _) =
        deploy_policy(25_000, 6, TWO_STRK, 900);

    start_cheat_block_timestamp(
        policy_address,
        1000,
    );

    let policy = IVinssFeePolicyDispatcher {
        contract_address: policy_address,
    };

    assert(
        policy.quote_fee(FEE_ACTION_MESSAGE) == SIX_STRK,
        'bad message quote',
    );

    assert(
        policy.quote_fee(FEE_ACTION_OFFER) == TEN_STRK,
        'bad offer quote',
    );

    assert(
        policy.quote_fee(FEE_ACTION_ROOM_ACTIVATION)
            == TEN_STRK,
        'bad room quote',
    );
}

#[test]
fn sponsor_floor_wins_when_strk_price_rises() {
    let (policy_address, _) =
        deploy_policy(100_000, 6, TWO_STRK, 900);

    start_cheat_block_timestamp(
        policy_address,
        1000,
    );

    let policy = IVinssFeePolicyDispatcher {
        contract_address: policy_address,
    };

    assert(
        policy.quote_fee(FEE_ACTION_MESSAGE) == FOUR_STRK,
        'sponsor floor not applied',
    );
}

#[test]
fn pricing_admin_can_raise_live_sponsor_cost() {
    let (policy_address, _) =
        deploy_policy(100_000, 6, TWO_STRK, 900);

    start_cheat_block_timestamp(
        policy_address,
        1000,
    );

    let policy = IVinssFeePolicyDispatcher {
        contract_address: policy_address,
    };

    start_cheat_caller_address(
        policy_address,
        admin(),
    );

    policy.set_sponsor_cost_strk_wei(
        THREE_STRK,
    );

    assert(
        policy.get_sponsor_cost_strk_wei()
            == THREE_STRK,
        'cost not updated',
    );

    assert(
        policy.quote_fee(FEE_ACTION_MESSAGE) == SIX_STRK,
        'updated sponsor floor wrong',
    );
}

#[test]
#[should_panic(expected: 'NOT_PRICING_ADMIN')]
fn arbitrary_wallet_cannot_change_sponsor_cost() {
    let (policy_address, _) =
        deploy_policy(100_000, 6, TWO_STRK, 900);

    start_cheat_block_timestamp(
        policy_address,
        1000,
    );

    let policy = IVinssFeePolicyDispatcher {
        contract_address: policy_address,
    };

    start_cheat_caller_address(
        policy_address,
        other(),
    );

    policy.set_sponsor_cost_strk_wei(
        THREE_STRK,
    );
}

#[test]
#[should_panic(expected: 'STALE_ORACLE_PRICE')]
fn stale_price_is_fail_closed() {
    let (policy_address, _) =
        deploy_policy(25_000, 6, TWO_STRK, 100);

    start_cheat_block_timestamp(
        policy_address,
        1000,
    );

    let policy = IVinssFeePolicyDispatcher {
        contract_address: policy_address,
    };

    policy.quote_fee(FEE_ACTION_MESSAGE);
}


#[test]
fn rekber_uses_public_floor_when_reserve_is_lower() {
    // STRK = $0.025.
    // sponsor = 2 STRK/action.
    // 6 included actions * 2x margin = 24 STRK = $0.60.
    // The public $0.75 Rekber floor wins.
    let (policy_address, _) =
        deploy_policy(25_000, 6, TWO_STRK, 900);

    start_cheat_block_timestamp(
        policy_address,
        1000,
    );

    let policy = IVinssFeePolicyDispatcher {
        contract_address: policy_address,
    };

    assert(
        policy.quote_fee_usd_micros(
            FEE_ACTION_REKBER,
        ) == 750_000_u128,
        'rekber usd floor wrong',
    );

    assert(
        policy.quote_fee(
            FEE_ACTION_REKBER,
        ) == 30_000_000_000_000_000_000_u128,
        'rekber strk floor wrong',
    );
}

#[test]
fn rekber_reserve_rises_when_strk_price_rises() {
    // STRK = $0.10.
    // 6 actions * 2 STRK/action * 2x margin = 24 STRK = $2.40.
    let (policy_address, _) =
        deploy_policy(100_000, 6, TWO_STRK, 900);

    start_cheat_block_timestamp(
        policy_address,
        1000,
    );

    let policy = IVinssFeePolicyDispatcher {
        contract_address: policy_address,
    };

    assert(
        policy.quote_fee_usd_micros(
            FEE_ACTION_REKBER,
        ) == 2_400_000_u128,
        'rekber sponsor usd wrong',
    );

    assert(
        policy.quote_fee(
            FEE_ACTION_REKBER,
        ) == 24_000_000_000_000_000_000_u128,
        'rekber sponsor strk wrong',
    );
}
