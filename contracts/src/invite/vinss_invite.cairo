pub const INVITE_COMMITMENT_TAG: felt252 = 'VINSS_INVITE_V1';

pub const INVITE_OP_CREATE: felt252 = 0;
pub const INVITE_OP_CONSUME: felt252 = 1;

pub mod errors {
    pub const ZERO_ADDRESS: felt252 = 'ZERO_ADDRESS';
    pub const UNAUTHORIZED_POOL: felt252 = 'UNAUTHORIZED_POOL';
    pub const BAD_CALLDATA: felt252 = 'BAD_CALLDATA';
    pub const BAD_OPERATION: felt252 = 'BAD_OPERATION';
    pub const ZERO_COMMITMENT: felt252 = 'ZERO_COMMITMENT';
    pub const ZERO_SECRET: felt252 = 'ZERO_SECRET';
    pub const ZERO_EXPIRY: felt252 = 'ZERO_EXPIRY';
    pub const INVITE_EXISTS: felt252 = 'INVITE_EXISTS';
    pub const INVITE_NOT_FOUND: felt252 = 'INVITE_NOT_FOUND';
    pub const INVITE_CONSUMED: felt252 = 'INVITE_CONSUMED';
    pub const INVITE_EXPIRED: felt252 = 'INVITE_EXPIRED';
}

pub fn compute_invite_commitment(
    secret: felt252,
) -> felt252 {
    core::poseidon::poseidon_hash_span(
        [INVITE_COMMITMENT_TAG, secret].span(),
    )
}

#[starknet::contract]
pub mod VinssInvite {
    use starknet::{
        ContractAddress,
        get_block_timestamp,
        get_caller_address,
    };

    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use openzeppelin_interfaces::erc20::{
        IERC20Dispatcher,
        IERC20DispatcherTrait,
    };

    use crate::fee_policy::interfaces::{
        IVinssFeePolicyDispatcher,
        IVinssFeePolicyDispatcherTrait,
    };
    use crate::fee_policy::types::FEE_ACTION_ROOM_ACTIVATION;
    use crate::interfaces::privacy_pool_types::OpenNoteDeposit;

    use crate::invite::invite_events::{
        InviteConsumed,
        InviteCreated,
    };

    use crate::invite::invite_interfaces::IVinssInvite;
    use crate::invite::invite_types::InviteEntry;

    use super::{
        INVITE_OP_CONSUME,
        INVITE_OP_CREATE,
        compute_invite_commitment,
        errors,
    };

    #[storage]
    struct Storage {
        privacy_pool: ContractAddress,
        open_note_token: ContractAddress,
        fee_policy: ContractAddress,
        invites: Map<felt252, InviteEntry>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        InviteCreated: InviteCreated,
        InviteConsumed: InviteConsumed,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        privacy_pool: ContractAddress,
        open_note_token: ContractAddress,
        fee_policy: ContractAddress,
    ) {
        let zero_address: ContractAddress =
            0.try_into().unwrap();

        assert(
            privacy_pool != zero_address,
            errors::ZERO_ADDRESS,
        );

        assert(
            open_note_token != zero_address,
            errors::ZERO_ADDRESS,
        );
        assert(
            fee_policy != zero_address,
            errors::ZERO_ADDRESS,
        );

        self.privacy_pool.write(privacy_pool);
        self.open_note_token.write(open_note_token);
        self.fee_policy.write(fee_policy);
    }

