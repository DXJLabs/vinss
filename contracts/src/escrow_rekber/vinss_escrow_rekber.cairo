use crate::escrow_rekber::interfaces::IVinssEscrowRekber;

// VINSS Rekber custody contract.
//
// Core business invariants:
//
// 1. Offer creator is NOT an on-chain role.
//    The encrypted accepted Offer decides who is payer/funder and payee/
//    fulfiller. The public contract receives only their precommitted capabilities.
//
// 2. Before any fulfillment, the payer has a deterministic timeout refund.
//
// 3. Once fulfillment exists, unilateral timeout refund is blocked.
//    A payer can approve, request a bounded revision, open dispute, or reach a
//    mutual refund with the payee.
//
// 4. Payer silence after confirmed fulfillment cannot lock the payee forever.
//    Once the review deadline passes, the payee can auto-release with its
//    private claim capability.
//
// 5. Dispute resolution cannot redirect money to an arbitrary resolver address.
//    The resolver only authorizes an exact payer/payee split. Each side claims
//    its own portion through the Privacy Pool with its already-bound secret.
//
// 6. Service revenue is separated from principal. The service fee is paid at
//    funding and is not part of a later principal refund.
//
// 7. Private business terms/evidence never enter public storage. Only opaque
//    commitments, timestamps, policy class, token, amount, and settlement state
//    are public.
#[starknet::contract]
pub mod VinssEscrowRekber {
    use openzeppelin_security::ReentrancyGuardComponent;
    use openzeppelin_security::ReentrancyGuardComponent::InternalTrait
        as ReentrancyGuardInternalTrait;
    use openzeppelin_interfaces::erc20::{
        IERC20Dispatcher,
        IERC20DispatcherTrait,
    };
    use pragma_lib::abi::{
        IPragmaABIDispatcher,
        IPragmaABIDispatcherTrait,
    };
    use pragma_lib::types::DataType;
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
    use crate::fee_policy::interfaces::{
        IVinssFeePolicyDispatcher,
        IVinssFeePolicyDispatcherTrait,
    };
    use crate::fee_policy::types::FEE_ACTION_REKBER;
    use crate::escrow_rekber::commitments::{
        compute_fulfillment_chain_step,
        compute_payee_claim_commitment,
        compute_payee_dispute_commitment,
        compute_payee_refund_consent_commitment,
        compute_payer_confirmation_commitment,
        compute_payer_dispute_commitment,
        compute_refund_commitment,
        compute_release_authorization_commitment,
        compute_revision_chain_step,
    };
    use crate::escrow_rekber::errors;
    use crate::escrow_rekber::events::{
        EscrowRekberCustodyFunded,
        EscrowRekberCustodyRefunded,
        EscrowRekberCustodyReleased,
        EscrowRekberCustodyResolved,
        EscrowRekberDisputeOpened,
        EscrowRekberDisputeResolutionAuthorized,
        EscrowRekberFulfillmentConfirmed,
        EscrowRekberFulfillmentSubmitted,
        EscrowRekberResolutionClaimed,
        EscrowRekberRevisionRequested,
    };
    use crate::escrow_rekber::types::{
        EscrowRekberCustody,
        POLICY_COUNTERPARTY_CONFIRM,
        POLICY_EXTERNAL_VERIFY,
        POLICY_SUBMISSION_REVIEW,
    };
    use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
    use crate::utils::errors::{
        UNAUTHORIZED_PRIVACY_POOL,
        ZERO_AMOUNT,
        ZERO_NOTE_ID,
        ZERO_TOKEN,
    };
    use crate::utils::validation::assert_non_zero_address;

    // -------------------------------------------------------------------------
    // Private action selectors
    // -------------------------------------------------------------------------
    pub const DEPOSIT_ACTION: felt252 = 1;
    pub const RELEASE_ACTION: felt252 = 2;
    pub const REFUND_ACTION: felt252 = 3;
    pub const SUBMIT_FULFILLMENT_ACTION: felt252 = 4;
    pub const CONFIRM_FULFILLMENT_ACTION: felt252 = 5;
    pub const OPEN_DISPUTE_ACTION: felt252 = 6;
    pub const REQUEST_REVISION_ACTION: felt252 = 7;
    pub const AUTO_RELEASE_ACTION: felt252 = 8;
    pub const MUTUAL_REFUND_ACTION: felt252 = 9;
    pub const CLAIM_RESOLUTION_ACTION: felt252 = 10;

    // -------------------------------------------------------------------------
    // Pricing + bounded workflow limits
    // -------------------------------------------------------------------------
    const FEE_DIVISOR: u128 = 50_u128; // 2%
    const USD_MICROS_SCALE: u128 = 1_000_000_u128;
    const MAX_ORACLE_DECIMALS: u32 = 18_u32;

    const MIN_REVIEW_WINDOW: u64 = 60_u64;
    const MAX_REVIEW_WINDOW: u64 = 30_u64 * 24_u64 * 60_u64 * 60_u64;
    const MAX_FULFILLMENT_WINDOW: u64 = 180_u64 * 24_u64 * 60_u64 * 60_u64;
    const MAX_FULFILLMENT_ROUNDS: u8 = 8_u8;
    const MAX_REVISION_ROUNDS: u8 = 7_u8;

    // Resolution-claim roles.
    const PAYER_ROLE: u8 = 1_u8;
    const PAYEE_ROLE: u8 = 2_u8;

    // Release/refund event modes.
    const RELEASE_MUTUAL: u8 = 1_u8;
    const RELEASE_TIMEOUT: u8 = 2_u8;
    const REFUND_NO_FULFILLMENT: u8 = 1_u8;
    const REFUND_MUTUAL: u8 = 2_u8;

    // OpenZeppelin 3 ReentrancyGuard. This explicit wiring is intentional:
    // every external state-changing Rekber path enters the guard before
    // touching custody accounting or ERC20 allowance.
    component!(
        path: ReentrancyGuardComponent,
        storage: reentrancy_guard,
        event: ReentrancyGuardEvent,
    );

    #[storage]
    struct Storage {
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,


        // Immutable-after-construction trust/configuration boundary.
        privacy_pool: ContractAddress,
        pragma_oracle: ContractAddress,
        revenue_fee_policy: ContractAddress,
        dispute_resolver: ContractAddress,

        // May be zero if POLICY_EXTERNAL_VERIFY is not used.
        external_verifier: ContractAddress,

        // First production release deliberately supports only STRK + USDC.
        strk_token: ContractAddress,
        usdc_token: ContractAddress,
        strk_usd_pair: felt252,
        usdc_usd_pair: felt252,

