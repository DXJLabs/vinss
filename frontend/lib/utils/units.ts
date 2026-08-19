/**
 * Human-facing amount <-> raw felt conversion, 18 decimals (STRK/most
 * ERC-20s on Starknet). Keeps the UI in "1.5 STRK", never raw wei — matches
 * the strk20-tipjar-example-main reference (app/src/lib/tipjar.ts).
 */

const DEFAULT_DECIMALS = 18;

/** "1.5" + 18 decimals -> 1500000000000000000n. Throws on invalid input. */
export function parseUnits(input: string, decimals = DEFAULT_DECIMALS): bigint {
  const re = new RegExp(`^(\\d+)(?:\\.(\\d{1,${decimals}}))?$`);
  const m = re.exec(input.trim());
  if (!m) throw new Error(`Jumlah tidak valid: "${input}"`);
  const wholeStr = m[1];
  if (wholeStr === undefined) throw new Error(`Jumlah tidak valid: "${input}"`);
  const whole = BigInt(wholeStr);
  const frac = m[2] ? BigInt(m[2].padEnd(decimals, "0")) : 0n;
  return whole * 10n ** BigInt(decimals) + frac;
}

/** 1500000000000000000n + 18 decimals -> "1.5" (trailing zeros trimmed). */
export function formatUnits(value: bigint, decimals = DEFAULT_DECIMALS): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = (value % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
