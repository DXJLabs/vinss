"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { quoteVinssFee } from "@/lib/agent";
import { VINSS_FEES } from "@/lib/fees";

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

function formatToken(
  value: number,
  asset: string,
): string {
  return `${value.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 6,
    },
  )} ${asset}`;
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
  tokenValue: number;
  asset: string;
  usdPrice: number | null;
}) {
  return (
    <div className="text-right">
      <p className="text-xs font-medium text-paper/78">
        {formatToken(
          tokenValue,
          asset,
        )}
      </p>
      {usdPrice !== null && (
        <p className="mt-0.5 text-[9px] text-paper/34">
          ≈{" "}
          {formatUsd(
            tokenValue * usdPrice,
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
  feeBps = VINSS_FEES.rekber.bps,
}: {
  amount: string;
  asset: string;
  feeBps?: number;
}) {
  const quote = useMemo(
    () =>
      quoteVinssFee(
        amount,
        feeBps,
      ),
    [amount, feeBps],
  );
  const {
    price,
    loading,
    stale,
    supported,
  } = useUsdPrice(asset);

  if (!quote) return null;

  return (
    <div className="rounded-xl bg-paper/[0.025] p-4 ring-1 ring-wire/55">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[9px] uppercase tracking-[0.13em] text-paper/34">
          Price breakdown
        </p>
        {supported && (
          <span className="text-[8px] uppercase tracking-[0.1em] text-paper/22">
            USD estimate
          </span>
        )}
      </div>

      <div className="mt-3 divide-y divide-wire/40">
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-paper/48">
            Principal amount
          </span>
          <PriceLine
            tokenValue={
              quote.amount
            }
            asset={asset}
            usdPrice={price}
          />
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-xs text-paper/48">
            VINSS service fee ·{" "}
            {quote.feeBps / 100}%
          </span>
          <PriceLine
            tokenValue={
              quote.fee
            }
            asset={asset}
            usdPrice={price}
          />
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm font-medium text-paper/75">
            Total secured
          </span>
          <div className="text-right">
            <p className="text-sm font-semibold text-paper">
              {formatToken(
                quote.total,
                asset,
              )}
            </p>
            {price !== null && (
              <p className="mt-0.5 text-[10px] font-medium text-signal">
                ≈{" "}
                {formatUsd(
                  quote.total *
                    price,
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-paper/[0.025] px-3 py-2.5 text-[9px] leading-relaxed text-paper/30">
        {supported ? (
          price !== null ? (
            <>
              Exchange rate: 1{" "}
              {asset.toUpperCase()} ≈{" "}
              {formatUsd(price)}
              {stale
                ? " · using last known price."
                : ". Price may change before confirmation."}
            </>
          ) : loading ? (
            "Fetching latest market price…"
          ) : (
            "USD estimate is temporarily unavailable. Escrow can still continue normally."
          )
        ) : (
          "USD estimate is available for STRK and USDC settlement assets."
        )}
      </div>

      <p className="mt-2 text-[8px] leading-relaxed text-paper/22">
        Privacy Pool and network fees are not included here.
        Ready X shows those fees before confirmation.
      </p>
    </div>
  );
}
