use privacy::objects::OpenNoteDeposit;
use starknet::ContractAddress;

use crate::invite::invite_types::{
    InviteEntry,
    InviteOperation,
};

pub const INVITE_COMMITMENT_TAG: felt252 = 'VINSS_INVITE_V1';

pub mod errors {
    pub const CALLER_NOT_PRIVACY: felt252 = 'CALLER_NOT_PRIVACY';
    pub const ZERO_COMMITMENT: felt252 = 'ZERO_COMMITMENT';
    pub const ZERO_SECRET: felt252 = 'ZERO_SECRET';
    pub const ZERO_EXPIRY: felt252 = 'ZERO_EXPIRY';
    pub const INVITE_EXISTS: felt252 = 'INVITE_EXISTS';
    pub const INVITE_NOT_FOUND: felt252 = 'INVITE_NOT_FOUND';
    pub const INVITE_CONSUMED: felt252 = 'INVITE_CONSUMED';
    pub const INVITE_EXPIRED: felt252 = 'INVITE_EXPIRED';
    pub const BAD_SECRET: felt252 = 'BAD_SECRET';
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
    use core::num::traits::Zero;

    use privacy::objects::OpenNoteDeposit;

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

    use crate::invite::invite_events::{
        InviteConsumed,
        InviteCreated,
    };

    use crate::invite::invite_interfaces::IVinssInvite;

    use crate::invite::invite_types::{
        InviteEntry,
        InviteOperation,
    };

    use super::{
        compute_invite_commitment,
        errors,
    };

    #[storage]
    struct Storage {
        privacy_contract: ContractAddress,
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
        privacy_contract: ContractAddress,
    ) {
        assert(
            privacy_contract.is_non_zero(),
            errors::CALLER_NOT_PRIVACY,
        );

        self.privacy_contract.write(privacy_contract);
    }

    #[abi(embed_v0)]
    impl VinssInviteImpl of IVinssInvite<ContractState> {
        fn get_invite(
            self: @ContractState,
            commitment: felt252,
        ) -> InviteEntry {
            self.invites.read(commitment)
        }

        fn privacy_invoke(
            ref self: ContractState,
            operation: InviteOperation,
            commitment: felt252,
            expires_at: u64,
            secret: felt252,
        ) -> Span<OpenNoteDeposit> {
            assert(
                get_caller_address()
                    == self.privacy_contract.read(),
                errors::CALLER_NOT_PRIVACY,
            );

            match operation {
                InviteOperation::Create => {
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

                    [].span()
                },

                InviteOperation::Consume => {
                    assert(
                        secret != 0,
                        errors::ZERO_SECRET,
                    );

                    let computed =
                        compute_invite_commitment(secret);

                    assert(
                        commitment == computed,
                        errors::BAD_SECRET,
                    );

                    let entry =
                        self.invites.read(computed);

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
                        computed,
                        InviteEntry {
                            consumed: true,
                            ..entry
                        },
                    );

                    self.emit(
                        Event::InviteConsumed(
                            InviteConsumed {
                                commitment: computed,
                            },
                        ),
                    );

                    [].span()
                },
            }
        }
    }
}
