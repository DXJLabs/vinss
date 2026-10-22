pub const FEE_ACTION_ROOM_ACTIVATION: u8 = 1_u8;
pub const FEE_ACTION_MESSAGE: u8 = 2_u8;
pub const FEE_ACTION_OFFER: u8 = 3_u8;
pub const FEE_ACTION_REKBER: u8 = 4_u8;

// Reduced app service price floors; NOT public token transfer amounts or gas.
pub const ROOM_ACTIVATION_USD_MICROS: u128 = 50_000_u128;
pub const MESSAGE_USD_MICROS: u128 = 10_000_u128;
pub const OFFER_USD_MICROS: u128 = 50_000_u128;

// Rekber principal percentage, minimum and sponsor reserve remain unchanged.
pub const REKBER_MIN_USD_MICROS: u128 = 750_000_u128;

pub const FLAT_SPONSOR_MARGIN_MULTIPLIER: u128 = 2_u128;
pub const REKBER_RESERVED_SPONSORED_ACTIONS: u128 = 6_u128;
pub const REKBER_SPONSOR_MARGIN_MULTIPLIER: u128 =
    FLAT_SPONSOR_MARGIN_MULTIPLIER
        * REKBER_RESERVED_SPONSORED_ACTIONS;
