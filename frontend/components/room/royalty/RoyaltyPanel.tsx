"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  StarkIdentity,
} from "@/components/StarkIdentity";

import {
  BACKEND_URL,
} from "@/lib/starknet/constants";

interface RoyaltyState {
  network: string;
  address: string;
  points: number;
  basePoints: number;
  certificateCount: number;
  successfulSettlements: number;
  multiplier: number;
  nextCertificateTarget:
    | number
    | null;
  nextMultiplier:
    | number
    | null;
  latestCertificateIssuedAt:
    | number
    | null;
  conversion: {
    status: string;
  };
}

export function RoyaltyPanel({
  address,
}: {
  address?: string | null;
}) {
  const [data, setData] =
    useState<RoyaltyState | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    if (!address) {
      setData(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await fetch(
            `${BACKEND_URL}/royalty/${encodeURIComponent(
              address,
            )}`,
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          throw new Error(
            `Royalty request failed: ${response.status}`,
          );
        }

        const next =
          (await response.json()) as
            RoyaltyState;

        if (!cancelled) {
          setData(next);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Royalty data is unavailable.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    const onVisible = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void load();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisible,
    );

    return () => {
      cancelled = true;

      document.removeEventListener(
        "visibilitychange",
        onVisible,
      );
    };
  }, [address]);

  if (!address) {
    return (
      <section className="rounded-2xl border border-wire/70 bg-vault/15 px-5 py-12 text-center">
        <p className="text-sm text-paper/65">
          Connect your wallet to view Royalty.
        </p>
      </section>
    );
  }

  if (loading && !data) {
    return (
      <section className="rounded-2xl border border-wire/70 bg-vault/15 px-5 py-12 text-center">
        <p className="text-xs text-paper/35">
          Loading Royalty…
        </p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="rounded-2xl border border-wire/70 bg-vault/15 px-5 py-12 text-center">
        <p className="text-xs text-danger">
          {error}
        </p>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const currentFloor =
    data.certificateCount >= 10
      ? 10
      : data.certificateCount >= 5
        ? 5
        : data.certificateCount >= 3
          ? 3
          : data.certificateCount >= 1
            ? 1
            : 0;

  const target =
    data.nextCertificateTarget;

  const progress =
    target === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((data.certificateCount -
              currentFloor) /
              (target -
                currentFloor)) *
              100,
          ),
        );

  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-wire/70 bg-vault/15">
        <div className="border-b border-wire/55 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-[9px] uppercase tracking-[0.16em] text-paper/30">
                Royalty
              </p>

              <p className="mt-2 truncate text-sm font-medium text-paper/75">
                <StarkIdentity
                  address={
                    address
                  }
                />
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-signal/[0.07] px-3 py-1.5 font-display text-[10px] text-signal ring-1 ring-signal/20">
              ×
              {data.multiplier.toFixed(
                2,
              )}
            </span>
          </div>
        </div>

        <div className="px-4 py-5">
          <p className="font-display text-[9px] uppercase tracking-[0.14em] text-paper/30">
            Total points
          </p>

          <div className="mt-1 flex items-end gap-2">
            <p className="text-3xl font-semibold tracking-tight text-paper">
              {data.points.toLocaleString()}
            </p>

            <span className="pb-1 text-[10px] uppercase tracking-wider text-signal/60">
              pts
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-wire/70 bg-vault/15 p-4">
        <p className="font-display text-[9px] uppercase tracking-[0.14em] text-paper/30">
          Settlement reputation
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-black/10 p-3 ring-1 ring-wire/45">
            <p className="text-xl font-medium text-paper/80">
              {
                data.certificateCount
              }
            </p>

            <p className="mt-1 text-[9px] text-paper/30">
              Certificates
            </p>
          </div>

          <div className="rounded-xl bg-black/10 p-3 ring-1 ring-wire/45">
            <p className="text-xl font-medium text-paper/80">
              {
                data.successfulSettlements
              }
            </p>

            <p className="mt-1 text-[9px] text-paper/30">
              Successful Rekber
            </p>
          </div>
        </div>

        {target !== null &&
        data.nextMultiplier !== null ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-paper/35">
                Next multiplier
              </span>

              <span className="text-signal/70">
                {target} cert → ×
                {data.nextMultiplier.toFixed(
                  2,
                )}
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper/[0.06]">
              <div
                className="h-full rounded-full bg-signal/65 transition-[width]"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-5 text-[10px] text-signal/65">
            Maximum multiplier reached · ×2.00
          </p>
        )}

        <p className="mt-4 text-[9px] leading-relaxed text-paper/25">
          Royalty is derived from verified Settlement Certificates issued after successful Rekber settlement.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-wire/70 bg-vault/15 px-4 py-4">
        <div>
          <p className="text-xs font-medium text-paper/60">
            VINSS conversion
          </p>

          <p className="mt-1 text-[9px] text-paper/25">
            Point conversion will be enabled later.
          </p>
        </div>

        <span className="rounded-full bg-paper/[0.03] px-2.5 py-1 font-display text-[8px] uppercase tracking-[0.12em] text-paper/35 ring-1 ring-wire/50">
          Coming soon
        </span>
      </div>
    </section>
  );
}
