use crate::fee_policy::interfaces::IVinssFeePolicy;

#[starknet::contract]
pub mod VinssFeePolicy {
    use pragma_lib::abi::{
        IPragmaABIDispatcher,
        IPragmaABIDispatcherTrait,
    };
    use pragma_lib::types::DataType;
    use starknet::{
        ContractAddress,
        get_block_timestamp,
        get_caller_address,
    };
    use starknet::storage::{
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    use super::IVinssFeePolicy;
    use crate::fee_policy::types::{
        FEE_ACTION_MESSAGE,
        FEE_ACTION_OFFER,
        FEE_ACTION_REKBER,
        FEE_ACTION_ROOM_ACTIVATION,
        FLAT_SPONSOR_MARGIN_MULTIPLIER,
        MESSAGE_USD_MICROS,
        OFFER_USD_MICROS,
        REKBER_MIN_USD_MICROS,
        REKBER_SPONSOR_MARGIN_MULTIPLIER,
        ROOM_ACTIVATION_USD_MICROS,
    };

    const USD_MICROS_SCALE: u128 = 1_000_000_u128;
    const STRK_WEI_SCALE: u128 = 1_000_000_000_000_000_000_u128;
    const MAX_ORACLE_DECIMALS: u32 = 18_u32;

    #[storage]
    struct Storage {
        pricing_admin: ContractAddress,
        pragma_oracle: ContractAddress,
        strk_usd_pair: felt252,
        sponsor_cost_strk_wei: u128,
        max_oracle_age: u64,
        min_oracle_sources: u32,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        pricing_admin: ContractAddress,
        pragma_oracle: ContractAddress,
        strk_usd_pair: felt252,
        sponsor_cost_strk_wei: u128,
        max_oracle_age: u64,
        min_oracle_sources: u32,
    ) {
        let zero_address: ContractAddress = 0.try_into().unwrap();

        assert(
            pricing_admin != zero_address,
            'ZERO_PRICING_ADMIN',
        );
        assert(
            pragma_oracle != zero_address,
            'ZERO_PRAGMA_ORACLE',
        );
        assert(
            strk_usd_pair != 0,
            'ZERO_STRK_PAIR',
        );
        assert(
            sponsor_cost_strk_wei != 0,
            'ZERO_SPONSOR_COST',
        );
        assert(
            max_oracle_age != 0,
            'ZERO_ORACLE_AGE',
        );
        assert(
            min_oracle_sources != 0,
            'ZERO_ORACLE_SOURCES',
        );

        self.pricing_admin.write(pricing_admin);
        self.pragma_oracle.write(pragma_oracle);
        self.strk_usd_pair.write(strk_usd_pair);
        self.sponsor_cost_strk_wei.write(
            sponsor_cost_strk_wei,
        );
        self.max_oracle_age.write(max_oracle_age);
        self.min_oracle_sources.write(
            min_oracle_sources,
        );
    }

    #[abi(embed_v0)]
    impl VinssFeePolicyImpl of IVinssFeePolicy<ContractState> {
        fn quote_fee(
            self: @ContractState,
            action: u8,
        ) -> u128 {
            let base_usd_micros =
                self.base_usd_micros(action);

            let public_price_floor =
                self.usd_micros_to_strk(
                    base_usd_micros,
                );

            let sponsor_cost =
                self.sponsor_cost_strk_wei.read();

            let sponsor_floor_u256: u256 =
                sponsor_cost.into()
                    * self
                        .sponsor_multiplier(action)
                        .into();

            let sponsor_floor: u128 =
                sponsor_floor_u256
                    .try_into()
                    .expect('SPONSOR_FLOOR_OVERFLOW');

            if public_price_floor > sponsor_floor {
                public_price_floor
            } else {
                sponsor_floor
            }
        }

        fn quote_fee_usd_micros(
            self: @ContractState,
            action: u8,
        ) -> u128 {
            let base_usd_micros =
                self.base_usd_micros(action);

            let sponsor_floor_u256: u256 =
                self
                    .sponsor_cost_strk_wei
                    .read()
                    .into()
                    * self
                        .sponsor_multiplier(action)
                        .into();

            let sponsor_floor_strk: u128 =
                sponsor_floor_u256
                    .try_into()
                    .expect('SPONSOR_FLOOR_OVERFLOW');

            let sponsor_floor_usd =
                self.strk_wei_to_usd_micros(
                    sponsor_floor_strk,
                );

            if base_usd_micros > sponsor_floor_usd {
                base_usd_micros
            } else {
                sponsor_floor_usd
            }
        }

        fn get_pricing_admin(
            self: @ContractState,
        ) -> ContractAddress {
            self.pricing_admin.read()
        }

        fn get_pragma_oracle(
            self: @ContractState,
        ) -> ContractAddress {
            self.pragma_oracle.read()
        }

        fn get_sponsor_cost_strk_wei(
            self: @ContractState,
        ) -> u128 {
            self.sponsor_cost_strk_wei.read()
        }

        fn set_sponsor_cost_strk_wei(
            ref self: ContractState,
            new_cost: u128,
        ) {
            assert(
                get_caller_address()
                    == self.pricing_admin.read(),
                'NOT_PRICING_ADMIN',
            );
            assert(
                new_cost != 0,
                'ZERO_SPONSOR_COST',
            );

            // Validate with the largest supported multiplier.
            let checked: u256 =
                new_cost.into()
                    * REKBER_SPONSOR_MARGIN_MULTIPLIER.into();
            let _: u128 =
                checked
                    .try_into()
                    .expect('SPONSOR_FLOOR_OVERFLOW');

            self.sponsor_cost_strk_wei.write(
                new_cost,
            );
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn base_usd_micros(
            self: @ContractState,
            action: u8,
        ) -> u128 {
            if action == FEE_ACTION_ROOM_ACTIVATION {
                ROOM_ACTIVATION_USD_MICROS
            } else if action == FEE_ACTION_MESSAGE {
                MESSAGE_USD_MICROS
            } else if action == FEE_ACTION_OFFER {
                OFFER_USD_MICROS
            } else if action == FEE_ACTION_REKBER {
                REKBER_MIN_USD_MICROS
            } else {
                core::panic_with_felt252(
                    'BAD_FEE_ACTION',
                )
            }
        }

        fn sponsor_multiplier(
            self: @ContractState,
            action: u8,
        ) -> u128 {
            if action == FEE_ACTION_REKBER {
                REKBER_SPONSOR_MARGIN_MULTIPLIER
            } else if action == FEE_ACTION_ROOM_ACTIVATION ||
                action == FEE_ACTION_MESSAGE ||
                action == FEE_ACTION_OFFER
            {
                FLAT_SPONSOR_MARGIN_MULTIPLIER
            } else {
                core::panic_with_felt252(
                    'BAD_FEE_ACTION',
                )
            }
        }

        fn pow10(
            self: @ContractState,
            exponent: u32,
        ) -> u128 {
            let mut value: u128 = 1_u128;
            let mut index: u32 = 0_u32;

            loop {
                if index == exponent {
                    break;
                }

                value *= 10_u128;
                index += 1_u32;
            };

            value
        }

        fn strk_wei_to_usd_micros(
            self: @ContractState,
            strk_wei: u128,
        ) -> u128 {
            let oracle = IPragmaABIDispatcher {
                contract_address:
                    self.pragma_oracle.read(),
            };

            let response = oracle.get_data_median(
                DataType::SpotEntry(
                    self.strk_usd_pair.read(),
                ),
            );

            assert(
                response.price != 0,
                'ZERO_ORACLE_PRICE',
            );
            assert(
                response.decimals
                    <= MAX_ORACLE_DECIMALS,
                'BAD_ORACLE_DECIMALS',
            );

            let now = get_block_timestamp();

            assert(
                response.last_updated_timestamp != 0,
                'ZERO_ORACLE_TIME',
            );
            assert(
                response.last_updated_timestamp <= now,
                'FUTURE_ORACLE_TIME',
            );
            assert(
                now - response.last_updated_timestamp
                    <= self.max_oracle_age.read(),
                'STALE_ORACLE_PRICE',
            );
            assert(
                response.num_sources_aggregated
                    >= self.min_oracle_sources.read(),
                'LOW_ORACLE_SOURCES',
            );

            match response.expiration_timestamp {
                Option::Some(expiration) => {
                    // Pragma SpotEntry currently uses Some(0) as the
                    // sentinel for "no expiration".
                    if expiration != 0 {
                        assert(
                            expiration >= now,
                            'EXPIRED_ORACLE_PRICE',
                        );
                    }
                },
                Option::None => {},
            };

            let price_scale =
                self.pow10(response.decimals);

            let numerator: u256 =
                strk_wei.into()
                    * response.price.into()
                    * USD_MICROS_SCALE.into();

            let denominator: u256 =
                STRK_WEI_SCALE.into()
                    * price_scale.into();

            let rounded: u256 =
                (numerator + denominator - 1)
                    / denominator;

            rounded
                .try_into()
                .expect('FEE_QUOTE_OVERFLOW')
        }

        fn usd_micros_to_strk(
            self: @ContractState,
            usd_micros: u128,
        ) -> u128 {
            let oracle = IPragmaABIDispatcher {
                contract_address:
                    self.pragma_oracle.read(),
            };

            let response = oracle.get_data_median(
                DataType::SpotEntry(
                    self.strk_usd_pair.read(),
                ),
            );

            assert(
                response.price != 0,
                'ZERO_ORACLE_PRICE',
            );
            assert(
                response.decimals
                    <= MAX_ORACLE_DECIMALS,
                'BAD_ORACLE_DECIMALS',
            );

            let now = get_block_timestamp();

            assert(
                response.last_updated_timestamp != 0,
                'ZERO_ORACLE_TIME',
            );
            assert(
                response.last_updated_timestamp <= now,
                'FUTURE_ORACLE_TIME',
            );
            assert(
                now - response.last_updated_timestamp
                    <= self.max_oracle_age.read(),
                'STALE_ORACLE_PRICE',
            );
            assert(
                response.num_sources_aggregated
                    >= self.min_oracle_sources.read(),
                'LOW_ORACLE_SOURCES',
            );

            match response.expiration_timestamp {
                Option::Some(expiration) => {
                    // Pragma SpotEntry currently uses Some(0) as the
                    // sentinel for "no expiration".
                    if expiration != 0 {
                        assert(
                            expiration >= now,
                            'EXPIRED_ORACLE_PRICE',
                        );
                    }
                },
                Option::None => {},
            };

            let price_scale =
                self.pow10(response.decimals);

            let numerator: u256 =
                usd_micros.into()
                    * price_scale.into()
                    * STRK_WEI_SCALE.into();

            let denominator: u256 =
                USD_MICROS_SCALE.into()
                    * response.price.into();

            let rounded: u256 =
                (numerator + denominator - 1)
                    / denominator;

            rounded
                .try_into()
                .expect('FEE_QUOTE_OVERFLOW')
        }
    }
}
