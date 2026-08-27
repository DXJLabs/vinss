"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  quoteRekberFee,
} from "@/lib/starknet/feePolicy";
import {
  parseSettlementAmount,
  resolveSettlementAsset,
} from "@/lib/deal-room/escrow";

type SupportedPriceAsset =
  | "STRK"
  | "USDC";

interface PriceResponse {
  asset: SupportedPriceAsset;
  usd: number;
  source: "coingecko";
  updatedAt: string;
  stale?: boolean;
}

const clientPriceCache =
  new Map<
    SupportedPriceAsset,
    {
      price: number;
      fetchedAt: number;
    }
  >();

const CLIENT_CACHE_MS = 60_000;

function normalizeAsset(
  asset: string | undefined,
): SupportedPriceAsset | null {
  const symbol =
    asset?.trim().toUpperCase();

  return symbol === "STRK" ||
    symbol === "USDC"
    ? symbol
    : null;
}

function formatBaseUnits(
  value: bigint,
  decimals: number,
): string {
  const base =
    10n ** BigInt(decimals);
  const whole = value / base;
  const remainder =
    value % base;

  if (remainder === 0n) {
    return whole.toString();
  }

  const fraction =
    remainder
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");

  return `${whole}.${fraction}`;
}

export function formatUsd(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits:
        value > 0 && value < 0.01
          ? 4
          : 2,
    },
  ).format(value);
}

