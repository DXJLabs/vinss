use pragma_lib::types::{
    DataType,
    PragmaPricesResponse,
};

/// Minimal Pragma-compatible test oracle.
///
/// Production Rekber calls only `get_data_median`, so tests intentionally mock
/// only that read surface instead of emulating the whole oracle.
#[starknet::interface]
pub trait IMockPragma<TState> {
    fn set_price(
        ref self: TState,
        pair_id: felt252,
        price: u128,
        decimals: u32,
        last_updated_timestamp: u64,
        num_sources_aggregated: u32,
        expiration_timestamp: u64,
    );

    fn get_data_median(
        self: @TState,
        data_type: DataType,
    ) -> PragmaPricesResponse;
}

#[starknet::contract]
pub mod MockPragma {
    use pragma_lib::types::{
        DataType,
        PragmaPricesResponse,
    };
    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
    };

    use super::IMockPragma;

    #[storage]
    struct Storage {
        prices: Map<felt252, u128>,
        decimals: Map<felt252, u32>,
        updated_at: Map<felt252, u64>,
        sources: Map<felt252, u32>,
        expires_at: Map<felt252, u64>,
    }

    #[abi(embed_v0)]
    impl MockPragmaImpl of IMockPragma<ContractState> {
        fn set_price(
            ref self: ContractState,
            pair_id: felt252,
            price: u128,
            decimals: u32,
            last_updated_timestamp: u64,
            num_sources_aggregated: u32,
            expiration_timestamp: u64,
        ) {
            self.prices.write(
                pair_id,
                price,
            );
            self.decimals.write(
                pair_id,
                decimals,
            );
            self.updated_at.write(
                pair_id,
                last_updated_timestamp,
            );
            self.sources.write(
                pair_id,
                num_sources_aggregated,
            );
            self.expires_at.write(
                pair_id,
                expiration_timestamp,
            );
        }

        fn get_data_median(
            self: @ContractState,
            data_type: DataType,
        ) -> PragmaPricesResponse {
            let pair_id =
                match data_type {
                    DataType::SpotEntry(
                        pair_id,
                    ) => pair_id,
                    _ => core::panic_with_felt252(
                        'MOCK_SPOT_ONLY',
                    ),
                };

            let expiration =
                self.expires_at.read(
                    pair_id,
                );

            PragmaPricesResponse {
                price:
                    self.prices.read(
                        pair_id,
                    ),
                decimals:
                    self.decimals.read(
                        pair_id,
                    ),
                last_updated_timestamp:
                    self.updated_at.read(
                        pair_id,
                    ),
                num_sources_aggregated:
                    self.sources.read(
                        pair_id,
                    ),
                expiration_timestamp:
                    if expiration == 0 {
                        Option::None
                    } else {
                        Option::Some(
                            expiration,
                        )
                    },
            }
        }
    }
}
