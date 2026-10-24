"use client";

import { useEffect, useState } from "react";
import { walletV6 } from "starknet";
import { NETWORK, STRK_ADDRESS, USDC_ADDRESS } from "@/lib/starknet/constants";
import { getProvider, type VinssWalletSession } from "@/lib/starknet/walletClient";
import { assertUnshieldNetwork, buildUnshieldAction, formatTokenUnits, parseTokenUnits } from "@/lib/starknet/unshield";

type Asset = "STRK" | "USDC";

/** Native STRK20 private -> public withdrawal, inline in the existing Deal Room. */
export function UnshieldPanel({ session }: { session: VinssWalletSession | null }) {
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

  const decimals = asset === "STRK" ? 18 : 6;
  const token = asset === "STRK" ? STRK_ADDRESS : USDC_ADDRESS;
  let displayedAmount = "";
  try {
    displayedAmount = formatTokenUnits(parseTokenUnits(amount, decimals), decimals);
  } catch {
    // Incomplete and invalid input must not enable sending.
  }

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
      setError("Confirm the public recipient and withdrawal amount first.");
      return;
    }
    try {
      if (!token) throw new Error("Token is not configured for this network.");
      const action = buildUnshieldAction({ token, amount, recipient, decimals });
      setBusy(true);
      const [walletChainId, rpcChainId] = await Promise.all([
        walletV6.requestChainId(session.wallet),
        getProvider().getChainId(),
      ]);
      assertUnshieldNetwork(NETWORK, walletChainId, rpcChainId);
      // Native STRK20 withdraw; principal is not a VINSS fee.
      const tx = await session.account.strk20InvokeTransaction([action]);
      setHash(tx.transaction_hash);
      setAmount("");
      setAcknowledged(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unshield request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Unshield to public wallet"
      className="mt-3 space-y-3 rounded-xl border border-wire/70 bg-vault/45 p-4">
      <p className="text-xs font-medium text-paper/80">Unshield · Public transfer</p>
      <p className="text-[11px] leading-relaxed text-paper/50">
        Withdraw private STRK20 funds to a public wallet. The amount and destination become public.
        This action is separate from Rekber settlement.
      </p>
      <label className="block text-[11px] text-paper/70">
        Asset
        <select value={asset} disabled={busy} onChange={(event) => {
          setAsset(event.target.value as Asset); setHash(""); setError("");
        }} className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-2.5 text-paper">
          <option value="STRK">STRK</option>
          <option value="USDC">USDC</option>
        </select>
      </label>
      <label className="block text-[11px] text-paper/70">
        Amount to Unshield
        <input autoComplete="off" inputMode="decimal" value={amount} disabled={busy}
          onChange={(event) => setAmount(event.target.value)} placeholder="0.0"
          className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-2.5 text-paper" />
      </label>
      <label className="block text-[11px] text-paper/70">
        Public recipient address
        <input autoComplete="off" spellCheck={false} value={recipient} disabled={busy}
          onChange={(event) => setRecipient(event.target.value)} placeholder="0x..."
          className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-2.5 font-mono text-[11px] text-paper" />
      </label>
      <p className="text-[11px] text-paper/50">
        Withdrawal: {displayedAmount ? displayedAmount + " " + asset : "—"} (not a fee).
        VINSS added service fee: 0. Review wallet and network charges before signing.
      </p>
      <label className="flex gap-2 text-[11px] text-paper/65">
        <input type="checkbox" checked={acknowledged} disabled={busy}
          onChange={(event) => setAcknowledged(event.target.checked)} />
        I understand the recipient and amount become public.
      </label>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      {hash && <p role="status" className="break-all text-xs text-signal">
        Submitted (not confirmed):{" "}
        <a target="_blank" rel="noreferrer" className="underline"
          href={(NETWORK === "mainnet" ? "https://starkscan.co/tx/" : "https://sepolia.starkscan.co/tx/") + hash}>
          View transaction
        </a>
      </p>}
      <button type="submit" disabled={busy || !session?.strk20Capable || !acknowledged || !displayedAmount}
        className="w-full rounded-lg bg-signal px-4 py-3 text-xs font-medium text-ink disabled:opacity-35">
        {busy ? "Waiting for wallet…" : "Review Unshield in wallet"}
      </button>
    </form>
  );
}
