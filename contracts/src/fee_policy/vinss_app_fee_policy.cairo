/// App fees use fiat prices only. Rekber always delegates to the original policy.
#[starknet::contract]
pub mod VinssAppFeePolicy {
    use starknet::{ContractAddress, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::fee_policy::interfaces::{IVinssFeePolicy, IVinssFeePolicyDispatcher, IVinssFeePolicyDispatcherTrait};
    use pragma_lib::abi::{IPragmaABIDispatcher, IPragmaABIDispatcherTrait};
    use pragma_lib::types::DataType;
    #[storage]
    struct Storage { legacy_policy: ContractAddress, max_oracle_age: u64, min_sources: u32 }
    #[constructor]
    fn constructor(ref self: ContractState, legacy_policy: ContractAddress, max_oracle_age: u64, min_sources: u32) {
        assert(legacy_policy != 0.try_into().unwrap(), 'ZERO_POLICY');
        assert(max_oracle_age > 0 && min_sources > 0, 'BAD_ORACLE_CONFIG');
        self.legacy_policy.write(legacy_policy);
        self.max_oracle_age.write(max_oracle_age);
        self.min_sources.write(min_sources);
    }
    fn usd_price(action: u8) -> u128 {
        if action == 1 || action == 3 { 100_000 } else if action == 2 { 20_000 }
        else { panic!("BAD_FEE_ACTION") }
    }
    #[abi(embed_v0)]
    impl Policy of IVinssFeePolicy<ContractState> {
        fn quote_fee(self: @ContractState, action: u8) -> u128 {
            let legacy = IVinssFeePolicyDispatcher { contract_address: self.legacy_policy.read() };
            if action == 4 { return legacy.quote_fee(action); }
            let usd = usd_price(action);
            let oracle = IPragmaABIDispatcher { contract_address: legacy.get_pragma_oracle() };
            let data = oracle.get_data_median(DataType::SpotEntry('STRK/USD'));
            let now = get_block_timestamp();
            assert(data.price > 0, 'ZERO_ORACLE_PRICE');
            assert(data.decimals <= 18, 'BAD_ORACLE_DECIMALS');
            assert(data.last_updated_timestamp > 0 && data.last_updated_timestamp <= now, 'BAD_ORACLE_TIME');
            assert(now - data.last_updated_timestamp <= self.max_oracle_age.read(), 'STALE_ORACLE_PRICE');
            assert(data.num_sources_aggregated >= self.min_sources.read(), 'LOW_ORACLE_SOURCES');
            if let Option::Some(expiration) = data.expiration_timestamp {
                assert(expiration == 0 || expiration >= now, 'EXPIRED_ORACLE_PRICE');
            }
            let mut scale: u256 = 1;
            for _ in 0..data.decimals { scale *= 10; }
            let numerator: u256 = usd.into() * 1_000_000_000_000_000_000 * scale;
            let denominator: u256 = data.price.into() * 1_000_000;
            ((numerator + denominator - 1) / denominator).try_into().expect('FEE_QUOTE_OVERFLOW')
        }
        fn quote_fee_usd_micros(self: @ContractState, action: u8) -> u128 {
            if action == 4 { IVinssFeePolicyDispatcher { contract_address: self.legacy_policy.read() }.quote_fee_usd_micros(action) }
            else { usd_price(action) }
        }
        fn get_pricing_admin(self: @ContractState) -> ContractAddress {
            IVinssFeePolicyDispatcher { contract_address: self.legacy_policy.read() }.get_pricing_admin()
        }
        fn get_pragma_oracle(self: @ContractState) -> ContractAddress {
            IVinssFeePolicyDispatcher { contract_address: self.legacy_policy.read() }.get_pragma_oracle()
        }
        fn get_sponsor_cost_strk_wei(self: @ContractState) -> u128 {
            IVinssFeePolicyDispatcher { contract_address: self.legacy_policy.read() }.get_sponsor_cost_strk_wei()
        }
        fn set_sponsor_cost_strk_wei(ref self: ContractState, new_cost: u128) {
            let _ = new_cost;
            panic!("READ_ONLY_POLICY");
        }
    }
}
