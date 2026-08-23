import {
  NextRequest,
  NextResponse,
} from "next/server";

type SupportedPriceAsset =
  | "STRK"
  | "USDC";

const ASSET_IDS: Record<
  SupportedPriceAsset,
  string
> = {
  STRK: "starknet",
  USDC: "usd-coin",
};

const memoryCache =
  new Map<
    SupportedPriceAsset,
    {
      usd: number;
      updatedAt: string;
      fetchedAt: number;
    }
  >();

const CACHE_MS = 60_000;

function parseAsset(
  value: string | null,
): SupportedPriceAsset | null {
  const symbol =
    value?.trim().toUpperCase();

  return symbol === "STRK" ||
    symbol === "USDC"
    ? symbol
    : null;
}

export async function GET(
  request: NextRequest,
) {
  const asset = parseAsset(
    request.nextUrl.searchParams.get(
      "asset",
    ),
  );

  if (!asset) {
    return NextResponse.json(
      {
        error:
          "Supported assets are STRK and USDC.",
      },
      {
        status: 400,
      },
    );
  }

  const cached =
    memoryCache.get(asset);
  const now = Date.now();

  if (
    cached &&
    now - cached.fetchedAt <
      CACHE_MS
  ) {
    return NextResponse.json({
      asset,
      usd: cached.usd,
      source: "coingecko",
      updatedAt:
        cached.updatedAt,
    });
  }

  try {
    const id =
      ASSET_IDS[asset];
    const response =
      await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
          id,
        )}&vs_currencies=usd`,
        {
          headers: {
            accept:
              "application/json",
          },
          next: {
            revalidate: 60,
          },
        },
      );

    if (!response.ok) {
      throw new Error(
        `Price provider returned ${response.status}.`,
      );
    }

    const payload =
      (await response.json()) as
        Record<
          string,
          {
            usd?: unknown;
          }
        >;

    const usd =
      payload[id]?.usd;

    if (
      typeof usd !== "number" ||
      !Number.isFinite(usd) ||
      usd <= 0
    ) {
      throw new Error(
        "Price provider returned an invalid USD value.",
      );
    }

    const updatedAt =
      new Date().toISOString();

    memoryCache.set(asset, {
      usd,
      updatedAt,
      fetchedAt: now,
    });

    return NextResponse.json({
      asset,
      usd,
      source: "coingecko",
      updatedAt,
    });
  } catch {
    if (cached) {
      return NextResponse.json({
        asset,
        usd: cached.usd,
        source: "coingecko",
        updatedAt:
          cached.updatedAt,
        stale: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "USD market price is temporarily unavailable.",
      },
      {
        status: 503,
      },
    );
  }
}
