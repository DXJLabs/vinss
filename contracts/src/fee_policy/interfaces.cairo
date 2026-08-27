use starknet::ContractAddress;

#[starknet::interface]
pub trait IVinssFeePolicy<TContractState> {
    /// Return the minimum STRK revenue amount for one VINSS action.
    ///
    /// The quote is:
    /// max(public USD price converted with Pragma, 2x configured sponsor cost).
    fn quote_fee(
        self: @TContractState,
        action: u8,
    ) -> u128;

    /// Return the protected action floor in USD micros.
    /// Rekber consumes this so STRK and USDC settlement get identical
    /// sponsor-cost protection.
    fn quote_fee_usd_micros(
        self: @TContractState,
        action: u8,
    ) -> u128;

    fn get_pricing_admin(
        self: @TContractState,
    ) -> ContractAddress;

    fn get_pragma_oracle(
        self: @TContractState,
    ) -> ContractAddress;

    fn get_sponsor_cost_strk_wei(
        self: @TContractState,
    ) -> u128;

    fn set_sponsor_cost_strk_wei(
        ref self: TContractState,
        new_cost: u128,
    );
}
