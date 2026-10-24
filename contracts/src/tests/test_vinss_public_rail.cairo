use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_number,
    start_cheat_block_timestamp, start_cheat_caller_address, start_cheat_chain_id,
    start_cheat_transaction_hash, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use crate::escrow_rekber::commitments::{
    compute_fulfillment_chain_step, compute_payee_claim_commitment,
    compute_payee_dispute_commitment, compute_payee_refund_consent_commitment,
    compute_payer_confirmation_commitment, compute_payer_dispute_commitment,
    compute_refund_commitment, compute_release_authorization_commitment,
};
use crate::fee_policy::interfaces::{IVinssFeePolicyDispatcher, IVinssFeePolicyDispatcherTrait};
use crate::invite::invite_interfaces::{IVinssInviteDispatcher, IVinssInviteDispatcherTrait};
use crate::public_rail::interfaces::{
    IVinssPublicRailDispatcher, IVinssPublicRailDispatcherTrait, IVinssPublicRailSafeDispatcher,
    IVinssPublicRailSafeDispatcherTrait,
};
use crate::test_mocks::mock_erc20::{IMockClaimERC20Dispatcher, IMockClaimERC20DispatcherTrait};
use crate::test_mocks::mock_pragma::{IMockPragmaDispatcher, IMockPragmaDispatcherTrait};
const CHAIN: felt252 = 'SN_SEPOLIA';
const INVITE_KEY: felt252 = core::ec::stark_curve::GEN_X;
const SIGNING_BOUND: u256 = 0x800000000000000000000000000000000000000000000000000000000000000;
const ADMIN: felt252 = 111;
const PAYER: felt252 = 222;
const PAYEE: felt252 = 333;
const TREASURY: felt252 = 444;
const OTHER: felt252 = 555;
const FEE: u128 = 2_000_000_000_000_000_000;
const PRINCIPAL: u128 = 100_000_000_000_000_000_000;
const CUSTODY: felt252 = 77;
fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}
fn deploy(name: ByteArray, data: Array<felt252>) -> ContractAddress {
    let (a, _) = declare(name).unwrap().contract_class().deploy(@data).unwrap();
    a
}
#[derive(Copy, Drop)]
struct Env {
    rail: ContractAddress,
    token: ContractAddress,
    invite: ContractAddress,
    message: ContractAddress,
    offer: ContractAddress,
    action: ContractAddress,
    rekber: ContractAddress,
    policy: ContractAddress,
}
fn setup() -> Env {
    setup_with_mode(0)
}
fn setup_with_mode(mode: u8) -> Env {
    let token = deploy("MockClaimERC20", array![]);
    let usdc = deploy("MockClaimERC20", array![]);
    let shield = deploy("MockFeePolicy", array![FEE.into(), 1_000_000]);
    let policy = deploy("VinssPublicFeePolicy", array![shield.into()]);
    let rail = deploy("VinssPublicRail", array![ADMIN, TREASURY, token.into()]);
    let invite = if mode == 0 {
        deploy("VinssInvite", array![rail.into(), token.into(), policy.into()])
    } else {
        deploy("MockPublicHelper", array![rail.into(), token.into(), policy.into(), mode.into()])
    };
    let message = deploy("VinssMessageHelper", array![rail.into(), token.into(), policy.into()]);
    let offer = deploy("VinssOfferHelper", array![rail.into(), token.into(), policy.into()]);
    let action = deploy("VinssPrivateEscrowHelper", array![rail.into()]);
    let oracle = deploy("MockPragma", array![]);
    let pragma = IMockPragmaDispatcher { contract_address: oracle };
    pragma.set_price('STRK/USD', 100_000_000, 8, 1000, 5, 0);
    pragma.set_price('USDC/USD', 100_000_000, 8, 1000, 5, 0);
    let rekber = deploy(
        "VinssEscrowRekber",
        array![
            rail.into(), oracle.into(), shield.into(), OTHER, 0, token.into(), usdc.into(),
            'STRK/USD', 'USDC/USD', 1_000_000, 300, 2,
        ],
    );
    start_cheat_chain_id(rail, CHAIN);
    start_cheat_transaction_hash(rail, 1);
    start_cheat_block_timestamp(rail, 1000);
    start_cheat_block_timestamp(invite, 1000);
    start_cheat_block_timestamp(rekber, 1000);
    start_cheat_block_number(rail, 10);
    start_cheat_caller_address(rail, addr(ADMIN));
    let env = Env { rail, token, invite, message, offer, action, rekber, policy };
    initialize(env);
    let token_dispatcher = IMockClaimERC20Dispatcher { contract_address: token };
    token_dispatcher.mint(addr(PAYER), (PRINCIPAL + 10 * FEE).into());
    token_dispatcher.mint(addr(PAYEE), (10 * FEE).into());
    start_cheat_caller_address(token, addr(PAYER));
    token_dispatcher.approve(rail, (PRINCIPAL + 10 * FEE).into());
    start_cheat_caller_address(token, addr(PAYEE));
    token_dispatcher.approve(rail, (10 * FEE).into());
    stop_cheat_caller_address(token);
    start_cheat_caller_address(rail, addr(PAYER));
    env
}
fn initialize(e: Env) {
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .initialize(e.invite, e.message, e.offer, e.action, e.rekber, e.policy);
}
fn deposit(e: Env) -> Array<felt252> {
    array![
        1, CUSTODY, compute_release_authorization_commitment(CUSTODY, 11),
        compute_payee_claim_commitment(CUSTODY, 12), compute_refund_commitment(CUSTODY, 13),
        compute_payer_confirmation_commitment(CUSTODY, 14),
        compute_payer_dispute_commitment(CUSTODY, 15),
        compute_payee_dispute_commitment(CUSTODY, 16),
        compute_payee_refund_consent_commitment(CUSTODY, 17),
        compute_fulfillment_chain_step(CUSTODY, 18), 0, 20, 21, 2000, 300, 1, 1, 0, e.token.into(),
        PRINCIPAL.into(), FEE.into(), 99,
    ]
}
fn fund(e: Env) {
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .fund_custody(deposit(e).span(), addr(PAYEE));
}
fn invite_commitment(e: Env, creator: felt252, key: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span(
        ['VINSS_PUBLIC_INVITE_V1', CHAIN, e.rail.into(), creator, key].span(),
    )
}
fn invite_payload(e: Env) -> Array<felt252> {
    array![0, invite_commitment(e, PAYER, INVITE_KEY), 2000, (FEE / 2).into(), 99]
}
fn make_invite(e: Env) -> felt252 {
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
    invite_commitment(e, PAYER, INVITE_KEY)
}
// Test-only signing with private key 1 or 2 and fixed nonce k=1. Never use this signer in clients.
fn signature_for(
    chain: felt252,
    adapter: ContractAddress,
    caller: felt252,
    commitment: felt252,
    private_key: u256,
) -> (felt252, felt252) {
    let hash: u256 = core::poseidon::poseidon_hash_span(
        ['VINSS_PUBLIC_CONSUME_V1', chain, adapter.into(), caller, commitment].span(),
    )
        .into();
    let r: u256 = INVITE_KEY.into();
    let order: u256 = core::ec::stark_curve::ORDER.into();
    let s: felt252 = ((hash % SIGNING_BOUND + r * private_key) % order).try_into().unwrap();
    (INVITE_KEY, s)
}
fn consume(e: Env, commitment: felt252) {
    let (r, s) = signature_for(CHAIN, e.rail, PAYER, commitment, 1);
    IVinssPublicRailDispatcher { contract_address: e.rail }.consume_invite(commitment, r, s);
}
fn locator(e: Env, caller: felt252, nonce: felt252) -> felt252 {
    core::poseidon::poseidon_hash_span(
        ['VINSS_PUBLIC_ACTION_V1', CHAIN, e.rail.into(), caller, nonce].span(),
    )
}
fn envelope(
    e: Env, caller: felt252, nonce: felt252, domain: felt252, chunk: felt252,
) -> Array<felt252> {
    let id = locator(e, caller, nonce);
    let commitment = core::poseidon::poseidon_hash_span([domain, 2, id, 55, 66, 1, chunk].span());
    array![2, id, 55, 66, commitment, 1, chunk]
}
fn message(e: Env, caller: felt252, nonce: felt252) {
    let mut data = envelope(e, caller, nonce, 'VINSS_MSG_COMMIT_V2', 777);
    data.append((FEE / 2).into());
    data.append(99);
    IVinssPublicRailDispatcher { contract_address: e.rail }.post_message(data.span(), nonce);
}
#[test]
fn fee_wrapper_halves_flat_ceiling_and_preserves_rekber() {
    let shield = deploy("MockFeePolicy", array![5, 9]);
    let policy = IVinssFeePolicyDispatcher {
        contract_address: deploy("VinssPublicFeePolicy", array![shield.into()]),
    };
    for action in 1_u8..4_u8 {
        assert(policy.quote_fee(action) == 3, 'WRONG_FLAT');
        assert(policy.quote_fee_usd_micros(action) == 5, 'WRONG_USD');
    }
    assert(policy.quote_fee(4) == 5 && policy.quote_fee_usd_micros(4) == 9, 'CHANGED_REKBER');
}
#[test]
fn exact_funding_fee_drain_and_bound_refund() {
    let e = setup();
    fund(e);
    let token = IMockClaimERC20Dispatcher { contract_address: e.token };
    assert(token.balance_of(addr(TREASURY)) == FEE.into(), 'WRONG_REVENUE');
    assert(token.balance_of(e.rekber) == PRINCIPAL.into(), 'WRONG_RESERVE');
    assert(token.balance_of(e.rail) == 0 && token.allowance(e.rekber, e.rail) == 0, 'UNDRAINED');
    let rail = IVinssPublicRailDispatcher { contract_address: e.rail };
    assert(rail.get_custody_parties(CUSTODY) == (addr(PAYER), addr(PAYEE)), 'WRONG_PARTIES');
    start_cheat_block_timestamp(e.rekber, 2001);
    rail.act_custody([3, CUSTODY, 13, 100].span());
    assert(
        token.balance_of(e.rekber) == 0 && token.allowance(e.rekber, e.rail) == 0,
        'REFUND_UNDRAINED',
    );
    assert(token.balance_of(addr(TREASURY)) == FEE.into(), 'REFUND_CHANGED_REVENUE');
}
#[test]
fn payee_fulfills_and_releases_to_bound_payee() {
    let e = setup();
    fund(e);
    let rail = IVinssPublicRailDispatcher { contract_address: e.rail };
    start_cheat_caller_address(e.rail, addr(PAYEE));
    rail.act_custody([4, CUSTODY, 18, 123].span());
    rail.act_custody([2, CUSTODY, 11, 12, 100].span());
    let token = IMockClaimERC20Dispatcher { contract_address: e.token };
    assert(
        token
            .balance_of(addr(PAYEE)) == (PRINCIPAL + 10 * FEE - 1_000_000_000_000_000_000_u128)
            .into(),
        'WRONG_PAYEE',
    );
    assert(
        token.balance_of(addr(TREASURY)) == (FEE + 1_000_000_000_000_000_000_u128).into(),
        'WORKFLOW_FEE_MISSING',
    );
    assert(token.allowance(e.rekber, e.rail) == 0, 'STALE_ALLOWANCE');
}
#[test]
#[should_panic(expected: 'ALREADY_INITIALIZED')]
fn configuration_cannot_change() {
    initialize(setup());
}
#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn public_secret_does_not_allow_wrong_payee_fulfillment() {
    let e = setup();
    fund(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([4, CUSTODY, 18, 123].span());
}
#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn copied_refund_secret_does_not_authorize_payee() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYEE));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([3, CUSTODY, 13, 100].span());
}
#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn third_party_cannot_open_dispute() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([6, CUSTODY, 1, 15, 22].span());
}
#[test]
#[should_panic(expected: 'BAD_ROLE')]
fn invalid_resolution_role_rejected() {
    let e = setup();
    fund(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([10, CUSTODY, 3, 13, 100].span());
}
#[test]
#[should_panic(expected: 'CUSTODY_ALREADY_BOUND')]
fn funded_roles_cannot_be_rebound() {
    let e = setup();
    fund(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .fund_custody(deposit(e).span(), addr(OTHER));
}
#[test]
#[should_panic(expected: 'FEE_QUOTE_MISMATCH')]
fn wrong_flat_quote_rejected() {
    let e = setup();
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(
            [0, invite_commitment(e, PAYER, INVITE_KEY), 2000, (FEE / 2 + 1).into(), 99].span(),
            INVITE_KEY,
        );
}
#[test]
#[should_panic(expected: 'BAD_CALLDATA')]
fn malformed_funding_rejected() {
    let e = setup();
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .fund_custody([1, 2].span(), addr(PAYEE));
}
#[test]
#[should_panic(expected: 'CUSTODY_NOT_BOUND')]
fn arbitrary_existing_shield_custody_cannot_be_used() {
    let e = setup();
    IVinssPublicRailDispatcher { contract_address: e.rail }.act_custody([3, 999, 13, 100].span());
}

#[test]
#[should_panic(expected: 'UNEXPECTED_OUTPUT')]
fn malicious_missing_output_rejected() {
    let e = setup_with_mode(1);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
}

#[test]
#[should_panic(expected: 'UNEXPECTED_OUTPUT')]
fn malicious_extra_output_rejected() {
    let e = setup_with_mode(2);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
}

#[test]
#[should_panic(expected: 'OUTPUT_MISMATCH')]
fn malicious_wrong_token_output_rejected() {
    let e = setup_with_mode(3);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
}

#[test]
#[should_panic(expected: 'OUTPUT_MISMATCH')]
fn malicious_wrong_id_output_rejected() {
    let e = setup_with_mode(4);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
}

#[test]
#[should_panic(expected: 'OUTPUT_MISMATCH')]
fn malicious_wrong_amount_output_rejected() {
    let e = setup_with_mode(5);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
}

#[test]
#[should_panic(expected: 'ALLOWANCE_NOT_EXACT')]
fn malicious_excess_allowance_output_rejected() {
    let e = setup_with_mode(6);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
}

#[test]
#[should_panic(expected: 'MOCK_ALLOWANCE_LOW')]
fn missing_account_approval_reverts() {
    let e = setup();
    start_cheat_caller_address(e.token, addr(PAYER));
    IMockClaimERC20Dispatcher { contract_address: e.token }.approve(e.rail, 0);
    stop_cheat_caller_address(e.token);
    fund(e);
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn wrong_role_action_2_payer_rejected() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYER));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([2, CUSTODY, 11, 12, 100].span());
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn wrong_role_action_5_payee_rejected() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYEE));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([5, CUSTODY, 14, 123].span());
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn wrong_role_action_7_payee_rejected() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYEE));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([7, CUSTODY, 18, 123].span());
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn wrong_role_action_8_payer_rejected() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYER));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([8, CUSTODY, 12, 100].span());
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn wrong_role_action_9_payee_rejected() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYEE));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([9, CUSTODY, 13, 17, 100].span());
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn wrong_role_action_10_payee_rejected() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYEE));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([10, CUSTODY, 1, 13, 100].span());
}

