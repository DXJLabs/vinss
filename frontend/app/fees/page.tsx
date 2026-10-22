"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NETWORK } from "@/lib/starknet/constants";
import {
  quoteRoomActivationFee,
  quoteMessageFee,
  quoteOfferFee,
} from "@/lib/starknet/feePolicy";
import {
  createLiveFeeRow,
  type FlatVinssAction,
} from "@/lib/starknet/feeQuoteView";

const newSourceFloors: {
  id: FlatVinssAction;
  label: string;
  baseUsd: string;
}[] = [
  { id: "roomActivation", label: "Room activation", baseUsd: "$0.05" },
  { id: "message", label: "Message", baseUsd: "$0.01" },
  { id: "offer", label: "Offer", baseUsd: "$0.05" },
];

type QuoteResult =
  | { state: "ready"; value: string }
  | { state: "unavailable" }
  | { state: "loading" };

export default function FeeTransparencyPage() {
  const [quotes, setQuotes] = useState<Record<FlatVinssAction, QuoteResult>>({
    roomActivation: { state: "loading" },
    message: { state: "loading" },
    offer: { state: "loading" },
  });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setQuotes({
      roomActivation: { state: "loading" },
      message: { state: "loading" },
      offer: { state: "loading" },
    });

    // Values come from the contracts configured for the selected network.
    // The code's lower USD floors must not be represented as deployed prices.
    void Promise.allSettled([
      quoteRoomActivationFee(),
      quoteMessageFee(),
      quoteOfferFee(),
    ]).then((results) => {
      if (cancelled) return;
      const ids: FlatVinssAction[] = ["roomActivation", "message", "offer"];
      const next = {} as Record<FlatVinssAction, QuoteResult>;
      for (const [index, result] of results.entries()) {
        const id = ids[index]!;
        next[id] = result.status === "fulfilled"
          ? { state: "ready", value: createLiveFeeRow(id, result.value).serviceFee }
          : { state: "unavailable" };
      }
      setQuotes(next);
    });

    return () => { cancelled = true; };
  }, [refresh]);

  return (
    <main className="min-h-screen bg-ink px-4 py-10 text-paper">
      <div className="mx-auto max-w-2xl">
        <Link className="font-display text-xs uppercase tracking-widest text-signal hover:underline" href="/">
          ← VINSS
        </Link>
        <section className="mt-8 rounded-xl border border-wire bg-vault/50 p-5 sm:p-7">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-signal">
            STRK20 · {NETWORK}
          </p>
          <h1 className="mt-3 font-display text-2xl uppercase">Fees</h1>
          <p className="mt-3 text-sm leading-6 text-paper/70">
            Fee amounts below are quoted from the currently configured Starknet
            contracts. They may exceed the base USD prices because of the sponsor-cost floor.
            Transfer amounts are not service fees.
          </p>
          <div className="mt-6 overflow-x-auto border border-wire">
            <table className="w-full min-w-[410px] text-left text-xs sm:text-sm">
              <thead className="border-b border-wire bg-ink/50 text-paper/55">
                <tr>
                  <th className="px-3 py-3 font-normal">Action</th>
                  <th className="px-3 py-3 font-normal">New source base</th>
                  <th className="px-3 py-3 font-normal">On-chain quote</th>
                </tr>
              </thead>
              <tbody>
                {newSourceFloors.map((entry) => {
                  const quote = quotes[entry.id];
                  return (
                    <tr key={entry.id} className="border-b border-wire/60">
                      <td className="px-3 py-3">{entry.label}</td>
                      <td className="px-3 py-3 font-mono text-paper/70">{entry.baseUsd}</td>
                      <td className="px-3 py-3 font-mono text-signal">
                        {quote.state === "ready" ? quote.value :
                          quote.state === "loading" ? "Loading…" : "Unavailable"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            className="mt-4 rounded-lg border border-wire px-3 py-2 text-xs text-paper/80 hover:border-signal"
            onClick={() => setRefresh((value) => value + 1)}
            type="button"
          >
            Refresh quotes
          </button>
          <div className="mt-6 space-y-3 border-t border-wire pt-5 text-sm leading-6 text-paper/70">
            <p><strong className="text-paper">Rekber:</strong> unchanged.
              Its service fee depends on principal, selected asset and the
              active on-chain Rekber contract. Review the precise quote before funding.
            </p>
            <p><strong className="text-paper">Unshield:</strong> VINSS service
              fee is zero. The amount unshielded is your transferred principal,
              not a fee.
            </p>
            <p><strong className="text-paper">Wallet / network charges:</strong>{" "}
              separate from VINSS service fees; confirm them in your wallet.
            </p>
            <p className="text-paper/55">
              The new source base rates are not active on Mainnet or Sepolia
              until the updated FeePolicy is deployed and helpers use it.
              If no configured on-chain contract can be reached, a quote is unavailable,
              never replaced by a guessed amount.
            </p>
          </div>
          <Link href="/unshield" className="mt-7 inline-block font-display text-xs uppercase tracking-wider text-signal hover:underline">
            Open Unshield →
          </Link>
        </section>
      </div>
    </main>
  );
}
