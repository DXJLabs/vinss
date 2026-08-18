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

    use openzeppelin_token::erc20::interface::{
        IERC20Dispatcher,
        IERC20DispatcherTrait,
    };

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

        self.privacy_pool.write(privacy_pool);
        self.open_note_token.write(open_note_token);
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

            // Final felt follows the STRK20 invoke-helper convention:
            // ${openNoteIds[0]}.
            assert(
                calldata.len() >= 2,
                errors::BAD_CALLDATA,
            );

            let open_note_id =
                *calldata.at(calldata.len() - 1);

            let invite_calldata =
                calldata.slice(
                    0,
                    calldata.len() - 1,
                );

            assert(
                invite_calldata.len() >= 1,
                errors::BAD_CALLDATA,
            );

            let operation =
                *invite_calldata.at(0);

            if operation == INVITE_OP_CREATE {
                assert(
                    invite_calldata.len() == 3,
                    errors::BAD_CALLDATA,
                );

                let commitment =
                    *invite_calldata.at(1);

                let expires_at: u64 =
                    (*invite_calldata.at(2))
                        .try_into()
                        .expect(errors::BAD_CALLDATA);

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
            } else {
                assert(
                    operation == INVITE_OP_CONSUME,
                    errors::BAD_OPERATION,
                );

                assert(
                    invite_calldata.len() == 2,
                    errors::BAD_CALLDATA,
                );

                let secret =
                    *invite_calldata.at(1);

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

            // Minimal positive STRK amount used for replay plumbing.
            // 10 wei is returned to the same user; NOT VINSS revenue.
            let open_note_amount: u128 = 10_u128;
            let token = self.open_note_token.read();

            let erc20 = IERC20Dispatcher {
                contract_address: token,
            };

            assert(
                erc20.approve(
                    spender: expected_privacy_pool,
                    amount: open_note_amount.into(),
                ),
                'APPROVE_FAILED',
            );

            [
                OpenNoteDeposit {
                    note_id: open_note_id,
                    token,
                    amount: open_note_amount,
                },
            ]
                .span()
        }

        fn get_privacy_pool(
            self: @ContractState,
        ) -> ContractAddress {
            self.privacy_pool.read()
        }

        fn get_invite(
            self: @ContractState,
            commitment: felt252,
        ) -> InviteEntry {
            self.invites.read(commitment)
        }
    }
}