#[test]
#[should_panic(expected: 'UNAUTHORIZED_ACTOR')]
fn wrong_role_action_10_payer_rejected() {
    let e = setup();
    fund(e);
    start_cheat_caller_address(e.rail, addr(PAYER));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([10, CUSTODY, 2, 12, 100].span());
}

#[test]
fn encrypted_message_offer_and_escrow_action_keep_helpers_and_drain_fees() {
    let e = setup();
    let rail = IVinssPublicRailDispatcher { contract_address: e.rail };
    message(e, PAYER, 101);
    let mut offer = envelope(e, PAYER, 102, 'VINSS_OFFER_COMMIT_V2', 888);
    offer.append((FEE / 2).into());
    offer.append(100);
    rail.post_offer(offer.span(), 102);
    rail
        .post_escrow_action(
            envelope(e, PAYER, 103, 'VINSS_PRIVATE_ESCROW_COMMIT_V2', 999).span(), 0, 103,
        );
    let token = IMockClaimERC20Dispatcher { contract_address: e.token };
    assert(token.balance_of(addr(TREASURY)) == FEE.into(), 'WRONG_CIPHERTEXT_FEES');
    assert(
        token.allowance(e.message, e.rail) == 0 && token.allowance(e.offer, e.rail) == 0,
        'CIPHERTEXT_UNDRAINED',
    );
}

