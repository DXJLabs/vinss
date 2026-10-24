"use client";

import { useEffect, useState } from "react";
import { walletV6 } from "starknet";
import { NETWORK, STRK_ADDRESS, USDC_ADDRESS } from "@/lib/starknet/constants";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { getProvider } from "@/lib/starknet/walletClient";
import { assertUnshieldNetwork, formatTokenUnits, parseTokenUnits } from "@/lib/starknet/unshield";
import { buildPublicTransferCall } from "@/lib/starknet/publicTransfer";

type Asset = "STRK" | "USDC";
const assetConfig = (asset: Asset) => asset === "STRK"
  ? { address: STRK_ADDRESS, decimals: 18 }
  : { address: USDC_ADDRESS, decimals: 6 };

export function PublicTransferPanel({ session }: { session: VinssWalletSession | null }) {
  const [asset, setAsset] = useState<Asset>("STRK");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setConfirmed(false); setHash(""); setError(""); setRecipient("");
  }, [session?.address]);

  const token = assetConfig(asset);
  let displayAmount = "";
  try { displayAmount = formatTokenUnits(parseTokenUnits(amount, token.decimals), token.decimals); }
  catch { displayAmount = ""; }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setHash("");
    if (!session) { setError("Connect a Starknet wallet before transferring."); return; }
    if (!confirmed) { setError("Confirm the public recipient, amount and lack of escrow protection."); return; }
    try {
      if (!token.address) throw new Error("Token address is not configured on this network.");
      // Validate address, exact amount and calldata before requesting wallet signature.
      const call = buildPublicTransferCall({
        token: token.address, recipient, amount, decimals: token.decimals,
      });
      setBusy(true);
      const [walletChainId, rpcChainId] = await Promise.all([
        walletV6.requestChainId(session.wallet), getProvider().getChainId(),
      ]);
      assertUnshieldNetwork(NETWORK, walletChainId, rpcChainId);
      // Unshield mode = public ERC20 transfer, NOT STRK20 withdraw.
      const tx = await session.account.execute(call);
      setHash(tx.transaction_hash);
      setConfirmed(false); setAmount("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Public transfer failed.");
    } finally { setBusy(false); }
  }

  return (
    <section aria-label="Unshield public payment" className="space-y-4">
      <p className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs leading-5 text-paper/70">
        <strong className="text-amber">Public, not escrow.</strong>{" "}
        Unshield sends tokens from your public wallet balance. It does not withdraw a STRK20
        private balance and cannot be reversed by Rekber. Room chat and Offers remain encrypted.
      </p>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-xs text-paper/70">Asset
          <select value={asset} onChange={(e) => { setAsset(e.target.value as Asset); setConfirmed(false); }}
            className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-3 text-paper">
            <option value="STRK">STRK</option><option value="USDC">USDC</option>
          </select>
        </label>
        <label className="block text-xs text-paper/70">Public recipient address
          <input value={recipient} onChange={(e) => { setRecipient(e.target.value); setConfirmed(false); }}
            placeholder="0x..." autoComplete="off" spellCheck={false}
            className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-3 font-mono text-xs text-paper" />
        </label>
        <label className="block text-xs text-paper/70">Amount ({asset})
          <input value={amount} onChange={(e) => { setAmount(e.target.value); setConfirmed(false); }}
            placeholder="0.0" autoComplete="off" inputMode="decimal"
            className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-3 text-paper" />
        </label>
        <div className="space-y-2 border-t border-wire pt-4 text-xs">
          <div className="flex justify-between gap-3"><span className="text-paper/55">Public transfer principal</span><span>{displayAmount ? displayAmount + " " + asset : "—"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-paper/55">VINSS transfer service fee</span><span>0</span></div>
          <div className="flex justify-between gap-3"><span className="text-paper/55">Starknet network fee</span><span>Review in wallet</span></div>
          <p className="leading-5 text-paper/45">Network fees are separate from the principal.</p>
        </div>
        <label className="flex gap-3 text-xs leading-5 text-paper/65">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I verified the recipient and know this public payment has no escrow or refund guarantee.
        </label>
        {error && <p role="alert" className="break-words text-xs text-danger">{error}</p>}
        {hash && <p role="status" className="break-all text-xs text-signal">
          Submitted, not yet confirmed:{" "}
          <a className="underline" target="_blank" rel="noreferrer"
            href={(NETWORK === "mainnet" ? "https://starkscan.co/tx/" : "https://sepolia.starkscan.co/tx/") + hash}>{hash}</a>
        </p>}
        <button type="submit" disabled={!session || busy || !confirmed || !displayAmount || !recipient}
          className="w-full rounded-lg bg-signal px-4 py-3 text-sm font-medium text-ink disabled:opacity-40">
          {busy ? "Waiting for wallet…" : "Review public transfer in wallet"}
        </button>
      </form>
    </section>
  );
}
