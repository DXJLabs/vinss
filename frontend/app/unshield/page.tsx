"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/providers/WalletProvider";
import { NETWORK, STRK_ADDRESS, USDC_ADDRESS } from "@/lib/starknet/constants";
import {
  buildUnshieldAction, formatTokenUnits, parseTokenUnits, normalizeStarknetAddress,
} from "@/lib/starknet/unshield";

type Asset = "STRK" | "USDC";
const assetConfig = (asset: Asset) => asset === "STRK"
  ? { token: STRK_ADDRESS, decimals: 18 }
  : { token: USDC_ADDRESS, decimals: 6 };

export default function UnshieldPage() {
  const { session } = useWallet();
  const [asset, setAsset] = useState<Asset>("STRK");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRecipient(session?.address ?? "");
    setHash("");
    setError("");
    setAcknowledged(false);
  }, [session?.address]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setHash("");
    if (!session?.strk20Capable) {
      setError("Connect a STRK20-compatible wallet first.");
      return;
    }
    if (!acknowledged) {
      setError("Confirm that the withdrawal amount and destination will be public.");
      return;
    }
    try {
      const config = assetConfig(asset);
      if (!config.token) throw new Error("The selected token is not configured.");
      const action = buildUnshieldAction({
        token: config.token, amount, recipient, decimals: config.decimals,
      });
      // Use pure validation before starting a wallet interaction.
      normalizeStarknetAddress(recipient);
      parseTokenUnits(amount, config.decimals);
      setBusy(true);
      // Native STRK20 action. Never include a VINSS fee transfer.
      const transaction = await session.account.strk20InvokeTransaction([action]);
      setHash(transaction.transaction_hash);
      setAmount("");
      setAcknowledged(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unshield request failed.");
    } finally {
      setBusy(false);
    }
  }

  const config = assetConfig(asset);
  let formatted = "";
  try { formatted = formatTokenUnits(parseTokenUnits(amount, config.decimals), config.decimals); }
  catch { formatted = ""; }

  return (
    <main className="min-h-screen bg-ink px-4 py-10 text-paper">
      <div className="mx-auto max-w-xl">
        <Link className="font-display text-xs uppercase tracking-widest text-signal hover:underline" href="/">
          ← VINSS
        </Link>
        <div className="mt-8 border border-wire bg-vault/50 p-6">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-signal">
            Native STRK20 · {NETWORK}
          </p>
          <h1 className="mt-3 font-display text-2xl uppercase">Unshield</h1>
          <p className="mt-3 text-sm leading-6 text-paper/65">
            Move funds from your shielded STRK20 balance to a public Starknet address.
            The amount and destination will be visible on-chain after withdrawal.
          </p>

          <form className="mt-6 space-y-5" onSubmit={submit}>
            <label className="block text-sm text-paper/75">
              Asset
              <select className="mt-2 w-full border border-wire bg-ink px-3 py-3 text-paper"
                onChange={(e) => setAsset(e.target.value as Asset)} value={asset}>
                <option value="STRK">STRK</option>
                <option value="USDC">USDC</option>
              </select>
            </label>
            <label className="block text-sm text-paper/75">
              Amount to unshield ({asset})
              <input className="mt-2 w-full border border-wire bg-ink px-3 py-3 text-paper"
                autoComplete="off" inputMode="decimal" placeholder="0.0"
                onChange={(e) => setAmount(e.target.value)} value={amount} />
            </label>
            <label className="block text-sm text-paper/75">
              Public destination address
              <input className="mt-2 w-full border border-wire bg-ink px-3 py-3 font-mono text-xs text-paper"
                autoComplete="off" spellCheck={false} placeholder="0x..."
                onChange={(e) => setRecipient(e.target.value)} value={recipient} />
            </label>
            <div className="space-y-2 border-t border-wire pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-paper/60">Amount transferred</span>
                <span>{formatted ? formatted + " " + asset : "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-paper/60">VINSS Unshield service fee</span>
                <span>0</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-paper/60">Network / wallet charges</span>
                <span>Review in wallet</span>
              </div>
            </div>
            <label className="flex gap-3 text-xs leading-5 text-paper/65">
              <input type="checkbox" checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)} />
              I understand this is a public withdrawal and have checked the destination address.
            </label>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {hash && <p role="status" className="break-all text-xs text-signal">
              Submitted: <a className="underline" href={
                (NETWORK === "mainnet" ? "https://starkscan.co/tx/" : "https://sepolia.starkscan.co/tx/") + hash
              } target="_blank" rel="noreferrer">{hash}</a>
            </p>}
            <button className="w-full border border-signal bg-signal px-4 py-3 text-sm font-semibold text-ink disabled:opacity-40"
              type="submit" disabled={busy || !session?.strk20Capable || !acknowledged || !formatted}>
              {busy ? "Waiting for wallet…" : "Review Unshield in wallet"}
            </button>
            {!session?.strk20Capable && <p className="text-xs text-paper/50">
              Connect a compatible STRK20 wallet on the VINSS homepage.
            </p>}
          </form>
        </div>
      </div>
    </main>
  );
}