        // USD minimum uses six decimal places (micros).
        minimum_fee_usd_micros: u128,
        max_oracle_age: u64,
        min_oracle_sources: u32,

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
        EscrowRekberFulfillmentSubmitted: EscrowRekberFulfillmentSubmitted,
        EscrowRekberFulfillmentConfirmed: EscrowRekberFulfillmentConfirmed,
        EscrowRekberRevisionRequested: EscrowRekberRevisionRequested,
        EscrowRekberDisputeOpened: EscrowRekberDisputeOpened,
        EscrowRekberDisputeResolutionAuthorized:
            EscrowRekberDisputeResolutionAuthorized,
        EscrowRekberResolutionClaimed: EscrowRekberResolutionClaimed,
        EscrowRekberCustodyReleased: EscrowRekberCustodyReleased,
        EscrowRekberCustodyRefunded: EscrowRekberCustodyRefunded,
        EscrowRekberCustodyResolved: EscrowRekberCustodyResolved,
    }

    // Configuration is intentionally immutable. A funds-holding contract should
    // not allow an admin to silently swap price feeds, resolver, or supported
    // assets after users have funded custody.
    #[constructor]
    fn constructor(
        ref self: ContractState,
        privacy_pool: ContractAddress,
        pragma_oracle: ContractAddress,
        revenue_fee_policy: ContractAddress,
        dispute_resolver: ContractAddress,
        external_verifier: ContractAddress,
        strk_token: ContractAddress,
        usdc_token: ContractAddress,
        strk_usd_pair: felt252,
        usdc_usd_pair: felt252,
        minimum_fee_usd_micros: u128,
        max_oracle_age: u64,
        min_oracle_sources: u32,
    ) {
        assert_non_zero_address(privacy_pool);
        assert_non_zero_address(pragma_oracle);
        assert_non_zero_address(revenue_fee_policy);
        assert_non_zero_address(dispute_resolver);
        assert_non_zero_address(strk_token);
        assert_non_zero_address(usdc_token);

        assert(strk_token != usdc_token, errors::BAD_ORACLE_CONFIG);
        assert(strk_usd_pair != 0, errors::BAD_ORACLE_CONFIG);
        assert(usdc_usd_pair != 0, errors::BAD_ORACLE_CONFIG);
        assert(minimum_fee_usd_micros != 0, errors::BAD_ORACLE_CONFIG);
        assert(max_oracle_age != 0, errors::BAD_ORACLE_CONFIG);
        assert(min_oracle_sources != 0, errors::BAD_ORACLE_CONFIG);

        self.privacy_pool.write(privacy_pool);
        self.pragma_oracle.write(pragma_oracle);
        self.revenue_fee_policy.write(
            revenue_fee_policy,
        );
        self.dispute_resolver.write(dispute_resolver);
        self.external_verifier.write(external_verifier);

        self.strk_token.write(strk_token);
        self.usdc_token.write(usdc_token);
        self.strk_usd_pair.write(strk_usd_pair);
        self.usdc_usd_pair.write(usdc_usd_pair);

        self.minimum_fee_usd_micros.write(minimum_fee_usd_micros);
        self.max_oracle_age.write(max_oracle_age);
        self.min_oracle_sources.write(min_oracle_sources);
    }

    #[abi(embed_v0)]
    impl VinssEscrowRekberImpl of IVinssEscrowRekber<ContractState> {
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
                self.refund_no_fulfillment(calldata)
            } else if action == SUBMIT_FULFILLMENT_ACTION {
                self.submit_fulfillment(calldata)
            } else if action == CONFIRM_FULFILLMENT_ACTION {
                self.confirm_fulfillment(calldata)
            } else if action == OPEN_DISPUTE_ACTION {
                self.open_dispute(calldata)
            } else if action == REQUEST_REVISION_ACTION {
                self.request_revision(calldata)
            } else if action == AUTO_RELEASE_ACTION {
                self.auto_release(calldata)
            } else if action == MUTUAL_REFUND_ACTION {
                self.mutual_refund(calldata)
            } else if action == CLAIM_RESOLUTION_ACTION {
                self.claim_resolution(calldata)
            } else {
                core::panic_with_felt252(errors::INVALID_ACTION)
            };

