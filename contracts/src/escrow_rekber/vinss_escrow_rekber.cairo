use crate::escrow_rekber::
    escrow_rekber_interfaces::IVinssEscrowRekber;

#[starknet::contract]
pub mod VinssEscrowRekber {
    use openzeppelin_security::reentrancyguard::ReentrancyGuardComponent;
    use openzeppelin_security::reentrancyguard::
        ReentrancyGuardComponent::InternalTrait
        as ReentrancyGuardInternalTrait;
    use openzeppelin_token::erc20::interface::{
        IERC20Dispatcher,
        IERC20DispatcherTrait,
    };
    use starknet::{
        ContractAddress,
        get_block_timestamp,
        get_caller_address,
        get_contract_address,
    };
    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    use super::IVinssEscrowRekber;
    use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
    use crate::escrow_rekber::
        escrow_rekber_commitments::{
            compute_private_escrow_refund_commitment,
            compute_private_escrow_release_commitment,
        };
    use crate::escrow_rekber::
        escrow_rekber_errors as errors;
    use crate::escrow_rekber::
        escrow_rekber_events::{
            EscrowRekberCustodyFunded,
            EscrowRekberCustodyRefunded,
            EscrowRekberCustodyReleased,
        };
    use crate::escrow_rekber::
        escrow_rekber_types::EscrowRekberCustody;
    use crate::utils::errors::{
        UNAUTHORIZED_PRIVACY_POOL,
        ZERO_AMOUNT,
        ZERO_NOTE_ID,
        ZERO_TOKEN,
    };
    use crate::utils::validation::assert_non_zero_address;

    pub const DEPOSIT_ACTION: felt252 = 1;
    pub const RELEASE_ACTION: felt252 = 2;
    pub const REFUND_ACTION: felt252 = 3;
    const FEE_DIVISOR: u128 = 50_u128;

    component!(
        path: ReentrancyGuardComponent,
        storage: reentrancy_guard,
        event: ReentrancyGuardEvent,
    );

    #[storage]
    struct Storage {
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
        privacy_pool: ContractAddress,
        custodies: Map<felt252, EscrowRekberCustody>,
        custody_exists: Map<felt252, bool>,
        reserved_by_token: Map<ContractAddress, u128>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        EscrowRekberCustodyFunded: EscrowRekberCustodyFunded,
        EscrowRekberCustodyReleased: EscrowRekberCustodyReleased,
        EscrowRekberCustodyRefunded: EscrowRekberCustodyRefunded,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        privacy_pool: ContractAddress,
    ) {
        assert_non_zero_address(privacy_pool);
        self.privacy_pool.write(privacy_pool);
    }

    #[abi(embed_v0)]
    impl VinssEscrowRekberImpl
        of IVinssEscrowRekber<ContractState>
    {
        fn privacy_invoke(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                get_caller_address() == self.privacy_pool.read(),
                UNAUTHORIZED_PRIVACY_POOL,
            );
            assert(!calldata.is_empty(), errors::INVALID_CALLDATA);

            self.reentrancy_guard.start();

            let action = *calldata.at(0);

            let result = if action == DEPOSIT_ACTION {
                self.deposit_custody(calldata)
            } else if action == RELEASE_ACTION {
                self.release_custody(calldata)
            } else if action == REFUND_ACTION {
                self.refund_custody(calldata)
            } else {
                core::panic_with_felt252(errors::INVALID_ACTION)
            };

            self.reentrancy_guard.end();
            result
        }

        fn compute_release_commitment(
            self: @ContractState,
            custody_commitment: felt252,
            release_secret: felt252,
        ) -> felt252 {
            compute_private_escrow_release_commitment(
                custody_commitment,
                release_secret,
            )
        }

        fn compute_refund_commitment(
            self: @ContractState,
            custody_commitment: felt252,
            refund_secret: felt252,
        ) -> felt252 {
            compute_private_escrow_refund_commitment(
                custody_commitment,
                refund_secret,
            )
        }

        fn get_privacy_pool(
            self: @ContractState,
        ) -> ContractAddress {
            self.privacy_pool.read()
        }

        fn custody_exists(
            self: @ContractState,
            custody_commitment: felt252,
        ) -> bool {
            self.custody_exists.read(custody_commitment)
        }

        fn is_consumed(
            self: @ContractState,
            custody_commitment: felt252,
        ) -> bool {
            assert(
                self.custody_exists.read(custody_commitment),
                errors::CUSTODY_NOT_FOUND,
            );

            self.custodies.read(custody_commitment).consumed
        }