export function useUsdPrice(
  asset: string | undefined,
) {
  const symbol =
    normalizeAsset(asset);
  const [price, setPrice] =
    useState<number | null>(
      symbol
        ? clientPriceCache.get(
            symbol,
          )?.price ?? null
        : null,
    );
  const [loading, setLoading] =
    useState(Boolean(symbol));
  const [stale, setStale] =
    useState(false);

  useEffect(() => {
    if (!symbol) {
      setPrice(null);
      setLoading(false);
      setStale(false);
      return;
    }

    const cached =
      clientPriceCache.get(symbol);
    const now = Date.now();

    if (
      cached &&
      now - cached.fetchedAt <
        CLIENT_CACHE_MS
    ) {
      setPrice(cached.price);
      setLoading(false);
      setStale(false);
      return;
    }

    const controller =
      new AbortController();

    setLoading(true);

    void fetch(
      `/api/market/price?asset=${symbol}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const data =
          (await response.json()) as
            | PriceResponse
            | {
                error?: string;
              };

        if (
          !response.ok ||
          !("usd" in data) ||
          typeof data.usd !==
            "number" ||
          !Number.isFinite(data.usd) ||
          data.usd <= 0
        ) {
          throw new Error(
            "Price unavailable",
          );
        }

        clientPriceCache.set(
          symbol,
          {
            price: data.usd,
            fetchedAt: Date.now(),
          },
        );
        setPrice(data.usd);
        setStale(
          Boolean(
            "stale" in data &&
              data.stale,
          ),
        );
      })
      .catch((error) => {
        if (
          error instanceof
            DOMException &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        const fallback =
          clientPriceCache.get(
            symbol,
          );
        setPrice(
          fallback?.price ?? null,
        );
        setStale(
          Boolean(fallback),
        );
      })
      .finally(() => {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      });

    return () =>
      controller.abort();
  }, [symbol]);

  return {
    price,
    loading,
    stale,
    supported: Boolean(symbol),
  };
}

function PriceLine({
  tokenValue,
  asset,
  usdPrice,
}: {
  tokenValue: string;
  asset: string;
  usdPrice: number | null;
}) {
  const numericValue =
    Number(tokenValue);
  const canEstimateUsd =
    usdPrice !== null &&
    Number.isFinite(numericValue);

  return (
    <div className="text-right">
      <p className="text-xs font-medium text-paper/78">
        {tokenValue} {asset}
      </p>
      {canEstimateUsd && (
        <p className="mt-0.5 text-[9px] text-paper/34">
          ≈{" "}
          {formatUsd(
            numericValue * usdPrice,
          )}
        </p>
      )}
    </div>
  );
}

export function EscrowAgreedAmount({
  amount,
  asset,
}: {
  amount: string;
  asset: string;
}) {
  const numericAmount =
    Number(amount);
  const {
    price,
    loading,
    stale,
    supported,
  } = useUsdPrice(asset);

  const hasAmount =
    Number.isFinite(
      numericAmount,
    ) && numericAmount > 0;

  return (
    <div className="rounded-xl bg-paper/[0.025] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.13em] text-paper/28">
            Agreed amount
          </p>
          <p className="mt-2 text-2xl font-semibold text-paper">
            {amount}
            <span className="ml-2 text-sm font-medium text-paper/45">
              {asset}
            </span>
          </p>

          {supported && (
            <div className="mt-2">
              {price !== null &&
              hasAmount ? (
                <>
                  <p className="text-xs font-medium text-paper/58">
                    ≈{" "}
                    {formatUsd(
                      numericAmount *
                        price,
                    )}
                  </p>
                  <p className="mt-1 text-[9px] text-paper/28">
                    1{" "}
                    {asset.toUpperCase()} ≈{" "}
                    {formatUsd(price)}
                    {stale
                      ? " · last known price"
                      : ""}
                  </p>
                </>
              ) : loading ? (
                <p className="text-[9px] text-paper/28">
                  Loading USD estimate…
                </p>
              ) : (
                <p className="text-[9px] text-paper/24">
                  USD estimate unavailable
                </p>
              )}
            </div>
          )}
        </div>

        <span className="shrink-0 rounded-full bg-signal/[0.08] px-2.5 py-1 text-[10px] text-signal">
          ✓ Approved
        </span>
      </div>
    </div>
  );
}

export function EscrowPriceBreakdown({
  amount,
  asset,
}: {
  amount: string;
  asset: string;
}) {
  const settlementAsset =
    resolveSettlementAsset(asset);
  const [feeBaseUnits, setFeeBaseUnits] =
    useState<bigint | null>(null);
  const [quoteLoading, setQuoteLoading] =
    useState(false);
  const [quoteError, setQuoteError] =
    useState(false);
  const {
    price,
    loading,
    stale,
    supported,
  } = useUsdPrice(asset);

  let principalBaseUnits:
    | bigint
    | null = null;

  if (settlementAsset) {
    try {
      principalBaseUnits =
        parseSettlementAmount(
          amount,
          settlementAsset.decimals,
        );
    } catch {
      principalBaseUnits = null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    setFeeBaseUnits(null);
    setQuoteError(false);

    if (
      !settlementAsset ||
      principalBaseUnits === null
    ) {
      setQuoteLoading(false);
      return;
    }

    setQuoteLoading(true);

    void quoteRekberFee(
      settlementAsset.address,
      principalBaseUnits,
    )
      .then((quote) => {
        if (!cancelled) {
          setFeeBaseUnits(quote);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuoteError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    amount,
    settlementAsset?.address,
    settlementAsset?.decimals,
  ]);

  if (
    !settlementAsset ||
    principalBaseUnits === null
  ) {
    return null;
  }

  const principalToken =
    formatBaseUnits(
      principalBaseUnits,
      settlementAsset.decimals,
    );
  const feeToken =
    feeBaseUnits === null
      ? null
      : formatBaseUnits(
          feeBaseUnits,
          settlementAsset.decimals,
        );
  const totalToken =
    feeBaseUnits === null
      ? null
      : formatBaseUnits(
          principalBaseUnits +
            feeBaseUnits,
          settlementAsset.decimals,
        );

  return (
    <div className="rounded-xl bg-paper/[0.025] p-4 ring-1 ring-wire/55">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[9px] uppercase tracking-[0.13em] text-paper/34">
          Price breakdown
        </p>
        <span className="text-[8px] uppercase tracking-[0.1em] text-signal/60">
          On-chain quote
        </span>
      </div>

      <div className="mt-3 divide-y divide-wire/40">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-paper/48">
            Principal amount
          </span>
          <PriceLine
            tokenValue={principalToken}
            asset={asset}
            usdPrice={price}
          />
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-paper/48">
            VINSS service fee
          </span>
          {feeToken !== null ? (
            <PriceLine
              tokenValue={feeToken}
              asset={asset}
              usdPrice={price}
            />
          ) : (
            <span className="text-[10px] text-paper/32">
              {quoteLoading
                ? "Reading Rekber…"
                : "Unavailable"}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm font-medium text-paper/75">
            Total secured
          </span>
          {totalToken !== null ? (
            <div className="text-right">
              <p className="text-sm font-semibold text-paper">
                {totalToken} {asset}
              </p>
              {price !== null &&
                Number.isFinite(
                  Number(totalToken),
                ) && (
                  <p className="mt-0.5 text-[10px] font-medium text-signal">
                    ≈{" "}
                    {formatUsd(
                      Number(totalToken) *
                        price,
                    )}
                  </p>
                )}
            </div>
          ) : (
            <span className="text-[10px] text-paper/32">
              —
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-paper/[0.025] px-3 py-2.5 text-[9px] leading-relaxed text-paper/30">
        {quoteError ? (
          "The Rekber contract quote is unavailable. Funding stays blocked until the current on-chain fee can be read."
        ) : quoteLoading ? (
          "Reading the current VINSS service fee directly from Rekber…"
        ) : (
          <>
            The VINSS fee shown above comes from the Rekber contract for this token and principal, including its configured pricing floors.
          </>
        )}
      </div>

      <div className="mt-2 text-[8px] leading-relaxed text-paper/22">
        {supported ? (
          price !== null ? (
            <>
              Market estimate: 1{" "}
              {asset.toUpperCase()} ≈{" "}
              {formatUsd(price)}
              {stale
                ? " · last known price."
                : "."}
            </>
          ) : loading ? (
            "Fetching market estimate…"
          ) : (
            "USD market estimate unavailable."
          )
        ) : (
          "USD estimate is available for STRK and USDC."
        )}
        {" "}Privacy Pool and network fees are separate and are shown by Ready X before confirmation.
      </div>
    </div>
  );
}
