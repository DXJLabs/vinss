"use client";

import Link from "next/link";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { walletV6 } from "starknet";
import { useEffect, useState } from "react";
import { useWallet } from "@/components/providers/WalletProvider";
import { NETWORK, STRK_ADDRESS, USDC_ADDRESS } from "@/lib/starknet/constants";
import {
  assertUnshieldNetwork, buildUnshieldAction, formatTokenUnits, parseTokenUnits, normalizeStarknetAddress,
} from "@/lib/starknet/unshield";
import { getProvider } from "@/lib/starknet/walletClient";

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
      // Verify both wallet write-chain and RPC read-chain immediately before signing.
      const [walletChainId, rpcChainId] = await Promise.all([
        walletV6.requestChainId(session.wallet),
        getProvider().getChainId(),
      ]);
      assertUnshieldNetwork(NETWORK, walletChainId, rpcChainId);
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Link className="font-display text-xs uppercase tracking-widest text-signal hover:underline" href="/">
            ← VINSS
          </Link>
          <WalletConnectButton showCapability={false} />
        </div>
        <nav aria-label="STRK20 balance actions" className="mt-7 flex gap-2 text-xs">
          <Link href="/shield" className="rounded-lg border border-wire px-4 py-2 text-paper/65 hover:border-signal">Shield</Link>
          <Link href="/unshield" aria-current="page" className="rounded-lg border border-signal bg-signal/10 px-4 py-2 text-signal">Unshield</Link>
          <Link href="/fees" className="ml-auto rounded-lg border border-wire px-3 py-2 text-paper/65 hover:border-signal">Fees</Link>
        </nav>
        <div className="mt-4 border border-wire bg-vault/50 p-6">
          <p className="font-display text-xs uppercase tracking-[0.18em] text-signal">
            Native STRK20 · {NETWORK}
          </p>
          <h1 className="mt-3 font-display text-2xl uppercase">Unshield</h1>
          <p className="mt-3 text-sm leading-6 text-paper/65">
            Move funds from your shielded STRK20 balance to a public Starknet address.
            The amount and destination will be visible on-chain after withdrawal.
          </p>

          <Link className="mt-4 inline-block text-xs text-signal hover:underline" href="/fees">
            View active VINSS service fees →
          </Link>
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
                <span className="text-paper/60">Amount withdrawn (not a fee)</span>
                <span>{formatted ? formatted + " " + asset : "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-paper/60">VINSS added service fee</span>
                <span>0</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-paper/60">STRK20 / wallet / network charges</span>
                <span>Review in wallet</span>
              </div>
            </div>
            <p className="text-xs leading-5 text-paper/55">
              Shield and Unshield can have different wallet fees. VINSS does not set
              those protocol or network charges. Review the wallet quote before confirming.
            </p>
            <label className="flex gap-3 text-xs leading-5 text-paper/65">
              <input type="checkbox" checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)} />
              I understand this is a public withdrawal and have checked the destination address.
            </label>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {hash && <p role="status" className="break-all text-xs text-signal">
              Submitted (not yet confirmed): <a className="underline" href={
                (NETWORK === "mainnet" ? "https://starkscan.co/tx/" : "https://sepolia.starkscan.co/tx/") + hash
              } target="_blank" rel="noreferrer">{hash}</a>
            </p>}
            <button className="w-full border border-signal bg-signal px-4 py-3 text-sm font-semibold text-ink disabled:opacity-40"
              type="submit" disabled={busy || !session?.strk20Capable || !acknowledged || !formatted}>
              {busy ? "Waiting for wallet…" : "Review Unshield in wallet"}
            </button>
            {!session?.strk20Capable && <p className="text-xs text-paper/50">
              Connect a compatible STRK20 wallet using the button above.
            </p>}
          </form>
        </div>
      </div>
    </main>
  );
}