        fn get_custody(
            self: @ContractState,
            custody_commitment: felt252,
        ) -> EscrowRekberCustody {
            assert(
                self.custody_exists.read(custody_commitment),
                errors::CUSTODY_NOT_FOUND,
            );

            self.custodies.read(custody_commitment)
        }

        fn get_reserved_amount(
            self: @ContractState,
            token: ContractAddress,
        ) -> u128 {
            self.reserved_by_token.read(token)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Record funds transferred to this helper by the Privacy Pool before
        /// `privacy_invoke` is called.
        fn deposit_custody(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            // [action, custody, release, refund, refund_after,
            //  token, principal, revenue_open_note_id]
            assert(calldata.len() == 8, errors::INVALID_CALLDATA);

            let custody_commitment = *calldata.at(1);
            assert(
                custody_commitment != 0,
                errors::ZERO_CUSTODY_COMMITMENT,
            );
            assert(
                !self.custody_exists.read(custody_commitment),
                errors::DUPLICATE_CUSTODY,
            );

            let release_commitment = *calldata.at(2);
            assert(
                release_commitment != 0,
                errors::ZERO_RELEASE_COMMITMENT,
            );

            let refund_commitment = *calldata.at(3);
            assert(
                refund_commitment != 0,
                errors::ZERO_REFUND_COMMITMENT,
            );

            assert(
                release_commitment != refund_commitment,
                errors::SAME_PATH_COMMITMENTS,
            );

            let refund_after: u64 = (*calldata.at(4))
                .try_into()
                .expect(errors::INVALID_REFUND_AFTER);

            let token: ContractAddress = (*calldata.at(5))
                .try_into()
                .expect(ZERO_TOKEN);

            assert_non_zero_address(token);

            // Principal rekber.
            let amount: u128 = (*calldata.at(6))
                .try_into()
                .expect(ZERO_AMOUNT);

            assert(amount != 0, ZERO_AMOUNT);

            let revenue_open_note_id = *calldata.at(7);
            assert(revenue_open_note_id != 0, ZERO_NOTE_ID);

            // VINSS Rekber revenue = 2%.
            // Principal TIDAK dipotong.
            let fee_amount: u128 = amount / FEE_DIVISOR;

            assert(
                fee_amount != 0,
                errors::FEE_TOO_SMALL,
            );

            let now = get_block_timestamp();

            assert(
                refund_after > now,
                errors::INVALID_REFUND_AFTER,
            );

            let reserved =
                self.reserved_by_token.read(token);

            let updated_reserved =
                reserved + amount;

            let required_balance =
                updated_reserved + fee_amount;

            let erc20 = IERC20Dispatcher {
                contract_address: token,
            };

            let contract = get_contract_address();

            let balance =
                erc20.balance_of(account: contract);

            // Wallet harus mengirim principal + 2%.
            assert(
                balance >= required_balance.into(),
                errors::FUNDS_NOT_RECEIVED,
            );

            self.custodies.write(
                custody_commitment,
                EscrowRekberCustody {
                    custody_commitment,
                    release_commitment,
                    refund_commitment,
                    token,
                    amount,
                    refund_after,
                    consumed: false,
                    refunded: false,
                    created_at: now,
                    settled_at: 0,
                },
            );

            self
                .custody_exists
                .write(custody_commitment, true);

            // Reserve principal saja.
            self
                .reserved_by_token
                .write(token, updated_reserved);

            self.emit(
                Event::EscrowRekberCustodyFunded(
                    EscrowRekberCustodyFunded {
                        custody_commitment,
                        token,
                        amount,
                        refund_after,
                        timestamp: now,
                    },
                ),
            );

            let pool = self.privacy_pool.read();

            assert(
                erc20.allowance(
                    owner: contract,
                    spender: pool,
                ) == 0,
                errors::STALE_ALLOWANCE,
            );

            assert(
                erc20.approve(
                    spender: pool,
                    amount: fee_amount.into(),
                ),
                errors::APPROVAL_FAILED,
            );

            [
                OpenNoteDeposit {
                    note_id: revenue_open_note_id,
                    token,
                    amount: fee_amount,
                },
            ]
                .span()
        }

        /// Release funds to a private output note before the refund boundary.
        fn release_custody(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(calldata.len() == 4, errors::INVALID_CALLDATA);

            let custody_commitment = *calldata.at(1);
            assert(
                custody_commitment != 0,
                errors::ZERO_CUSTODY_COMMITMENT,
            );
            assert(
                self.custody_exists.read(custody_commitment),
                errors::CUSTODY_NOT_FOUND,
            );

            let release_secret = *calldata.at(2);
            assert(release_secret != 0, errors::ZERO_SECRET);

            let output_note_id = *calldata.at(3);
            assert(output_note_id != 0, ZERO_NOTE_ID);

            let custody = self.custodies.read(custody_commitment);
            assert(!custody.consumed, errors::CUSTODY_CONSUMED);

            let now = get_block_timestamp();
            assert(
                now < custody.refund_after,
                errors::RELEASE_WINDOW_CLOSED,
            );

            let computed = compute_private_escrow_release_commitment(
                custody_commitment,
                release_secret,
            );
            assert(
                computed == custody.release_commitment,
                errors::RELEASE_SECRET_MISMATCH,
            );

            self.prepare_output(
                custody,
                output_note_id,
                false,
                now,
            )
        }

        /// Refund funds to a private output note at or after the boundary.
        fn refund_custody(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(calldata.len() == 4, errors::INVALID_CALLDATA);

            let custody_commitment = *calldata.at(1);
            assert(
                custody_commitment != 0,
                errors::ZERO_CUSTODY_COMMITMENT,
            );
            assert(
                self.custody_exists.read(custody_commitment),
                errors::CUSTODY_NOT_FOUND,
            );

            let refund_secret = *calldata.at(2);
            assert(refund_secret != 0, errors::ZERO_SECRET);

            let output_note_id = *calldata.at(3);
            assert(output_note_id != 0, ZERO_NOTE_ID);

            let custody = self.custodies.read(custody_commitment);
            assert(!custody.consumed, errors::CUSTODY_CONSUMED);

            let now = get_block_timestamp();
            assert(
                now >= custody.refund_after,
                errors::REFUND_TOO_EARLY,
            );

            let computed = compute_private_escrow_refund_commitment(
                custody_commitment,
                refund_secret,
            );
            assert(
                computed == custody.refund_commitment,
                errors::REFUND_SECRET_MISMATCH,
            );

            self.prepare_output(
                custody,
                output_note_id,
                true,
                now,
            )
        }

        /// Consume one custody exactly once and grant the configured Pool an
        /// exact allowance for one OpenNoteDeposit.
        fn prepare_output(
            ref self: ContractState,
            mut custody: EscrowRekberCustody,
            output_note_id: felt252,
            refunded: bool,
            now: u64,
        ) -> Span<OpenNoteDeposit> {
            let reserved = self
                .reserved_by_token
                .read(custody.token);

            assert(
                reserved >= custody.amount,
                errors::RESERVE_INVARIANT,
            );

            let erc20 = IERC20Dispatcher {
                contract_address: custody.token,
            };
            let contract = get_contract_address();
            let balance = erc20.balance_of(account: contract);

            assert(
                balance >= reserved.into(),
                errors::RESERVE_INVARIANT,
            );

            let pool = self.privacy_pool.read();

            assert(
                erc20.allowance(
                    owner: contract,
                    spender: pool,
                ) == 0,
                errors::STALE_ALLOWANCE,
            );

            // Checks-effects-interactions. Any failed approval or later Pool
            // pull reverts the full InvokeExternal transaction atomically.
            custody.consumed = true;
            custody.refunded = refunded;
            custody.settled_at = now;

            self
                .custodies
                .write(custody.custody_commitment, custody);
            self
                .reserved_by_token
                .write(
                    custody.token,
                    reserved - custody.amount,
                );

            assert(
                erc20.approve(
                    spender: pool,
                    amount: custody.amount.into(),
                ),
                errors::APPROVAL_FAILED,
            );
            assert(
                erc20.allowance(
                    owner: contract,
                    spender: pool,
                ) == custody.amount.into(),
                errors::APPROVAL_NOT_EXACT,
            );

            if refunded {
                self.emit(
                    Event::EscrowRekberCustodyRefunded(
                        EscrowRekberCustodyRefunded {
                            custody_commitment:
                                custody.custody_commitment,
                            output_note_id,
                            timestamp: now,
                        },
                    ),
                );
            } else {
                self.emit(
                    Event::EscrowRekberCustodyReleased(
                        EscrowRekberCustodyReleased {
                            custody_commitment:
                                custody.custody_commitment,
                            output_note_id,
                            timestamp: now,
                        },
                    ),
                );
            };

            [
                OpenNoteDeposit {
                    note_id: output_note_id,
                    token: custody.token,
                    amount: custody.amount,
                }
            ].span()
        }
    }
}
