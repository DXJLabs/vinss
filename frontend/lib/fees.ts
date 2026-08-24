/**
 * Canonical frontend fee schedule.
 *
 * The fixed Message and Offer amounts must match their deployed Cairo helper
 * contracts. The Rekber basis points must match both Rekber contract versions.
 * Changing these values therefore also requires deploying the matching
 * contracts and updating their addresses in the frontend/backend environments.
 */
export const VINSS_FEES = {
  message: {
    strk: 7,
    baseUnits: "0x6124fee993bc0000",
  },
  offer: {
    strk: 10,
    baseUnits: "0x8ac7230489e80000",
  },
  rekber: {
    bps: 200,
    percent: 2,
    divisor: 50,
  },
  certificate: {
    strk: 0,
  },
} as const;
