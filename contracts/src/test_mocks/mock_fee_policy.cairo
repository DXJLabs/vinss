#[starknet::interface]
pub trait IMockFeePolicy<TState> {
    fn quote_fee(
        self: @TState,
        action: u8,
    ) -> u128;

    fn quote_fee_usd_micros(
        self: @TState,
        action: u8,
    ) -> u128;
}

#[starknet::contract]
pub mod MockFeePolicy {
    use starknet::storage::{
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    use super::IMockFeePolicy;

    #[storage]
    struct Storage {
        fee: u128,
        fee_usd_micros: u128,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        fee: u128,
        fee_usd_micros: u128,
    ) {
        assert(fee != 0, 'ZERO_MOCK_FEE');
        assert(
            fee_usd_micros != 0,
            'ZERO_MOCK_USD_FEE',
        );
        self.fee.write(fee);
        self.fee_usd_micros.write(
            fee_usd_micros,
        );
    }

    #[abi(embed_v0)]
    impl MockFeePolicyImpl of IMockFeePolicy<ContractState> {
        fn quote_fee(
            self: @ContractState,
            action: u8,
        ) -> u128 {
            let _ = action;
            self.fee.read()
        }

        fn quote_fee_usd_micros(
            self: @ContractState,
            action: u8,
        ) -> u128 {
            let _ = action;
            self.fee_usd_micros.read()
        }
    }
}
