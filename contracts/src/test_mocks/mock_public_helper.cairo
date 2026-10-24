use starknet::ContractAddress;
use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
#[starknet::interface]
pub trait IMockPublicHelper<TState> {
    fn get_privacy_pool(self: @TState) -> ContractAddress;
    fn get_fee_policy(self: @TState) -> ContractAddress;
    fn privacy_invoke(ref self: TState, calldata: Span<felt252>) -> Span<OpenNoteDeposit>;
}
#[starknet::contract]
pub mod MockPublicHelper {
    use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use crate::interfaces::privacy_pool_types::OpenNoteDeposit;
    use super::IMockPublicHelper;
    #[storage]
    struct Storage {
        pool: ContractAddress,
        token: ContractAddress,
        policy: ContractAddress,
        mode: u8,
    }
    #[constructor]
    fn constructor(
        ref self: ContractState,
        pool: ContractAddress,
        token: ContractAddress,
        policy: ContractAddress,
        mode: u8,
    ) {
        self.pool.write(pool);
        self.token.write(token);
        self.policy.write(policy);
        self.mode.write(mode);
    }
    #[abi(embed_v0)]
    impl MockImpl of IMockPublicHelper<ContractState> {
        fn get_privacy_pool(self: @ContractState) -> ContractAddress {
            self.pool.read()
        }
        fn get_fee_policy(self: @ContractState) -> ContractAddress {
            self.policy.read()
        }
        fn privacy_invoke(
            ref self: ContractState, calldata: Span<felt252>,
        ) -> Span<OpenNoteDeposit> {
            assert(get_caller_address() == self.pool.read(), 'WRONG_POOL');
            let fee: u128 = (*calldata.at(3)).try_into().unwrap();
            let mode = self.mode.read();
            let token = self.token.read();
            let allowance = if mode == 6 {
                fee + 1
            } else {
                fee
            };
            IERC20Dispatcher { contract_address: token }
                .approve(self.pool.read(), allowance.into());
            let output = OpenNoteDeposit {
                note_id: if mode == 4 {
                    999
                } else {
                    *calldata.at(4)
                },
                token: if mode == 3 {
                    999.try_into().unwrap()
                } else {
                    token
                },
                amount: if mode == 5 {
                    fee + 1
                } else {
                    fee
                },
            };
            if mode == 1 {
                array![].span()
            } else if mode == 2 {
                array![output, output].span()
            } else {
                array![output].span()
            }
        }
    }
}
