use snforge_std::{ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp};
use starknet::ContractAddress;
use crate::fee_policy::interfaces::{IVinssFeePolicyDispatcher, IVinssFeePolicyDispatcherTrait};
use crate::test_mocks::mock_pragma::{IMockPragmaDispatcher, IMockPragmaDispatcherTrait};
fn deploy(name: ByteArray, args: Array<felt252>) -> ContractAddress {
    let (address, _) = declare(name).unwrap().contract_class().deploy(@args).unwrap();
    address
}
#[test]
fn flat_fees_exclude_sponsor_reserve_and_public_rekber_keeps_original_policy() {
    let oracle = deploy("MockPragma", array![]);
    IMockPragmaDispatcher { contract_address: oracle }.set_price('STRK/USD', 100_000_000, 8, 900, 5, 0);
    let old = deploy("VinssFeePolicy", array![111, oracle.into(), 'STRK/USD', 2_000_000_000_000_000_000, 300, 2]);
    let app = deploy("VinssAppFeePolicy", array![old.into(), 300, 2]);
    let public = deploy("VinssPublicAppFeePolicy", array![old.into(), app.into()]);
    for address in array![old, app, public] { start_cheat_block_timestamp(address, 1000); }
    let old_policy = IVinssFeePolicyDispatcher { contract_address: old };
    let shield_policy = IVinssFeePolicyDispatcher { contract_address: app };
    let public_policy = IVinssFeePolicyDispatcher { contract_address: public };
    assert_eq!(shield_policy.quote_fee(2), 20_000_000_000_000_000);
    assert_eq!(public_policy.quote_fee(2), 10_000_000_000_000_000);
    assert_eq!(public_policy.quote_fee_usd_micros(1), 50_000);
    assert_eq!(public_policy.quote_fee_usd_micros(2), 10_000);
    assert_eq!(public_policy.quote_fee_usd_micros(3), 50_000);
    assert_eq!(shield_policy.quote_fee_usd_micros(1), 100_000);
    assert_eq!(shield_policy.quote_fee_usd_micros(2), 20_000);
    assert_eq!(shield_policy.quote_fee_usd_micros(3), 100_000);
    assert_eq!(public_policy.quote_fee(4), old_policy.quote_fee(4));
    assert_eq!(public_policy.quote_fee_usd_micros(4), old_policy.quote_fee_usd_micros(4));
    assert_eq!(shield_policy.quote_fee(4), old_policy.quote_fee(4));
}