#[test]
#[should_panic(expected: 'NOT_INITIALIZED')]
fn inert_adapter_rejects_user_operations() {
    let token = deploy("MockClaimERC20", array![]);
    let rail = deploy("VinssPublicRail", array![ADMIN, TREASURY, token.into()]);
    IVinssPublicRailDispatcher { contract_address: rail }.consume_invite(77, 1, 1);
}
#[test]
#[should_panic(expected: 'UNAUTHORIZED_ADMIN')]
fn unrelated_account_cannot_initialize() {
    let token = deploy("MockClaimERC20", array![]);
    let rail = deploy("VinssPublicRail", array![ADMIN, TREASURY, token.into()]);
    start_cheat_caller_address(rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: rail }
        .initialize(token, token, token, token, token, token);
}
#[test]
#[should_panic(expected: 'HELPER_POOL_MISMATCH')]
fn shield_pool_helpers_cannot_be_attached() {
    let token = deploy("MockClaimERC20", array![]);
    let policy = deploy("MockFeePolicy", array![FEE.into(), 1_000_000]);
    let rail = deploy("VinssPublicRail", array![ADMIN, TREASURY, token.into()]);
    let helper = deploy("MockPublicHelper", array![OTHER, token.into(), policy.into(), 1]);
    start_cheat_caller_address(rail, addr(ADMIN));
    IVinssPublicRailDispatcher { contract_address: rail }
        .initialize(helper, helper, helper, helper, helper, policy);
}
#[test]
#[should_panic(expected: 'FEE_QUOTE_MISMATCH')]
fn underquoted_rekber_deposit_rejected_before_funding() {
    let e = setup();
    let original = deposit(e);
    let mut changed = array![];
    for i in 0..22_usize {
        changed.append(if i == 20 {
            (FEE - 1).into()
        } else {
            *original.at(i)
        });
    }
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .fund_custody(changed.span(), addr(PAYEE));
}
#[test]
#[should_panic(expected: 'BAD_WORKFLOW_FEE')]
fn workflow_fee_is_bounded() {
    let e = setup();
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .post_escrow_action(
            envelope(e, PAYER, 103, 'VINSS_PRIVATE_ESCROW_COMMIT_V2', 999).span(), 2, 103,
        );
}

