# VinssFeePolicy

## Source

```text
contracts/src/fee_policy/
├── interfaces.cairo
├── types.cairo
└── vinss_fee_policy.cairo
```

## Purpose

`VinssFeePolicy` centralizes the application fee floor for Room activation, Message, Offer, and the Rekber lifecycle reserve.

It converts configured USD-micro floors into STRK using Pragma and also protects the application from sponsor/paymaster cost increases.

## Constructor

```text
pricing_admin: ContractAddress
pragma_oracle: ContractAddress
strk_usd_pair: felt252
sponsor_cost_strk_wei: u128
max_oracle_age: u64
min_oracle_sources: u32
```

All constructor values must be non-zero.

`pricing_admin`, oracle address, pair ID, oracle age, and minimum source count are fixed after deployment. Only sponsor cost has a setter.

## Action IDs and public floors

| Action | ID | Base USD floor | Sponsor multiplier |
|---|---:|---:|---:|
| Room activation | `1` | `$0.25` | `2x` |
| Message | `2` | `$0.15` | `2x` |
| Offer | `3` | `$0.25` | `2x` |
| Rekber reserve | `4` | `$0.75` | `12x` |

The Rekber multiplier is:

```text
2x flat sponsor margin
×
6 reserved sponsored actions
=
12x sponsor cost
```

## `quote_fee(action)`

The STRK quote is:

```text
public_price_floor_strk =
    ceil(base_usd_micros / current_STRK_USD_price)

sponsor_floor_strk =
    sponsor_cost_strk_wei × sponsor_multiplier(action)

quote_fee =
    max(public_price_floor_strk, sponsor_floor_strk)
```

All conversions round upward.

## `quote_fee_usd_micros(action)`

This is primarily consumed by Rekber.

```text
sponsor_floor_usd =
    ceil(
      sponsor_cost_strk_wei
      × sponsor_multiplier(action)
      × current_STRK_USD_price
    )

quote_fee_usd_micros =
    max(base_usd_micros, sponsor_floor_usd)
```

Rekber then compares this dynamic lifecycle reserve against its own immutable configured minimum and converts the winning USD floor into the actual custody token.

## Oracle validation

FeePolicy fails closed unless the Pragma response satisfies all of the following:

```text
price != 0
decimals <= 18
last_updated_timestamp != 0
last_updated_timestamp <= current block time
age <= max_oracle_age
num_sources_aggregated >= min_oracle_sources
expiration is absent, zero-sentinel, or not expired
```

A stale or malformed quote reverts rather than silently falling back to a hardcoded price.

## Mutable operation

```text
set_sponsor_cost_strk_wei(new_cost)
```

Requirements:

```text
caller == pricing_admin
new_cost != 0
new_cost × largest multiplier fits u128
```

There is no setter for the pricing admin itself in the current contract.

## Consumers

`VinssInvite`, `VinssMessageHelper`, and `VinssOfferHelper` call `quote_fee` and require the wallet-supplied quote to be at least the current minimum.

`VinssEscrowRekber` calls `quote_fee_usd_micros(FEE_ACTION_REKBER)` and combines that lifecycle reserve with its own token-aware funding formula.

## Important boundary

The current frontend also has a 3 STRK charge for selected Rekber workflow actions. That is a frontend/Ready X transaction-bundle rule. It is not enforced by `VinssFeePolicy.quote_fee(FEE_ACTION_REKBER)` and must not be described as a Rekber contract invariant.