            self.reentrancy_guard.end();
            result
        }

        fn compute_release_authorization_commitment(
            self: @ContractState,
            custody_commitment: felt252,
            secret: felt252,
        ) -> felt252 {
            compute_release_authorization_commitment(
                custody_commitment,
                secret,
            )
        }

        fn compute_payee_claim_commitment(
            self: @ContractState,
            custody_commitment: felt252,
            secret: felt252,
        ) -> felt252 {
            compute_payee_claim_commitment(
                custody_commitment,
                secret,
            )
        }

        fn compute_refund_commitment(
            self: @ContractState,
            custody_commitment: felt252,
            secret: felt252,
        ) -> felt252 {
            compute_refund_commitment(
                custody_commitment,
                secret,
            )
        }

        fn quote_rekber_fee(
            self: @ContractState,
            token: ContractAddress,
            principal: u128,
        ) -> u128 {
            self.quote_rekber_fee_internal(
                token,
                principal,
            )
        }

        fn get_privacy_pool(
            self: @ContractState,
        ) -> ContractAddress {
            self.privacy_pool.read()
        }

        fn get_pragma_oracle(
            self: @ContractState,
        ) -> ContractAddress {
            self.pragma_oracle.read()
        }

        fn get_revenue_fee_policy(
            self: @ContractState,
        ) -> ContractAddress {
            self.revenue_fee_policy.read()
        }

        fn get_dispute_resolver(
            self: @ContractState,
        ) -> ContractAddress {
            self.dispute_resolver.read()
        }

        fn get_external_verifier(
            self: @ContractState,
        ) -> ContractAddress {
            self.external_verifier.read()
        }

        fn get_fee_policy(
            self: @ContractState,
        ) -> (u128, u64, u32) {
            (
                self.minimum_fee_usd_micros.read(),
                self.max_oracle_age.read(),
                self.min_oracle_sources.read(),
            )
        }

        fn get_supported_tokens(
            self: @ContractState,
        ) -> (ContractAddress, ContractAddress) {
            (
                self.strk_token.read(),
                self.usdc_token.read(),
            )
        }

        fn custody_exists(
            self: @ContractState,
            custody_commitment: felt252,
        ) -> bool {
            self.custody_exists.read(custody_commitment)
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

        fn confirm_external_fulfillment(
            ref self: ContractState,
            custody_commitment: felt252,
            evidence_commitment: felt252,
        ) {
            assert(
                get_caller_address() == self.external_verifier.read(),
                errors::NOT_EXTERNAL_VERIFIER,
            );

            self.reentrancy_guard.start();

            assert(
                self.custody_exists.read(custody_commitment),
                errors::CUSTODY_NOT_FOUND,
            );

            let mut custody =
                self.custodies.read(custody_commitment);

            assert(!custody.consumed, errors::CUSTODY_CONSUMED);
            assert(!custody.disputed, errors::DISPUTE_ALREADY_OPEN);
            assert(
                custody.verification_policy == POLICY_EXTERNAL_VERIFY,
                errors::INVALID_POLICY,
            );
            assert(
                custody.fulfillment_submitted,
                errors::FULFILLMENT_REQUIRED,
            );
            assert(
                !custody.fulfillment_confirmed,
                errors::FULFILLMENT_ALREADY_CONFIRMED,
            );
            assert(
                evidence_commitment != 0 &&
                    evidence_commitment ==
                        custody.fulfillment_evidence_commitment,
                errors::ZERO_COMMITMENT,
            );

            let now = get_block_timestamp();
            self.start_review(ref custody, now);
            self.custodies.write(custody_commitment, custody);

            self.emit(
                Event::EscrowRekberFulfillmentConfirmed(
                    EscrowRekberFulfillmentConfirmed {
                        custody_commitment,
                        evidence_commitment,
                        review_deadline:
                            custody.review_deadline,
                        timestamp: now,
                    },
                ),
            );

            self.reentrancy_guard.end();
        }

        fn authorize_dispute_resolution(
            ref self: ContractState,
            custody_commitment: felt252,
            resolution_commitment: felt252,
            payer_amount: u128,
            payee_amount: u128,
        ) {
            assert(
                get_caller_address() == self.dispute_resolver.read(),
                errors::NOT_DISPUTE_RESOLVER,
            );

            self.reentrancy_guard.start();

            assert(
                self.custody_exists.read(custody_commitment),
                errors::CUSTODY_NOT_FOUND,
            );

            let mut custody =
                self.custodies.read(custody_commitment);

            assert(!custody.consumed, errors::CUSTODY_CONSUMED);
            assert(custody.disputed, errors::DISPUTE_REQUIRED);
            assert(
                !custody.resolution_authorized,
                errors::RESOLUTION_ALREADY_SET,
            );
            assert(
                resolution_commitment != 0,
                errors::ZERO_COMMITMENT,
            );

            let total: u256 =
                payer_amount.into() + payee_amount.into();

            assert(
                total == custody.amount.into(),
                errors::BAD_RESOLUTION_SPLIT,
            );

            custody.resolution_commitment =
                resolution_commitment;
            custody.resolution_payer_amount =
                payer_amount;
            custody.resolution_payee_amount =
                payee_amount;
            custody.resolution_authorized = true;

            // A zero allocation needs no claim transaction and is treated as
            // already satisfied when deciding whether custody is fully resolved.
            custody.resolution_payer_claimed =
                payer_amount == 0;
            custody.resolution_payee_claimed =
                payee_amount == 0;

            self.custodies.write(
                custody_commitment,
                custody,
            );

            self.emit(
                Event::EscrowRekberDisputeResolutionAuthorized(
                    EscrowRekberDisputeResolutionAuthorized {
                        custody_commitment,
                        resolution_commitment,
                        payer_amount,
                        payee_amount,
                        timestamp:
                            get_block_timestamp(),
                    },
                ),
            );

            self.reentrancy_guard.end();
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        // ---------------------------------------------------------------------
        // Oracle-backed fee quote
        // ---------------------------------------------------------------------

        fn quote_rekber_fee_internal(
            self: @ContractState,
            token: ContractAddress,
            principal: u128,
        ) -> u128 {
            assert(principal != 0, ZERO_AMOUNT);

            let (pair_id, token_decimals) =
                if token == self.strk_token.read() {
                    (
                        self.strk_usd_pair.read(),
                        18_u32,
                    )
                } else if token == self.usdc_token.read() {
                    (
                        self.usdc_usd_pair.read(),
                        6_u32,
                    )
                } else {
                    core::panic_with_felt252(
                        errors::UNSUPPORTED_TOKEN,
                    )
                };

            let oracle = IPragmaABIDispatcher {
                contract_address:
                    self.pragma_oracle.read(),
            };

            let quote = oracle.get_data_median(
                DataType::SpotEntry(pair_id),
            );

            let now = get_block_timestamp();

            assert(
                quote.price != 0,
                errors::ORACLE_ZERO_PRICE,
            );
            assert(
                quote.decimals <= MAX_ORACLE_DECIMALS,
                errors::ORACLE_BAD_DECIMALS,
            );
            assert(
                quote.last_updated_timestamp != 0 &&
                    quote.last_updated_timestamp <= now,
                errors::ORACLE_BAD_TIMESTAMP,
            );
            assert(
                now - quote.last_updated_timestamp <=
                    self.max_oracle_age.read(),
                errors::ORACLE_PRICE_STALE,
            );
            assert(
                quote.num_sources_aggregated >=
                    self.min_oracle_sources.read(),
                errors::ORACLE_SOURCES_LOW,
            );

            match quote.expiration_timestamp {
                Option::Some(expiration) => {
                    // Pragma SpotEntry currently uses Some(0) as the
                    // sentinel for "no expiration".
                    if expiration != 0 {
                        assert(
                            now <= expiration,
                            errors::ORACLE_PRICE_EXPIRED,
                        );
                    }
                },
                Option::None => {},
            };

            let percentage_fee =
                principal / FEE_DIVISOR;

            // Rekber service fee is paid once at FUND and is non-refundable.
            // This dynamic floor reserves enough margin for included terminal
            // paths such as refund, auto-release, dispute and resolution claims.
            let fee_policy = IVinssFeePolicyDispatcher {
                contract_address:
                    self.revenue_fee_policy.read(),
            };

            let dynamic_floor_usd_micros =
                fee_policy.quote_fee_usd_micros(
                    FEE_ACTION_REKBER,
                );

            let configured_floor_usd_micros =
                self.minimum_fee_usd_micros.read();

            let effective_floor_usd_micros =
                if dynamic_floor_usd_micros >
                    configured_floor_usd_micros
                {
                    dynamic_floor_usd_micros
                } else {
                    configured_floor_usd_micros
                };

            let minimum_fee =
                self.usd_floor_to_token_units(
                    effective_floor_usd_micros,
                    quote.price,
                    quote.decimals,
                    token_decimals,
                );

            let fee =
                if percentage_fee >= minimum_fee {
                    percentage_fee
                } else {
                    minimum_fee
                };

            assert(fee != 0, errors::FEE_TOO_SMALL);
            fee
        }

        // Convert configured USD micros into token base units and round UP.
        // Rounding up prevents systematic undercharging on small transactions.
        fn usd_floor_to_token_units(
            self: @ContractState,
            usd_micros: u128,
            oracle_price: u128,
            oracle_decimals: u32,
            token_decimals: u32,
        ) -> u128 {
            let numerator: u256 =
                usd_micros.into() *
                self.pow10(token_decimals) *
                self.pow10(oracle_decimals);

            let denominator: u256 =
                USD_MICROS_SCALE.into() *
                oracle_price.into();

            let quotient = numerator / denominator;
            let remainder = numerator % denominator;

            let rounded =
                if remainder == 0 {
                    quotient
                } else {
                    quotient + 1_u128.into()
                };

            rounded
                .try_into()
                .expect(errors::FEE_OVERFLOW)
        }

        fn pow10(
            self: @ContractState,
            exponent: u32,
        ) -> u256 {
            let mut value: u256 = 1_u128.into();
            let mut index: u32 = 0_u32;

            loop {
                if index == exponent {
                    break;
                }

                value =
                    value * 10_u128.into();
                index += 1_u32;
            };

            value
        }

        // ---------------------------------------------------------------------
        // Deposit
        // ---------------------------------------------------------------------
        //
        // Calldata:
        // [1,
        //  custody,
        //  release_auth_commitment,
        //  payee_claim_commitment,
        //  refund_commitment,
        //  payer_confirmation_commitment,
        //  payer_dispute_commitment,
        //  payee_dispute_commitment,
        //  payee_refund_consent_commitment,
        //  fulfillment_chain_head,
        //  revision_chain_head,
        //  payer_certificate_commitment,
        //  payee_certificate_commitment,
        //  fulfillment_deadline,
        //  review_window,
        //  verification_policy,
        //  fulfillment_rounds,
        //  revision_rounds,
        //  token,
        //  principal,
        //  quoted_fee,
        //  revenue_open_note_id]
        fn deposit_custody(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 22,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);

            assert(
                custody_commitment != 0,
                errors::ZERO_CUSTODY,
            );
            assert(
                !self.custody_exists.read(
                    custody_commitment,
                ),
                errors::DUPLICATE_CUSTODY,
            );

            let release_authorization_commitment =
                *calldata.at(2);
            let payee_claim_commitment =
                *calldata.at(3);
            let refund_commitment =
                *calldata.at(4);
            let payer_confirmation_commitment =
                *calldata.at(5);
            let payer_dispute_commitment =
                *calldata.at(6);
            let payee_dispute_commitment =
                *calldata.at(7);
            let payee_refund_consent_commitment =
                *calldata.at(8);
            let fulfillment_chain_head =
                *calldata.at(9);
            let revision_chain_head =
                *calldata.at(10);
            let payer_certificate_commitment =
                *calldata.at(11);
            let payee_certificate_commitment =
                *calldata.at(12);

            assert(
                release_authorization_commitment != 0 &&
                    payee_claim_commitment != 0 &&
                    refund_commitment != 0 &&
                    payer_confirmation_commitment != 0 &&
                    payer_dispute_commitment != 0 &&
                    payee_dispute_commitment != 0 &&
                    payee_refund_consent_commitment != 0 &&
                    fulfillment_chain_head != 0 &&
                    payer_certificate_commitment != 0 &&
                    payee_certificate_commitment != 0,
                errors::ZERO_COMMITMENT,
            );

            // Revision head may be zero only when the accepted settlement plan
            // explicitly allows zero revisions.
            let fulfillment_deadline: u64 =
                (*calldata.at(13))
                    .try_into()
                    .expect(
                        errors::INVALID_FULFILLMENT_DEADLINE,
                    );

            let review_window: u64 =
                (*calldata.at(14))
                    .try_into()
                    .expect(
                        errors::INVALID_REVIEW_WINDOW,
                    );

            let verification_policy: u8 =
                (*calldata.at(15))
                    .try_into()
                    .expect(errors::INVALID_POLICY);

            let fulfillment_rounds: u8 =
                (*calldata.at(16))
                    .try_into()
                    .expect(errors::INVALID_ROUNDS);

            let revision_rounds: u8 =
                (*calldata.at(17))
                    .try_into()
                    .expect(errors::INVALID_ROUNDS);

            let token: ContractAddress =
                (*calldata.at(18))
                    .try_into()
                    .expect(ZERO_TOKEN);

            assert_non_zero_address(token);

            let amount: u128 =
                (*calldata.at(19))
                    .try_into()
                    .expect(ZERO_AMOUNT);

            let quoted_fee: u128 =
                (*calldata.at(20))
                    .try_into()
                    .expect(errors::FEE_OVERFLOW);

            let revenue_open_note_id =
                *calldata.at(21);

            assert(amount != 0, ZERO_AMOUNT);
            assert(
                revenue_open_note_id != 0,
                ZERO_NOTE_ID,
            );

            let now = get_block_timestamp();

            assert(
                fulfillment_deadline > now &&
                    fulfillment_deadline - now <=
                        MAX_FULFILLMENT_WINDOW,
                errors::INVALID_FULFILLMENT_DEADLINE,
            );
            assert(
                review_window >= MIN_REVIEW_WINDOW &&
                    review_window <= MAX_REVIEW_WINDOW,
                errors::INVALID_REVIEW_WINDOW,
            );
            assert(
                verification_policy ==
                    POLICY_SUBMISSION_REVIEW ||
                    verification_policy ==
                        POLICY_COUNTERPARTY_CONFIRM ||
                    verification_policy ==
                        POLICY_EXTERNAL_VERIFY,
                errors::INVALID_POLICY,
            );
            assert(
                fulfillment_rounds > 0 &&
                    fulfillment_rounds <=
                        MAX_FULFILLMENT_ROUNDS,
                errors::INVALID_ROUNDS,
            );
            assert(
                revision_rounds <=
                    MAX_REVISION_ROUNDS &&
                    revision_rounds <
                        fulfillment_rounds,
                errors::INVALID_ROUNDS,
            );
            assert(
                revision_rounds == 0 ||
                    revision_chain_head != 0,
                errors::ZERO_COMMITMENT,
            );

            // External verification is opt-in. Current VINSS templates do not
            // require it; if a future plan selects it, a verifier must exist.
            if verification_policy ==
                POLICY_EXTERNAL_VERIFY
            {
                assert_non_zero_address(
                    self.external_verifier.read(),
                );
            }

            let required_fee =
                self.quote_rekber_fee_internal(
                    token,
                    amount,
                );

            // Wallet displays this exact quote before funding. If Oracle data
            // changes before inclusion, funding fails atomically and the user
            // retries with a fresh quote instead of paying a surprise amount.
            assert(
                quoted_fee == required_fee,
                errors::FEE_QUOTE_MISMATCH,
            );

            let reserved =
                self.reserved_by_token.read(token);

            let updated_reserved_u256: u256 =
                reserved.into() + amount.into();
            let updated_reserved: u128 =
                updated_reserved_u256
                    .try_into()
                    .expect(
                        errors::RESERVE_INVARIANT,
                    );

            let required_balance: u256 =
                updated_reserved.into() +
                required_fee.into();

            let erc20 = IERC20Dispatcher {
                contract_address: token,
            };
            let contract =
                get_contract_address();
            let balance =
                erc20.balance_of(contract);

            assert(
                balance >= required_balance,
                errors::FUNDS_NOT_RECEIVED,
            );

            self.custodies.write(
                custody_commitment,
                EscrowRekberCustody {
                    custody_commitment,
                    release_authorization_commitment,
                    payee_claim_commitment,
                    refund_commitment,
                    payer_confirmation_commitment,
                    payer_dispute_commitment,
                    payee_dispute_commitment,
                    payee_refund_consent_commitment,
                    fulfillment_chain_head,
                    revision_chain_head,
                    payer_certificate_commitment,
                    payee_certificate_commitment,
                    token,
                    amount,
                    fee_amount: required_fee,
                    fulfillment_deadline,
                    review_window,
                    review_deadline: 0,
                    revision_deadline: 0,
                    verification_policy,
                    fulfillment_rounds_remaining:
                        fulfillment_rounds,
                    revision_rounds_remaining:
                        revision_rounds,
                    fulfillment_evidence_commitment: 0,
                    dispute_evidence_commitment: 0,
                    resolution_commitment: 0,
                    resolution_payer_amount: 0,
                    resolution_payee_amount: 0,
                    fulfillment_submitted: false,
                    fulfillment_confirmed: false,
                    revision_pending: false,
                    disputed: false,
                    resolution_authorized: false,
                    resolution_payer_claimed: false,
                    resolution_payee_claimed: false,
                    consumed: false,
                    refunded: false,
                    created_at: now,
                    fulfilled_at: 0,
                    settled_at: 0,
                },
            );

            self.custody_exists.write(
                custody_commitment,
                true,
            );
            self.reserved_by_token.write(
                token,
                updated_reserved,
            );

            self.emit(
                Event::EscrowRekberCustodyFunded(
                    EscrowRekberCustodyFunded {
                        custody_commitment,
                        token,
                        amount,
                        fulfillment_deadline,
                        timestamp: now,
                        fee_amount: required_fee,
                        review_window,
                        verification_policy,
                    },
                ),
            );

            self.approve_exact(
                token,
                required_fee,
            );

            array![
                OpenNoteDeposit {
                    note_id:
                        revenue_open_note_id,
                    token,
                    amount:
                        required_fee,
                },
            ]
                .span()
        }

        // ---------------------------------------------------------------------
        // Fulfillment
        // ---------------------------------------------------------------------

        fn submit_fulfillment(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 4,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let chain_secret =
                *calldata.at(2);
            let evidence_commitment =
                *calldata.at(3);

            assert(
                custody_commitment != 0,
                errors::ZERO_CUSTODY,
            );
            assert(
                chain_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                evidence_commitment != 0,
                errors::ZERO_COMMITMENT,
            );
            assert(
                self.custody_exists.read(
                    custody_commitment,
                ),
                errors::CUSTODY_NOT_FOUND,
            );

            let mut custody =
                self.custodies.read(
                    custody_commitment,
                );

            assert(
                !custody.consumed,
                errors::CUSTODY_CONSUMED,
            );
            assert(
                !custody.disputed,
                errors::DISPUTE_ALREADY_OPEN,
            );
            assert(
                custody.fulfillment_rounds_remaining > 0,
                errors::INVALID_ROUNDS,
            );

            let now = get_block_timestamp();

            if custody.revision_pending {
                assert(
                    now <= custody.revision_deadline,
                    errors::REVISION_TOO_LATE,
                );
            } else {
                assert(
                    !custody.fulfillment_submitted,
                    errors::FULFILLMENT_EXISTS,
                );
                assert(
                    now < custody.fulfillment_deadline,
                    errors::FULFILLMENT_TOO_LATE,
                );
            }

            assert(
                compute_fulfillment_chain_step(
                    custody_commitment,
                    chain_secret,
                ) == custody.fulfillment_chain_head,
                errors::BAD_CHAIN_SECRET,
            );

            // Move the one-way chain head forward. Revealing this secret does
            // not let an observer derive the next secret.
            custody.fulfillment_chain_head =
                chain_secret;
            custody.fulfillment_rounds_remaining -=
                1_u8;

            custody.fulfillment_evidence_commitment =
                evidence_commitment;
            custody.fulfillment_submitted = true;
            custody.revision_pending = false;
            custody.revision_deadline = 0;
            custody.fulfilled_at = now;

            // Submission-review policy starts review immediately.
            // Physical/off-chain policies wait for payer receipt confirmation.
            if custody.verification_policy ==
                POLICY_SUBMISSION_REVIEW
            {
                self.start_review(
                    ref custody,
                    now,
                );
            } else {
                custody.fulfillment_confirmed =
                    false;
                custody.review_deadline = 0;
            }

            self.custodies.write(
                custody_commitment,
                custody,
            );

            self.emit(
                Event::EscrowRekberFulfillmentSubmitted(
                    EscrowRekberFulfillmentSubmitted {
                        custody_commitment,
                        evidence_commitment,
                        timestamp: now,
                        rounds_remaining:
                            custody
                                .fulfillment_rounds_remaining,
                    },
                ),
            );

            if custody.fulfillment_confirmed {
                self.emit(
                    Event::EscrowRekberFulfillmentConfirmed(
                        EscrowRekberFulfillmentConfirmed {
                            custody_commitment,
                            evidence_commitment,
                            review_deadline:
                                custody.review_deadline,
                            timestamp: now,
                        },
                    ),
                );
            }

            array![].span()
        }

        fn confirm_fulfillment(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 4,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let confirmation_secret =
                *calldata.at(2);
            let evidence_commitment =
                *calldata.at(3);

            assert(
                confirmation_secret != 0,
                errors::ZERO_SECRET,
            );

            let mut custody =
                self.require_open_custody(
                    custody_commitment,
                );

            assert(
                !custody.disputed,
                errors::DISPUTE_ALREADY_OPEN,
            );
            assert(
                custody.verification_policy ==
                    POLICY_COUNTERPARTY_CONFIRM,
                errors::INVALID_POLICY,
            );
            assert(
                custody.fulfillment_submitted,
                errors::FULFILLMENT_REQUIRED,
            );
            assert(
                !custody.fulfillment_confirmed,
                errors::FULFILLMENT_ALREADY_CONFIRMED,
            );
            assert(
                evidence_commitment ==
                    custody.fulfillment_evidence_commitment,
                errors::ZERO_COMMITMENT,
            );
            assert(
                compute_payer_confirmation_commitment(
                    custody_commitment,
                    confirmation_secret,
                ) ==
                    custody.payer_confirmation_commitment,
                errors::BAD_PAYER_CONFIRM,
            );

            let now =
                get_block_timestamp();

            self.start_review(
                ref custody,
                now,
            );

            self.custodies.write(
                custody_commitment,
                custody,
            );

            self.emit(
                Event::EscrowRekberFulfillmentConfirmed(
                    EscrowRekberFulfillmentConfirmed {
                        custody_commitment,
                        evidence_commitment,
                        review_deadline:
                            custody.review_deadline,
                        timestamp: now,
                    },
                ),
            );

            array![].span()
        }

        fn start_review(
            self: @ContractState,
            ref custody: EscrowRekberCustody,
            now: u64,
        ) {
            custody.fulfillment_confirmed =
                true;
            custody.review_deadline =
                now + custody.review_window;
        }

        // ---------------------------------------------------------------------
        // Revision
        // ---------------------------------------------------------------------

        fn request_revision(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 4,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let chain_secret =
                *calldata.at(2);
            let reason_commitment =
                *calldata.at(3);

            assert(
                chain_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                reason_commitment != 0,
                errors::ZERO_COMMITMENT,
            );

            let mut custody =
                self.require_open_custody(
                    custody_commitment,
                );

            assert(
                !custody.disputed,
                errors::DISPUTE_ALREADY_OPEN,
            );

            // Only submission-review deals have a revision workflow.
            // Physical/off-chain receipt disagreement becomes a dispute instead
            // of pretending another "revision" solves a delivery/payment fact.
            assert(
                custody.verification_policy ==
                    POLICY_SUBMISSION_REVIEW,
                errors::REVISION_NOT_ALLOWED,
            );
            assert(
                custody.fulfillment_submitted &&
                    custody.fulfillment_confirmed,
                errors::FULFILLMENT_REQUIRED,
            );
            assert(
                !custody.revision_pending,
                errors::REVISION_REQUIRED,
            );
            assert(
                custody.revision_rounds_remaining > 0 &&
                    custody
                        .fulfillment_rounds_remaining > 0,
                errors::REVISION_NOT_ALLOWED,
            );

            let now =
                get_block_timestamp();

            assert(
                now < custody.review_deadline,
                errors::REVIEW_WINDOW_CLOSED,
            );
            assert(
                compute_revision_chain_step(
                    custody_commitment,
                    chain_secret,
                ) == custody.revision_chain_head,
                errors::BAD_CHAIN_SECRET,
            );

            custody.revision_chain_head =
                chain_secret;
            custody.revision_rounds_remaining -=
                1_u8;

            custody.revision_pending = true;
            custody.fulfillment_confirmed = false;
            custody.review_deadline = 0;
            custody.revision_deadline =
                now + custody.review_window;

            self.custodies.write(
                custody_commitment,
                custody,
            );

            self.emit(
                Event::EscrowRekberRevisionRequested(
                    EscrowRekberRevisionRequested {
                        custody_commitment,
                        reason_commitment,
                        revision_deadline:
                            custody.revision_deadline,
                        timestamp: now,
                        rounds_remaining:
                            custody.revision_rounds_remaining,
                    },
                ),
            );

            array![].span()
        }

        // ---------------------------------------------------------------------
        // Dispute
        // ---------------------------------------------------------------------

        fn open_dispute(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 5,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let role: u8 =
                (*calldata.at(2))
                    .try_into()
                    .expect(
                        errors::DISPUTE_NOT_ALLOWED,
                    );
            let dispute_secret =
                *calldata.at(3);
            let evidence_commitment =
                *calldata.at(4);

            assert(
                dispute_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                evidence_commitment != 0,
                errors::ZERO_COMMITMENT,
            );

            let mut custody =
                self.require_open_custody(
                    custody_commitment,
                );

            assert(
                custody.fulfillment_submitted,
                errors::DISPUTE_NOT_ALLOWED,
            );
            assert(
                !custody.disputed,
                errors::DISPUTE_ALREADY_OPEN,
            );

            let now = get_block_timestamp();

            // At the exact review deadline AUTO_RELEASE becomes valid. A new
            // dispute is therefore valid only strictly before that boundary.
            if custody.fulfillment_confirmed &&
                custody.review_deadline != 0
            {
                assert(
                    now < custody.review_deadline,
                    errors::REVIEW_WINDOW_CLOSED,
                );
            }

            let valid =
                if role == PAYER_ROLE {
                    compute_payer_dispute_commitment(
                        custody_commitment,
                        dispute_secret,
                    ) ==
                        custody
                            .payer_dispute_commitment
                } else if role == PAYEE_ROLE {
                    compute_payee_dispute_commitment(
                        custody_commitment,
                        dispute_secret,
                    ) ==
                        custody
                            .payee_dispute_commitment
                } else {
                    false
                };

            assert(
                valid,
                errors::BAD_DISPUTE_SECRET,
            );

            custody.disputed = true;
            custody.dispute_evidence_commitment =
                evidence_commitment;

            self.custodies.write(
                custody_commitment,
                custody,
            );

            self.emit(
                Event::EscrowRekberDisputeOpened(
                    EscrowRekberDisputeOpened {
                        custody_commitment,
                        evidence_commitment,
                        opened_by_role: role,
                        timestamp: now,
                    },
                ),
            );

            array![].span()
        }

        // ---------------------------------------------------------------------
        // Clean release
        // ---------------------------------------------------------------------

        fn release_custody(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 5,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let release_authorization_secret =
                *calldata.at(2);
            let payee_claim_secret =
                *calldata.at(3);
            let output_note_id =
                *calldata.at(4);

            assert(
                release_authorization_secret != 0 &&
                    payee_claim_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                output_note_id != 0,
                ZERO_NOTE_ID,
            );

            let custody =
                self.require_open_custody(
                    custody_commitment,
                );

            // Once resolver authorization exists, only CLAIM_RESOLUTION may
            // consume the remaining principal.
            assert(
                !custody.resolution_authorized,
                errors::RESOLUTION_ALREADY_SET,
            );

            // Full mutual release is safe even after a disagreement: both
            // precommitted sides explicitly consent to paying the payee.
            // It is blocked only after a partial dispute payout has started.
            assert(
                !custody.resolution_payer_claimed &&
                    !custody.resolution_payee_claimed,
                errors::RESOLUTION_ALREADY_SET,
            );
            assert(
                custody.fulfillment_submitted &&
                    custody.fulfillment_confirmed &&
                    !custody.revision_pending,
                errors::FULFILLMENT_NOT_CONFIRMED,
            );

            assert(
                compute_release_authorization_commitment(
                    custody_commitment,
                    release_authorization_secret,
                ) ==
                    custody
                        .release_authorization_commitment,
                errors::BAD_RELEASE_AUTH,
            );
            assert(
                compute_payee_claim_commitment(
                    custody_commitment,
                    payee_claim_secret,
                ) ==
                    custody.payee_claim_commitment,
                errors::BAD_PAYEE_CLAIM,
            );

            self.finalize_full_output(
                custody,
                output_note_id,
                false,
                RELEASE_MUTUAL,
                get_block_timestamp(),
            )
        }

        // Payee protection against payer silence after a confirmed fulfillment.
        fn auto_release(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 4,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let payee_claim_secret =
                *calldata.at(2);
            let output_note_id =
                *calldata.at(3);

            assert(
                payee_claim_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                output_note_id != 0,
                ZERO_NOTE_ID,
            );

            let custody =
                self.require_open_custody(
                    custody_commitment,
                );

            assert(
                !custody.disputed,
                errors::DISPUTE_ALREADY_OPEN,
            );
            assert(
                custody.fulfillment_submitted &&
                    custody.fulfillment_confirmed &&
                    !custody.revision_pending,
                errors::FULFILLMENT_NOT_CONFIRMED,
            );
            assert(
                custody.review_deadline != 0,
                errors::REVIEW_NOT_STARTED,
            );

            let now =
                get_block_timestamp();

            assert(
                now >= custody.review_deadline,
                errors::REVIEW_NOT_FINISHED,
            );
            assert(
                compute_payee_claim_commitment(
                    custody_commitment,
                    payee_claim_secret,
                ) ==
                    custody.payee_claim_commitment,
                errors::BAD_PAYEE_CLAIM,
            );

            self.finalize_full_output(
                custody,
                output_note_id,
                false,
                RELEASE_TIMEOUT,
                now,
            )
        }

        // ---------------------------------------------------------------------
        // Refund
        // ---------------------------------------------------------------------

        // Payer timeout refund exists only before fulfillment.
        fn refund_no_fulfillment(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 4,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let refund_secret =
                *calldata.at(2);
            let output_note_id =
                *calldata.at(3);

            assert(
                refund_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                output_note_id != 0,
                ZERO_NOTE_ID,
            );

            let custody =
                self.require_open_custody(
                    custody_commitment,
                );

            assert(
                !custody.fulfillment_submitted,
                errors::REFUND_BLOCKED_BY_FULFILLMENT,
            );
            assert(
                !custody.disputed,
                errors::REFUND_BLOCKED_BY_DISPUTE,
            );

            let now =
                get_block_timestamp();

            assert(
                now >= custody.fulfillment_deadline,
                errors::REFUND_TOO_EARLY,
            );
            assert(
                compute_refund_commitment(
                    custody_commitment,
                    refund_secret,
                ) ==
                    custody.refund_commitment,
                errors::BAD_REFUND_SECRET,
            );

            self.finalize_full_output(
                custody,
                output_note_id,
                true,
                REFUND_NO_FULFILLMENT,
                now,
            )
        }

        // Both parties may mutually cancel at any point before a partial
        // dispute payout has begun. This is the safe refund path after
        // fulfillment because the payee explicitly consents.
        fn mutual_refund(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 5,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let refund_secret =
                *calldata.at(2);
            let payee_consent_secret =
                *calldata.at(3);
            let output_note_id =
                *calldata.at(4);

            assert(
                refund_secret != 0 &&
                    payee_consent_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                output_note_id != 0,
                ZERO_NOTE_ID,
            );

            let custody =
                self.require_open_custody(
                    custody_commitment,
                );

            // Resolver authorization is final. After an exact split has been
            // authorized, funds may leave only through CLAIM_RESOLUTION.
            assert(
                !custody.resolution_authorized,
                errors::RESOLUTION_ALREADY_SET,
            );

            assert(
                !custody.resolution_payer_claimed &&
                    !custody.resolution_payee_claimed,
                errors::RESOLUTION_ALREADY_SET,
            );

            assert(
                compute_refund_commitment(
                    custody_commitment,
                    refund_secret,
                ) ==
                    custody.refund_commitment,
                errors::BAD_REFUND_SECRET,
            );
            assert(
                compute_payee_refund_consent_commitment(
                    custody_commitment,
                    payee_consent_secret,
                ) ==
                    custody
                        .payee_refund_consent_commitment,
                errors::BAD_REFUND_CONSENT,
            );

            self.finalize_full_output(
                custody,
                output_note_id,
                true,
                REFUND_MUTUAL,
                get_block_timestamp(),
            )
        }

        // ---------------------------------------------------------------------
        // Dispute split claim
        // ---------------------------------------------------------------------

        fn claim_resolution(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(
                calldata.len() == 5,
                errors::INVALID_CALLDATA,
            );

            let custody_commitment =
                *calldata.at(1);
            let role: u8 =
                (*calldata.at(2))
                    .try_into()
                    .expect(
                        errors::BAD_RESOLUTION_SPLIT,
                    );
            let party_secret =
                *calldata.at(3);
            let output_note_id =
                *calldata.at(4);

            assert(
                party_secret != 0,
                errors::ZERO_SECRET,
            );
            assert(
                output_note_id != 0,
                ZERO_NOTE_ID,
            );

            let mut custody =
                self.require_open_custody(
                    custody_commitment,
                );

            assert(
                custody.disputed,
                errors::DISPUTE_REQUIRED,
            );
            assert(
                custody.resolution_authorized,
                errors::RESOLUTION_NOT_SET,
            );

            let claim_amount =
                if role == PAYER_ROLE {
                    assert(
                        !custody
                            .resolution_payer_claimed,
                        errors::CUSTODY_CONSUMED,
                    );
                    assert(
                        custody
                            .resolution_payer_amount > 0,
                        errors::BAD_RESOLUTION_SPLIT,
                    );
                    assert(
                        compute_refund_commitment(
                            custody_commitment,
                            party_secret,
                        ) ==
                            custody
                                .refund_commitment,
                        errors::BAD_REFUND_SECRET,
                    );

                    custody
                        .resolution_payer_claimed =
                        true;
                    custody.resolution_payer_amount
                } else if role == PAYEE_ROLE {
                    assert(
                        !custody
                            .resolution_payee_claimed,
                        errors::CUSTODY_CONSUMED,
                    );
                    assert(
                        custody
                            .resolution_payee_amount > 0,
                        errors::BAD_RESOLUTION_SPLIT,
                    );
                    assert(
                        compute_payee_claim_commitment(
                            custody_commitment,
                            party_secret,
                        ) ==
                            custody
                                .payee_claim_commitment,
                        errors::BAD_PAYEE_CLAIM,
                    );

                    custody
                        .resolution_payee_claimed =
                        true;
                    custody.resolution_payee_amount
                } else {
                    core::panic_with_felt252(
                        errors::BAD_RESOLUTION_SPLIT,
                    )
                };

            let now =
                get_block_timestamp();

            // Decrease reserve and expose only this party's authorized share.
            self.prepare_partial_output(
                ref custody,
                claim_amount,
                output_note_id,
            );

            self.emit(
                Event::EscrowRekberResolutionClaimed(
                    EscrowRekberResolutionClaimed {
                        custody_commitment,
                        role,
                        output_note_id,
                        amount:
                            claim_amount,
                        timestamp: now,
                    },
                ),
            );

            // Once all nonzero allocations have been claimed, close custody.
            if custody.resolution_payer_claimed &&
                custody.resolution_payee_claimed
            {
                custody.consumed = true;
                custody.refunded =
                    custody
                        .resolution_payee_amount == 0;
                custody.settled_at = now;

                self.emit(
                    Event::EscrowRekberCustodyResolved(
                        EscrowRekberCustodyResolved {
                            custody_commitment,
                            resolution_commitment:
                                custody
                                    .resolution_commitment,
                            payer_amount:
                                custody
                                    .resolution_payer_amount,
                            payee_amount:
                                custody
                                    .resolution_payee_amount,
                            timestamp: now,
                        },
                    ),
                );
            }

            self.custodies.write(
                custody_commitment,
                custody,
            );

            array![
                OpenNoteDeposit {
                    note_id:
                        output_note_id,
                    token:
                        custody.token,
                    amount:
                        claim_amount,
                },
            ]
                .span()
        }

        // ---------------------------------------------------------------------
        // Shared accounting
        // ---------------------------------------------------------------------

        fn require_open_custody(
            self: @ContractState,
            custody_commitment: felt252,
        ) -> EscrowRekberCustody {
            assert(
                custody_commitment != 0,
                errors::ZERO_CUSTODY,
            );
            assert(
                self.custody_exists.read(
                    custody_commitment,
                ),
                errors::CUSTODY_NOT_FOUND,
            );

            let custody =
                self.custodies.read(
                    custody_commitment,
                );

            assert(
                !custody.consumed,
                errors::CUSTODY_CONSUMED,
            );

            custody
        }

        fn finalize_full_output(
            ref self: ContractState,
            mut custody: EscrowRekberCustody,
            output_note_id: felt252,
            refunded: bool,
            mode: u8,
            now: u64,
        ) -> Span<OpenNoteDeposit> {
            assert(
                output_note_id != 0,
                ZERO_NOTE_ID,
            );

            let amount =
                custody.amount;

            self.prepare_partial_output(
                ref custody,
                amount,
                output_note_id,
            );

            custody.consumed = true;
            custody.refunded = refunded;
            custody.settled_at = now;

            self.custodies.write(
                custody.custody_commitment,
                custody,
            );

            if refunded {
                self.emit(
                    Event::EscrowRekberCustodyRefunded(
                        EscrowRekberCustodyRefunded {
                            custody_commitment:
                                custody
                                    .custody_commitment,
                            output_note_id,
                            timestamp: now,
                            refund_mode: mode,
                        },
                    ),
                );
            } else {
                self.emit(
                    Event::EscrowRekberCustodyReleased(
                        EscrowRekberCustodyReleased {
                            custody_commitment:
                                custody
                                    .custody_commitment,
                            output_note_id,
                            timestamp: now,
                            release_mode: mode,
                        },
                    ),
                );
            }

            array![
                OpenNoteDeposit {
                    note_id:
                        output_note_id,
                    token:
                        custody.token,
                    amount,
                },
            ]
                .span()
        }

        // Prepare one exact principal output. State is updated before the
        // Privacy Pool receives allowance, and ReentrancyGuard covers the whole
        // action.
        fn prepare_partial_output(
            ref self: ContractState,
            ref custody: EscrowRekberCustody,
            amount: u128,
            output_note_id: felt252,
        ) {
            assert(amount != 0, ZERO_AMOUNT);
            assert(
                output_note_id != 0,
                ZERO_NOTE_ID,
            );

            let reserved =
                self.reserved_by_token.read(
                    custody.token,
                );

            assert(
                reserved >= amount,
                errors::RESERVE_INVARIANT,
            );

            let erc20 = IERC20Dispatcher {
                contract_address:
                    custody.token,
            };
            let contract =
                get_contract_address();
            let balance =
                erc20.balance_of(contract);

            assert(
                balance >= reserved.into(),
                errors::RESERVE_INVARIANT,
            );

            self.reserved_by_token.write(
                custody.token,
                reserved - amount,
            );

            self.approve_exact(
                custody.token,
                amount,
            );
        }

        fn approve_exact(
            self: @ContractState,
            token: ContractAddress,
            amount: u128,
        ) {
            let erc20 = IERC20Dispatcher {
                contract_address: token,
            };
            let contract =
                get_contract_address();
            let pool =
                self.privacy_pool.read();

            // No stale allowance may survive from an earlier action.
            assert(
                erc20.allowance(
                    contract,
                    pool,
                ) == 0,
                errors::STALE_ALLOWANCE,
            );
            assert(
                erc20.approve(
                    pool,
                    amount.into(),
                ),
                errors::APPROVAL_FAILED,
            );
            assert(
                erc20.allowance(
                    contract,
                    pool,
                ) == amount.into(),
                errors::APPROVAL_NOT_EXACT,
            );
        }
    }
}