#[test]
fn signed_invite_consume_records_adapter_status_without_disclosing_secret() {
    let e = setup();
    let commitment = make_invite(e);
    consume(e, commitment);
    let rail = IVinssPublicRailDispatcher { contract_address: e.rail };
    assert(rail.get_invite_consumer(commitment) == addr(PAYER), 'WRONG_CONSUMER');
    assert(rail.get_invite(commitment).consumed, 'ADAPTER_STATUS_MISSING');
    assert(
        !IVinssInviteDispatcher { contract_address: e.invite }.get_invite(commitment).consumed,
        'HELPER_CONSUME_UNEXPECTED',
    );
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn copied_consume_signature_cannot_authorize_another_caller() {
    let e = setup();
    let commitment = make_invite(e);
    let (r, s) = signature_for(CHAIN, e.rail, PAYER, commitment, 1);
    start_cheat_caller_address(e.rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: e.rail }.consume_invite(commitment, r, s);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn delayed_copied_signature_still_cannot_authorize_attacker() {
    let e = setup();
    let commitment = make_invite(e);
    let (r, s) = signature_for(CHAIN, e.rail, PAYER, commitment, 1);
    start_cheat_block_number(e.rail, 1000);
    start_cheat_caller_address(e.rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: e.rail }.consume_invite(commitment, r, s);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn signature_for_other_chain_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    let (r, s) = signature_for('SN_MAIN', e.rail, PAYER, commitment, 1);
    IVinssPublicRailDispatcher { contract_address: e.rail }.consume_invite(commitment, r, s);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn signature_for_other_adapter_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    let (r, s) = signature_for(CHAIN, addr(OTHER), PAYER, commitment, 1);
    IVinssPublicRailDispatcher { contract_address: e.rail }.consume_invite(commitment, r, s);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn wrong_invite_private_key_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    let (r, s) = signature_for(CHAIN, e.rail, PAYER, commitment, 2);
    IVinssPublicRailDispatcher { contract_address: e.rail }.consume_invite(commitment, r, s);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn zero_signature_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }.consume_invite(commitment, 0, 0);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn out_of_range_signature_r_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .consume_invite(commitment, SIGNING_BOUND.try_into().unwrap(), 1);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_SIGNATURE')]
fn out_of_range_signature_s_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .consume_invite(commitment, INVITE_KEY, core::ec::stark_curve::ORDER);
}
#[test]
#[should_panic(expected: 'INVITE_EXPIRED')]
fn expired_signed_invite_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    start_cheat_block_timestamp(e.rail, 2001);
    consume(e, commitment);
}
#[test]
#[should_panic(expected: 'INVITE_CONSUMED')]
fn signed_invite_replay_rejected() {
    let e = setup();
    let commitment = make_invite(e);
    consume(e, commitment);
    consume(e, commitment);
}
#[test]
#[should_panic(expected: 'INVITE_ACTOR_MISMATCH')]
fn copied_invite_create_cannot_squat_creator_commitment() {
    let e = setup();
    start_cheat_caller_address(e.rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), INVITE_KEY);
}
#[test]
#[should_panic(expected: 'INVALID_INVITE_KEY')]
fn zero_invite_key_rejected() {
    let e = setup();
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .create_invite(invite_payload(e).span(), 0);
}
#[test]
#[should_panic(expected: 'LOCATOR_ACTOR_MISMATCH')]
fn copied_message_locator_rejected_before_helper_write() {
    let e = setup();
    let mut data = envelope(e, PAYER, 101, 'VINSS_MSG_COMMIT_V2', 999);
    data.append((FEE / 2).into());
    data.append(99);
    start_cheat_caller_address(e.rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: e.rail }.post_message(data.span(), 101);
}
#[test]
#[should_panic(expected: 'LOCATOR_ACTOR_MISMATCH')]
fn copied_offer_locator_rejected_before_helper_write() {
    let e = setup();
    let mut data = envelope(e, PAYER, 102, 'VINSS_OFFER_COMMIT_V2', 999);
    data.append((FEE / 2).into());
    data.append(99);
    start_cheat_caller_address(e.rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: e.rail }.post_offer(data.span(), 102);
}
#[test]
#[should_panic(expected: 'LOCATOR_ACTOR_MISMATCH')]
fn copied_coordination_locator_rejected_before_helper_write() {
    let e = setup();
    let data = envelope(e, PAYER, 103, 'VINSS_PRIVATE_ESCROW_COMMIT_V2', 999);
    start_cheat_caller_address(e.rail, addr(OTHER));
    IVinssPublicRailDispatcher { contract_address: e.rail }.post_escrow_action(data.span(), 0, 103);
}
#[test]
#[should_panic(expected: 'ZERO_LOCATOR_NONCE')]
fn zero_locator_nonce_rejected() {
    let e = setup();
    message(e, PAYER, 0);
}
#[test]
#[should_panic(expected: 'LOCATOR_ACTOR_MISMATCH')]
fn altered_locator_nonce_rejected() {
    let e = setup();
    let data = envelope(e, PAYER, 103, 'VINSS_PRIVATE_ESCROW_COMMIT_V2', 999);
    IVinssPublicRailDispatcher { contract_address: e.rail }.post_escrow_action(data.span(), 0, 104);
}

