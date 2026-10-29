/// Read-only wrapper. Rekber must retain the original policy, never this wrapper.
#[starknet::contract]
pub mod VinssPublicAppFeePolicy {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::fee_policy::interfaces::{
        IVinssFeePolicy, IVinssFeePolicyDispatcher, IVinssFeePolicyDispatcherTrait,
    };
    use crate::public_rail::interfaces::IVinssPublicFeePolicy;
    #[storage]
    struct Storage {
        shield_policy: ContractAddress,
        app_policy: ContractAddress,
    }
    #[constructor]
    fn constructor(ref self: ContractState, shield_policy: ContractAddress, app_policy: ContractAddress) {
        assert(!shield_policy.is_zero(), 'ZERO_POLICY');
        assert(!app_policy.is_zero(), 'ZERO_APP_POLICY');
        self.shield_policy.write(shield_policy);
        self.app_policy.write(app_policy);
    }
    fn half_ceil(value: u128, action: u8) -> u128 {
        assert(action >= 1 && action <= 4, 'INVALID_ACTION');
        if action == 4 {
            value
        } else {
            value / 2 + value % 2
        }
    }
    #[abi(embed_v0)]
    impl PublicPolicySourceImpl of IVinssPublicFeePolicy<ContractState> {
        fn get_shield_policy(self: @ContractState) -> ContractAddress {
            self.shield_policy.read()
        }
    }
    #[abi(embed_v0)]
    impl PublicFeePolicyImpl of IVinssFeePolicy<ContractState> {
        fn quote_fee(self: @ContractState, action: u8) -> u128 {
            half_ceil(
                IVinssFeePolicyDispatcher { contract_address: if action == 4 { self.shield_policy.read() } else { self.app_policy.read() } }
                    .quote_fee(action),
                action,
            )
        }
        fn quote_fee_usd_micros(self: @ContractState, action: u8) -> u128 {
            half_ceil(
                IVinssFeePolicyDispatcher { contract_address: if action == 4 { self.shield_policy.read() } else { self.app_policy.read() } }
                    .quote_fee_usd_micros(action),
                action,
            )
        }
        fn get_pricing_admin(self: @ContractState) -> ContractAddress {
            IVinssFeePolicyDispatcher { contract_address: self.shield_policy.read() }
                .get_pricing_admin()
        }
        fn get_pragma_oracle(self: @ContractState) -> ContractAddress {
            IVinssFeePolicyDispatcher { contract_address: self.shield_policy.read() }
                .get_pragma_oracle()
        }
        fn get_sponsor_cost_strk_wei(self: @ContractState) -> u128 {
            IVinssFeePolicyDispatcher { contract_address: self.shield_policy.read() }
                .get_sponsor_cost_strk_wei()
        }
        fn set_sponsor_cost_strk_wei(ref self: ContractState, new_cost: u128) {
            let _ = new_cost;
            core::panic_with_felt252('READ_ONLY_POLICY');
        }
    }
}
