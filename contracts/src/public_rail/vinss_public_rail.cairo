/// Ordinary account rail over dedicated, unchanged pool-only helper instances.
#[starknet::contract]
pub mod VinssPublicRail {
    use core::ec::EcPointTrait;
    use core::num::traits::Zero;
    use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_security::ReentrancyGuardComponent;
    use openzeppelin_security::ReentrancyGuardComponent::InternalTrait as ReentrancyGuardInternalTrait;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, get_block_timestamp, get_caller_address, get_contract_address, get_tx_info,
    };
    use crate::escrow_rekber::interfaces::{
        IVinssEscrowRekberDispatcher, IVinssEscrowRekberDispatcherTrait,
    };
    use crate::fee_policy::interfaces::{IVinssFeePolicyDispatcher, IVinssFeePolicyDispatcherTrait};
    use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
    use crate::invite::invite_interfaces::{IVinssInviteDispatcher, IVinssInviteDispatcherTrait};
    use crate::invite::invite_types::InviteEntry;
    use crate::messaging::messaging_interfaces::{
        IVinssMessageHelperDispatcher, IVinssMessageHelperDispatcherTrait,
    };
    use crate::offers::offer_interfaces::{
        IVinssOfferHelperDispatcher, IVinssOfferHelperDispatcherTrait,
    };
    use crate::private_escrow::private_escrow_interfaces::{
        IVinssPrivateEscrowHelperDispatcher, IVinssPrivateEscrowHelperDispatcherTrait,
    };
    use crate::public_rail::interfaces::{
        IVinssPublicFeePolicyDispatcher, IVinssPublicFeePolicyDispatcherTrait, IVinssPublicRail,
    };

    component!(
        path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent,
    );
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;
    const WORKFLOW_FEE: u128 = 1_000_000_000_000_000_000;
    const SIGNING_BOUND: u256 = 0x800000000000000000000000000000000000000000000000000000000000000;
    #[storage]
    struct Storage {
        initializer_admin: ContractAddress,
        treasury: ContractAddress,
        fee_token: ContractAddress,
        initialized: bool,
        invite: ContractAddress,
        message: ContractAddress,
        offer: ContractAddress,
        escrow_action: ContractAddress,
        rekber: ContractAddress,
        fee_policy: ContractAddress,
        invite_keys: Map<felt252, felt252>,
        last_message_tx: Map<ContractAddress, felt252>,
        consumers: Map<felt252, ContractAddress>,
        payers: Map<felt252, ContractAddress>,
        payees: Map<felt252, ContractAddress>,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        InviteConsumed: InviteConsumed,
    }
    #[derive(Drop, starknet::Event)]
    struct InviteConsumed {
        #[key]
        commitment: felt252,
        consumer: ContractAddress,
    }
    #[constructor]
    fn constructor(
        ref self: ContractState,
        initializer_admin: ContractAddress,
        treasury: ContractAddress,
        fee_token: ContractAddress,
    ) {
        assert(
            !initializer_admin.is_zero() && !treasury.is_zero() && !fee_token.is_zero(),
            'ZERO_ADDRESS',
        );
        assert(treasury != get_contract_address(), 'INVALID_TREASURY');
        self.initializer_admin.write(initializer_admin);
        self.treasury.write(treasury);
        self.fee_token.write(fee_token);
    }
    #[abi(embed_v0)]
    impl PublicRailImpl of IVinssPublicRail<ContractState> {
        fn initialize(
            ref self: ContractState,
            invite: ContractAddress,
            message: ContractAddress,
            offer: ContractAddress,
            escrow_action: ContractAddress,
            rekber: ContractAddress,
            fee_policy: ContractAddress,
        ) {
            assert(!self.initialized.read(), 'ALREADY_INITIALIZED');
            assert(get_caller_address() == self.initializer_admin.read(), 'UNAUTHORIZED_ADMIN');
            assert(
                !invite.is_zero()
                    && !message.is_zero()
                    && !offer.is_zero()
                    && !escrow_action.is_zero()
                    && !rekber.is_zero()
                    && !fee_policy.is_zero(),
                'ZERO_ADDRESS',
            );
            let address = get_contract_address();
            let i = IVinssInviteDispatcher { contract_address: invite };
            let m = IVinssMessageHelperDispatcher { contract_address: message };
            let o = IVinssOfferHelperDispatcher { contract_address: offer };
            let e = IVinssPrivateEscrowHelperDispatcher { contract_address: escrow_action };
            let r = IVinssEscrowRekberDispatcher { contract_address: rekber };
            assert(
                i.get_privacy_pool() == address
                    && m.get_privacy_pool() == address
                    && o.get_privacy_pool() == address
                    && e.get_privacy_pool() == address
                    && r.get_privacy_pool() == address,
                'HELPER_POOL_MISMATCH',
            );
            assert(
                i.get_fee_policy() == fee_policy
                    && m.get_fee_policy() == fee_policy
                    && o.get_fee_policy() == fee_policy,
                'HELPER_POLICY_MISMATCH',
            );
            let shield_policy = IVinssPublicFeePolicyDispatcher { contract_address: fee_policy }
                .get_shield_policy();
            assert(
                r.get_revenue_fee_policy() == shield_policy && shield_policy != fee_policy,
                'REKBER_POLICY_MISMATCH',
            );
            // All adapter workflow fees use the supported STRK token.
            let (strk, _) = r.get_supported_tokens();
            assert(strk == self.fee_token.read(), 'FEE_TOKEN_MISMATCH');
            self.invite.write(invite);
            self.message.write(message);
            self.offer.write(offer);
            self.escrow_action.write(escrow_action);
            self.rekber.write(rekber);
            self.fee_policy.write(fee_policy);
            self.initialized.write(true);
            self.initializer_admin.write(0.try_into().unwrap());
        }
        fn get_configuration(self: @ContractState) -> Span<ContractAddress> {
            array![
                self.treasury.read(), self.fee_token.read(), self.invite.read(),
                self.message.read(), self.offer.read(), self.escrow_action.read(),
                self.rekber.read(), self.fee_policy.read(),
            ]
                .span()
        }
        fn create_invite(
            ref self: ContractState, calldata: Span<felt252>, claim_public_key: felt252,
        ) {
            self.enter();
            assert(calldata.len() == 5 && *calldata.at(0) == 0, 'BAD_CALLDATA');
            assert(
                claim_public_key != 0 && EcPointTrait::new_nz_from_x(claim_public_key).is_some(),
                'INVALID_INVITE_KEY',
            );
            let commitment = core::poseidon::poseidon_hash_span(
                [
                    'VINSS_PUBLIC_INVITE_V1', get_tx_info().unbox().chain_id,
                    get_contract_address().into(), get_caller_address().into(), claim_public_key,
                ]
                    .span(),
            );
            assert(*calldata.at(1) == commitment, 'INVITE_ACTOR_MISMATCH');
            self.invite_keys.write(commitment, claim_public_key);
            let fee: u128 = (*calldata.at(3)).try_into().expect('BAD_FEE');
            self.check_fee(fee, 1);
            let helper = self.invite.read();
            self.pull(self.fee_token.read(), get_caller_address(), helper, fee.into());
            let outputs = IVinssInviteDispatcher { contract_address: helper }
                .privacy_invoke(calldata);
            self
                .drain(
                    helper,
                    outputs,
                    self.fee_token.read(),
                    fee,
                    *calldata.at(4),
                    self.treasury.read(),
                );
            self.reentrancy_guard.end();
        }
        fn consume_invite(
            ref self: ContractState,
            commitment: felt252,
            signature_r: felt252,
            signature_s: felt252,
        ) {
            self.enter();
            let entry = IVinssInviteDispatcher { contract_address: self.invite.read() }
                .get_invite(commitment);
            assert(entry.exists, 'INVITE_NOT_FOUND');
            assert(self.consumers.read(commitment).is_zero() && !entry.consumed, 'INVITE_CONSUMED');
            assert(get_block_timestamp() <= entry.expires_at, 'INVITE_EXPIRED');
            let key = self.invite_keys.read(commitment);
            assert(key != 0, 'INVALID_INVITE_KEY');
            let r: u256 = signature_r.into();
            let s: u256 = signature_s.into();
            let order: u256 = core::ec::stark_curve::ORDER.into();
            assert(r != 0 && r < SIGNING_BOUND && s != 0 && s < order, 'INVALID_INVITE_SIGNATURE');
            let caller = get_caller_address();
            let digest: u256 = core::poseidon::poseidon_hash_span(
                [
                    'VINSS_PUBLIC_CONSUME_V1', get_tx_info().unbox().chain_id,
                    get_contract_address().into(), caller.into(), commitment,
                ]
                    .span(),
            )
                .into();
            let signing_digest: felt252 = (digest % SIGNING_BOUND).try_into().unwrap();
            assert(
                core::ecdsa::check_ecdsa_signature(signing_digest, key, signature_r, signature_s),
                'INVALID_INVITE_SIGNATURE',
            );
            self.consumers.write(commitment, caller);
            self.emit(InviteConsumed { commitment, consumer: caller });
            self.reentrancy_guard.end();
        }
        fn get_invite(self: @ContractState, commitment: felt252) -> InviteEntry {
            assert(self.initialized.read(), 'NOT_INITIALIZED');
            let entry = IVinssInviteDispatcher { contract_address: self.invite.read() }
                .get_invite(commitment);
            InviteEntry {
                exists: entry.exists,
                expires_at: entry.expires_at,
                consumed: entry.consumed || !self.consumers.read(commitment).is_zero(),
            }
        }
        fn get_invite_consumer(self: @ContractState, commitment: felt252) -> ContractAddress {
            self.consumers.read(commitment)
        }
        fn post_message(ref self: ContractState, calldata: Span<felt252>, locator_nonce: felt252) {
            self.enter();
            self.check_locator(calldata, locator_nonce);
            assert(calldata.len() >= 2, 'BAD_CALLDATA');
            let fee: u128 = (*calldata.at(calldata.len() - 2)).try_into().expect('BAD_FEE');
            self.check_fee(fee, 2);
            let helper = self.message.read();
            self.pull(self.fee_token.read(), get_caller_address(), helper, fee.into());
            let outputs = IVinssMessageHelperDispatcher { contract_address: helper }
                .privacy_invoke(calldata);
            self
                .drain(
                    helper,
                    outputs,
                    self.fee_token.read(),
                    fee,
                    *calldata.at(calldata.len() - 1),
                    self.treasury.read(),
                );
            self
                .last_message_tx
                .write(get_caller_address(), get_tx_info().unbox().transaction_hash);
            self.reentrancy_guard.end();
        }
        fn post_offer(ref self: ContractState, calldata: Span<felt252>, locator_nonce: felt252) {
            self.enter();
            self.check_locator(calldata, locator_nonce);
            assert(calldata.len() >= 2, 'BAD_CALLDATA');
            let fee: u128 = (*calldata.at(calldata.len() - 2)).try_into().expect('BAD_FEE');
            self.check_fee(fee, 3);
            let helper = self.offer.read();
            self.pull(self.fee_token.read(), get_caller_address(), helper, fee.into());
            let outputs = IVinssOfferHelperDispatcher { contract_address: helper }
                .privacy_invoke(calldata);
            self
                .drain(
                    helper,
                    outputs,
                    self.fee_token.read(),
                    fee,
                    *calldata.at(calldata.len() - 1),
                    self.treasury.read(),
                );
            self.reentrancy_guard.end();
        }
        fn post_escrow_action(
            ref self: ContractState,
            calldata: Span<felt252>,
            quoted_workflow_fee: u128,
            locator_nonce: felt252,
        ) {
            self.enter();
            self.check_locator(calldata, locator_nonce);
            assert(
                quoted_workflow_fee == 0 || quoted_workflow_fee == WORKFLOW_FEE, 'BAD_WORKFLOW_FEE',
            );
            let outputs = IVinssPrivateEscrowHelperDispatcher {
                contract_address: self.escrow_action.read(),
            }
                .privacy_invoke(calldata);
            assert(outputs.is_empty(), 'UNEXPECTED_OUTPUT');
            self.workflow_fee(quoted_workflow_fee);
            self.reentrancy_guard.end();
        }
        fn fund_custody(ref self: ContractState, calldata: Span<felt252>, payee: ContractAddress) {
            self.enter();
            assert(calldata.len() == 22 && *calldata.at(0) == 1, 'BAD_CALLDATA');
            let payer = get_caller_address();
            assert(
                !payee.is_zero() && payee != payer && payee != get_contract_address(), 'BAD_PAYEE',
            );
            let commitment = *calldata.at(1);
            assert(self.payers.read(commitment).is_zero(), 'CUSTODY_ALREADY_BOUND');
            let token: ContractAddress = (*calldata.at(18)).try_into().expect('BAD_TOKEN');
            let principal: u128 = (*calldata.at(19)).try_into().expect('BAD_PRINCIPAL');
            let fee: u128 = (*calldata.at(20)).try_into().expect('BAD_FEE');
            let helper = self.rekber.read();
            let rekber = IVinssEscrowRekberDispatcher { contract_address: helper };
            assert(fee == rekber.quote_rekber_fee(token, principal), 'FEE_QUOTE_MISMATCH');
            self.payers.write(commitment, payer);
            self.payees.write(commitment, payee);
            self.pull(token, payer, helper, principal.into() + fee.into());
            let outputs = rekber.privacy_invoke(calldata);
            self.drain(helper, outputs, token, fee, *calldata.at(21), self.treasury.read());
            self.reentrancy_guard.end();
        }
        fn act_custody(ref self: ContractState, calldata: Span<felt252>) {
            self.enter();
            assert(calldata.len() >= 2, 'BAD_CALLDATA');
            let action = *calldata.at(0);
            let commitment = *calldata.at(1);
            let payer = self.payers.read(commitment);
            let payee = self.payees.read(commitment);
            assert(!payer.is_zero(), 'CUSTODY_NOT_BOUND');
            let caller = get_caller_address();
            let role = if action == 6 || action == 10 {
                assert(calldata.len() == 5, 'BAD_CALLDATA');
                let role = *calldata.at(2);
                assert(role == 1 || role == 2, 'BAD_ROLE');
                role
            } else if action == 2 || action == 4 || action == 8 {
                2
            } else if action == 3 || action == 5 || action == 7 || action == 9 {
                1
            } else {
                core::panic_with_felt252('INVALID_ACTION')
            };
            let actor = if role == 1 {
                payer
            } else {
                payee
            };
            assert(caller == actor, 'UNAUTHORIZED_ACTOR');
            let expected_len = if action == 2 || action == 6 || action == 9 || action == 10 {
                5
            } else {
                4
            };
            assert(calldata.len() == expected_len, 'BAD_CALLDATA');
            let helper = self.rekber.read();
            let rekber = IVinssEscrowRekberDispatcher { contract_address: helper };
            let custody = rekber.get_custody(commitment);
            let has_output = action == 2
                || action == 3
                || action == 8
                || action == 9
                || action == 10;
            let amount = if action == 10 {
                if role == 1 {
                    custody.resolution_payer_amount
                } else {
                    custody.resolution_payee_amount
                }
            } else {
                custody.amount
            };
            let outputs = rekber.privacy_invoke(calldata);
            if has_output {
                self
                    .drain(
                        helper,
                        outputs,
                        custody.token,
                        amount,
                        *calldata.at(calldata.len() - 1),
                        actor,
                    );
            } else {
                assert(outputs.is_empty(), 'UNEXPECTED_OUTPUT');
            }
            let tx_hash = get_tx_info().unbox().transaction_hash;
            let message_paid = tx_hash != 0 && self.last_message_tx.read(caller) == tx_hash;
            if action == 4
                || action == 6
                || action == 10
                || ((action == 5 || action == 7) && !message_paid) {
                self.workflow_fee(WORKFLOW_FEE);
            }
            self.reentrancy_guard.end();
        }
        fn get_custody_parties(
            self: @ContractState, commitment: felt252,
        ) -> (ContractAddress, ContractAddress) {
            (self.payers.read(commitment), self.payees.read(commitment))
        }
    }
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn enter(ref self: ContractState) {
            assert(self.initialized.read(), 'NOT_INITIALIZED');
            self.reentrancy_guard.start();
        }
        fn check_locator(self: @ContractState, calldata: Span<felt252>, locator_nonce: felt252) {
            assert(calldata.len() >= 2, 'BAD_CALLDATA');
            assert(locator_nonce != 0, 'ZERO_LOCATOR_NONCE');
            let expected = core::poseidon::poseidon_hash_span(
                [
                    'VINSS_PUBLIC_ACTION_V1', get_tx_info().unbox().chain_id,
                    get_contract_address().into(), get_caller_address().into(), locator_nonce,
                ]
                    .span(),
            );
            assert(*calldata.at(1) == expected, 'LOCATOR_ACTOR_MISMATCH');
        }
        fn check_fee(self: @ContractState, fee: u128, action: u8) {
            assert(
                fee != 0
                    && fee == IVinssFeePolicyDispatcher { contract_address: self.fee_policy.read() }
                        .quote_fee(action),
                'FEE_QUOTE_MISMATCH',
            );
        }
        fn workflow_fee(self: @ContractState, fee: u128) {
            if fee != 0 {
                self
                    .pull(
                        self.fee_token.read(),
                        get_caller_address(),
                        self.treasury.read(),
                        fee.into(),
                    );
            }
        }
        fn pull(
            self: @ContractState,
            token: ContractAddress,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
            let erc20 = IERC20Dispatcher { contract_address: token };
            let before = erc20.balance_of(to);
            assert(erc20.transfer_from(from, to, amount), 'TRANSFER_FAILED');
            assert(erc20.balance_of(to) == before + amount, 'TRANSFER_NOT_EXACT');
        }
        fn drain(
            self: @ContractState,
            helper: ContractAddress,
            outputs: Span<OpenNoteDeposit>,
            token: ContractAddress,
            amount: u128,
            note_id: felt252,
            recipient: ContractAddress,
        ) {
            assert(amount != 0 && outputs.len() == 1, 'UNEXPECTED_OUTPUT');
            let output = *outputs.at(0);
            assert(
                output.token == token && output.amount == amount && output.note_id == note_id,
                'OUTPUT_MISMATCH',
            );
            let erc20 = IERC20Dispatcher { contract_address: token };
            assert(
                erc20.allowance(helper, get_contract_address()) == amount.into(),
                'ALLOWANCE_NOT_EXACT',
            );
            self.pull(token, helper, recipient, amount.into());
            assert(erc20.allowance(helper, get_contract_address()) == 0, 'STALE_ALLOWANCE');
        }
    }
}