fn fund_workflow(e: Env, policy: felt252) {
    let original = deposit(e);
    let mut data = array![];
    for i in 0..22_usize {
        data
            .append(
                if i == 10 {
                    crate::escrow_rekber::commitments::compute_revision_chain_step(CUSTODY, 19)
                } else if i == 15 {
                    policy
                } else if i == 16 {
                    2
                } else if i == 17 {
                    1
                } else {
                    *original.at(i)
                },
            );
    }
    IVinssPublicRailDispatcher { contract_address: e.rail }.fund_custody(data.span(), addr(PAYEE));
}
fn submit_workflow(e: Env) {
    start_cheat_caller_address(e.rail, addr(PAYEE));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([4, CUSTODY, 18, 123].span());
    start_cheat_caller_address(e.rail, addr(PAYER));
}
fn treasury_balance(e: Env) -> u256 {
    IMockClaimERC20Dispatcher { contract_address: e.token }.balance_of(addr(TREASURY))
}
#[test]
fn standalone_confirm_preserves_one_strk_workflow_fee() {
    let e = setup();
    fund_workflow(e, 2);
    submit_workflow(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([5, CUSTODY, 14, 123].span());
    assert(
        treasury_balance(e) == (FEE + 2_000_000_000_000_000_000_u128).into(), 'CONFIRM_FEE_MISSING',
    );
}
#[test]
fn standalone_revision_preserves_one_strk_workflow_fee() {
    let e = setup();
    fund_workflow(e, 1);
    submit_workflow(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([7, CUSTODY, 19, 123].span());
    assert(
        treasury_balance(e) == (FEE + 2_000_000_000_000_000_000_u128).into(),
        'REVISION_FEE_MISSING',
    );
}
#[test]
fn standalone_dispute_preserves_one_strk_workflow_fee() {
    let e = setup();
    fund_workflow(e, 1);
    submit_workflow(e);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([6, CUSTODY, 1, 15, 123].span());
    assert(
        treasury_balance(e) == (FEE + 2_000_000_000_000_000_000_u128).into(), 'DISPUTE_FEE_MISSING',
    );
}
#[test]
fn message_and_confirm_same_transaction_only_charge_message() {
    let e = setup();
    fund_workflow(e, 2);
    submit_workflow(e);
    start_cheat_transaction_hash(e.rail, 100);
    message(e, PAYER, 700);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([5, CUSTODY, 14, 123].span());
    assert(
        treasury_balance(e) == (FEE + 2_000_000_000_000_000_000_u128).into(), 'DOUBLE_CONFIRM_FEE',
    );
}
#[test]
fn message_and_revision_same_transaction_only_charge_message() {
    let e = setup();
    fund_workflow(e, 1);
    submit_workflow(e);
    start_cheat_transaction_hash(e.rail, 100);
    message(e, PAYER, 700);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([7, CUSTODY, 19, 123].span());
    assert(
        treasury_balance(e) == (FEE + 2_000_000_000_000_000_000_u128).into(), 'DOUBLE_REVISION_FEE',
    );
}
#[test]
fn message_from_prior_transaction_does_not_waive_confirm_fee() {
    let e = setup();
    fund_workflow(e, 2);
    submit_workflow(e);
    start_cheat_transaction_hash(e.rail, 100);
    message(e, PAYER, 700);
    start_cheat_transaction_hash(e.rail, 101);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([5, CUSTODY, 14, 123].span());
    assert(
        treasury_balance(e) == (FEE + 3_000_000_000_000_000_000_u128).into(), 'CROSS_TX_FEE_WAIVER',
    );
}
#[test]
fn another_callers_message_does_not_waive_confirm_fee() {
    let e = setup();
    fund_workflow(e, 2);
    submit_workflow(e);
    start_cheat_transaction_hash(e.rail, 100);
    start_cheat_caller_address(e.rail, addr(PAYEE));
    message(e, PAYEE, 700);
    start_cheat_caller_address(e.rail, addr(PAYER));
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([5, CUSTODY, 14, 123].span());
    assert(
        treasury_balance(e) == (FEE + 3_000_000_000_000_000_000_u128).into(),
        'CROSS_CALLER_FEE_WAIVER',
    );
}
#[test]
fn zero_transaction_hash_cannot_waive_confirm_fee() {
    let e = setup();
    fund_workflow(e, 2);
    submit_workflow(e);
    start_cheat_transaction_hash(e.rail, 0);
    message(e, PAYER, 700);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([5, CUSTODY, 14, 123].span());
    assert(
        treasury_balance(e) == (FEE + 3_000_000_000_000_000_000_u128).into(), 'ZERO_TX_FEE_WAIVER',
    );
}
#[test]
fn paid_message_does_not_waive_dispute_fee() {
    let e = setup();
    fund_workflow(e, 1);
    submit_workflow(e);
    start_cheat_transaction_hash(e.rail, 100);
    message(e, PAYER, 700);
    IVinssPublicRailDispatcher { contract_address: e.rail }
        .act_custody([6, CUSTODY, 1, 15, 123].span());
    assert(
        treasury_balance(e) == (FEE + 3_000_000_000_000_000_000_u128).into(), 'DISPUTE_FEE_WAIVED',
    );
}

#[test]
#[feature("safe_dispatcher")]
fn copied_public_posts_cannot_squat_then_genuine_posts_succeed() {
    let e = setup();
    let safe = IVinssPublicRailSafeDispatcher { contract_address: e.rail };
    let mut altered_message = envelope(e, PAYER, 101, 'VINSS_MSG_COMMIT_V2', 999);
    altered_message.append((FEE / 2).into());
    altered_message.append(99);
    let mut altered_offer = envelope(e, PAYER, 102, 'VINSS_OFFER_COMMIT_V2', 999);
    altered_offer.append((FEE / 2).into());
    altered_offer.append(100);
    let altered_action = envelope(e, PAYER, 103, 'VINSS_PRIVATE_ESCROW_COMMIT_V2', 111);
    start_cheat_caller_address(e.rail, addr(OTHER));
    let err_message = safe.post_message(altered_message.span(), 101).unwrap_err();
    assert(*err_message.at(0) == 'LOCATOR_ACTOR_MISMATCH', 'WRONG_MESSAGE_REJECTION');
    reset_guard_at_transaction_boundary(e);
    let err_offer = safe.post_offer(altered_offer.span(), 102).unwrap_err();
    assert(*err_offer.at(0) == 'LOCATOR_ACTOR_MISMATCH', 'WRONG_OFFER_REJECTION');
    reset_guard_at_transaction_boundary(e);
    let err_action = safe.post_escrow_action(altered_action.span(), 0, 103).unwrap_err();
    assert(*err_action.at(0) == 'LOCATOR_ACTOR_MISMATCH', 'WRONG_ACTION_REJECTION');
    reset_guard_at_transaction_boundary(e);
    start_cheat_caller_address(e.rail, addr(PAYER));
    message(e, PAYER, 101);
    let rail = IVinssPublicRailDispatcher { contract_address: e.rail };
    let mut genuine_offer = envelope(e, PAYER, 102, 'VINSS_OFFER_COMMIT_V2', 888);
    genuine_offer.append((FEE / 2).into());
    genuine_offer.append(100);
    rail.post_offer(genuine_offer.span(), 102);
    rail
        .post_escrow_action(
            envelope(e, PAYER, 103, 'VINSS_PRIVATE_ESCROW_COMMIT_V2', 777).span(), 0, 103,
        );
}
#[test]
#[feature("safe_dispatcher")]
fn copied_signed_create_and_delayed_proof_reject_then_genuine_join_succeeds() {
    let e = setup();
    let safe = IVinssPublicRailSafeDispatcher { contract_address: e.rail };
    start_cheat_caller_address(e.rail, addr(OTHER));
    let create_error = safe.create_invite(invite_payload(e).span(), INVITE_KEY).unwrap_err();
    assert(*create_error.at(0) == 'INVITE_ACTOR_MISMATCH', 'WRONG_CREATE_REJECTION');
    reset_guard_at_transaction_boundary(e);
    start_cheat_caller_address(e.rail, addr(PAYER));
    let commitment = make_invite(e);
    let (r, s) = signature_for(CHAIN, e.rail, PAYER, commitment, 1);
    start_cheat_block_number(e.rail, 1000);
    start_cheat_caller_address(e.rail, addr(OTHER));
    let consume_error = safe.consume_invite(commitment, r, s).unwrap_err();
    assert(*consume_error.at(0) == 'INVALID_INVITE_SIGNATURE', 'WRONG_CONSUME_REJECTION');
    reset_guard_at_transaction_boundary(e);
    assert(
        IVinssPublicRailDispatcher { contract_address: e.rail }
            .get_invite_consumer(commitment) == addr(0),
        'ATTACKER_CONSUMED',
    );
    start_cheat_caller_address(e.rail, addr(PAYER));
    consume(e, commitment);
    assert(
        IVinssPublicRailDispatcher { contract_address: e.rail }
            .get_invite_consumer(commitment) == addr(PAYER),
        'GENUINE_JOIN_FAILED',
    );
}

fn reset_guard_at_transaction_boundary(e: Env) {
    // Foundry SafeDispatcher retains writes made before a caught panic. These
    // deliberately rejected calls write only the reentrancy guard before their
    // authorization check; reset that write to model the next independent account
    // transaction, where Starknet rolls back the failed call in its entirety.
    // No locator, ciphertext, consumer, balance or allowance storage is altered.
    snforge_std::store(e.rail, selector!("ReentrancyGuard_entered"), [0].span());
}
