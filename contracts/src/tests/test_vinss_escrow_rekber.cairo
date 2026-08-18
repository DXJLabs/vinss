use snforge_std::{
    ContractClassTrait,
    DeclareResultTrait,
    declare,
    start_cheat_caller_address,
};

use starknet::ContractAddress;

use crate::claim_escrow::test_mocks::mock_claim_erc20::{
    IMockClaimERC20Dispatcher,
    IMockClaimERC20DispatcherTrait,
};

use crate::escrow_rekber::escrow_rekber_interfaces::{
    IVinssEscrowRekberDispatcher,
    IVinssEscrowRekberDispatcherTrait,
};

const PRIVACY_POOL: felt252 = 0x123;
const CUSTODY: felt252 = 0x111;
const RELEASE_COMMITMENT: felt252 = 0x222;
const REFUND_COMMITMENT: felt252 = 0x333;
const REVENUE_NOTE: felt252 = 0x444;

const PRINCIPAL: u128 = 10000_u128;
const FEE: u128 = 100_u128; // 1%

fn privacy_pool() -> ContractAddress {
    PRIVACY_POOL.try_into().unwrap()
}

#[test]
fn rekber_keeps_full_principal_and_returns_one_percent_fee() {
    let token_class = declare("MockClaimERC20")
        .unwrap()
        .contract_class();

    let (token_address, _) =
        token_class.deploy(@array![]).unwrap();

    let rekber_class = declare("VinssEscrowRekber")
        .unwrap()
        .contract_class();

    let (rekber_address, _) = rekber_class
        .deploy(@array![PRIVACY_POOL])
        .unwrap();

    let token = IMockClaimERC20Dispatcher {
        contract_address: token_address,
    };

    // Wallet deposits principal + VINSS 1% fee.
    token.mint(
        rekber_address,
        (PRINCIPAL + FEE).into(),
    );

    let rekber = IVinssEscrowRekberDispatcher {
        contract_address: rekber_address,
    };

    start_cheat_caller_address(
        rekber_address,
        privacy_pool(),
    );

    let calldata = array![
        1,
        CUSTODY,
        RELEASE_COMMITMENT,
        REFUND_COMMITMENT,
        10000000000,
        token_address.into(),
        PRINCIPAL.into(),
        REVENUE_NOTE,
    ];

    let deposits =
        rekber.privacy_invoke(calldata.span());

    assert(deposits.len() == 1, 'missing fee');

    let revenue = *deposits.at(0);

    assert(
        revenue.note_id == REVENUE_NOTE,
        'bad revenue note',
    );
    assert(
        revenue.token == token_address,
        'bad revenue token',
    );
    assert(
        revenue.amount == FEE,
        'fee not one pct',
    );

    let custody = rekber.get_custody(CUSTODY);

    // Principal tidak dipotong fee.
    assert(
        custody.amount == PRINCIPAL,
        'principal reduced',
    );

    assert(
        rekber.get_reserved_amount(token_address)
            == PRINCIPAL,
        'bad reserve',
    );

    // Pool hanya boleh menarik fee 1%.
    assert(
        token.allowance(
            rekber_address,
            privacy_pool(),
        ) == FEE.into(),
        'bad fee allowance',
    );
}