    #[abi(embed_v0)]
    impl VinssInviteImpl of IVinssInvite<ContractState> {
        fn privacy_invoke(
            ref self: ContractState,
            calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            let expected_privacy_pool =
                self.privacy_pool.read();

            assert(
                get_caller_address()
                    == expected_privacy_pool,
                errors::UNAUTHORIZED_POOL,
            );

            // Invite has no token output, so there is no OPEN note.
            // Replay protection comes from the private note consumed by
            // the accompanying STRK20 withdrawal.
            assert(
                calldata.len() >= 1,
                errors::BAD_CALLDATA,
            );

            let operation =
                *calldata.at(0);

            if operation == INVITE_OP_CREATE {
                // CREATE:
                // [0, commitment, expires_at, quoted_fee, open_note_id]
                assert(
                    calldata.len() == 5,
                    errors::BAD_CALLDATA,
                );

                let commitment =
                    *calldata.at(1);

                let expires_at: u64 =
                    (*calldata.at(2))
                        .try_into()
                        .expect(errors::BAD_CALLDATA);

                let quoted_fee: u128 =
                    (*calldata.at(3))
                        .try_into()
                        .expect(errors::BAD_CALLDATA);

                let open_note_id =
                    *calldata.at(4);

                let fee_policy = IVinssFeePolicyDispatcher {
                    contract_address:
                        self.fee_policy.read(),
                };

                let minimum_fee =
                    fee_policy.quote_fee(
                        FEE_ACTION_ROOM_ACTIVATION,
                    );

                assert(
                    quoted_fee >= minimum_fee,
                    'FEE_QUOTE_TOO_LOW',
                );

                assert(
                    commitment != 0,
                    errors::ZERO_COMMITMENT,
                );

                assert(
                    expires_at != 0,
                    errors::ZERO_EXPIRY,
                );

                assert(
                    expires_at > get_block_timestamp(),
                    errors::INVITE_EXPIRED,
                );

                let existing =
                    self.invites.read(commitment);

                assert(
                    !existing.exists,
                    errors::INVITE_EXISTS,
                );

                self.invites.write(
                    commitment,
                    InviteEntry {
                        expires_at,
                        consumed: false,
                        exists: true,
                    },
                );

                self.emit(
                    Event::InviteCreated(
                        InviteCreated {
                            commitment,
                            expires_at,
                        },
                    ),
                );

                let revenue_token =
                    self.open_note_token.read();

                let erc20 = IERC20Dispatcher {
                    contract_address: revenue_token,
                };

                assert(
                    erc20.approve(
                        spender: expected_privacy_pool,
                        amount: quoted_fee.into(),
                    ),
                    'APPROVE_FAILED',
                );

                return array![
                    OpenNoteDeposit {
                        note_id: open_note_id,
                        token: revenue_token,
                        amount: quoted_fee,
                    },
                ]
                    .span();
            } else {
                assert(
                    operation == INVITE_OP_CONSUME,
                    errors::BAD_OPERATION,
                );

                assert(
                    calldata.len() == 2,
                    errors::BAD_CALLDATA,
                );

                let secret =
                    *calldata.at(1);

                assert(
                    secret != 0,
                    errors::ZERO_SECRET,
                );

                let commitment =
                    compute_invite_commitment(secret);

                let entry =
                    self.invites.read(commitment);

                assert(
                    entry.exists,
                    errors::INVITE_NOT_FOUND,
                );

                assert(
                    !entry.consumed,
                    errors::INVITE_CONSUMED,
                );

                assert(
                    get_block_timestamp()
                        <= entry.expires_at,
                    errors::INVITE_EXPIRED,
                );

                self.invites.write(
                    commitment,
                    InviteEntry {
                        expires_at: entry.expires_at,
                        consumed: true,
                        exists: true,
                    },
                );

                self.emit(
                    Event::InviteConsumed(
                        InviteConsumed {
                            commitment,
                        },
                    ),
                );
            }

            // No asset output from Invite.
            array![].span()
        }

        fn get_privacy_pool(
            self: @ContractState,
        ) -> ContractAddress {
            self.privacy_pool.read()
        }

        fn get_fee_policy(
            self: @ContractState,
        ) -> ContractAddress {
            self.fee_policy.read()
        }

        fn get_invite(
            self: @ContractState,
            commitment: felt252,
        ) -> InviteEntry {
            self.invites.read(commitment)
        }
    }
}
