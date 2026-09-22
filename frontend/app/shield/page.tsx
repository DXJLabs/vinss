"use client";

import Link from "next/link";
import { useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useWallet } from "@/components/providers/WalletProvider";
import { NETWORK, STRK_ADDRESS } from "@/lib/starknet/constants";
import { sameFelt } from "@/lib/starknet/network";
import { getProvider } from "@/lib/starknet/walletClient";
import { discoverShieldedStrk, getRegisteredViewingPublicKey, shieldStrk } from "@/lib/starknet/nativeShield";

export default function ShieldPage() {
  const { session } = useWallet();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || busy || NETWORK !== "sepolia") return;
    setBusy(true); setError(""); setStatus(""); setTx("");
    try {
      const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(amount.trim());
      if (!match) throw new Error("Enter a STRK amount with at most 18 decimal places.");
      const value = BigInt(match[1]!) * 10n ** 18n + BigInt((match[2] ?? "").padEnd(18, "0"));
      setStatus("Confirm Shield in your wallet.");
      const result = await shieldStrk(session.account, value);
      setTx(result.transaction_hash);
      setStatus("Submitted. Waiting for Sepolia confirmation.");
      const receipt = await getProvider().waitForTransaction(result.transaction_hash);
      if (!receipt.isSuccess()) throw new Error("Shield was not confirmed successfully.");
      if (await getRegisteredViewingPublicKey(session.address) === 0n) {
        throw new Error("Deposit confirmed, but pool registration could not be verified. Check the transaction before retrying.");
      }
      const balances = await discoverShieldedStrk(session.account);
      const strk = balances.find((entry) => sameFelt(entry.token, STRK_ADDRESS));
      if (!strk || BigInt(strk.balance) <= 0n) {
        setStatus("Deposit confirmed. Private balance is not visible yet; check your wallet before making another deposit.");
      } else {
        setStatus("Shield confirmed. Private STRK balance is visible in your wallet.");
      }
    } catch (cause) {
      setStatus("");
      setError(cause instanceof Error ? cause.message : "Shield could not be verified.");
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-xl space-y-6 px-6 py-12">
    <div className="flex items-center justify-between gap-4">
      <Link href="/" className="text-sm text-paper/60">← VINSS</Link>
      <WalletConnectButton />
    </div>
    <div>
      <p className="text-xs uppercase tracking-widest text-signal">Starknet {NETWORK}</p>
      <h1 className="mt-3 text-3xl font-semibold">Shield STRK</h1>
      <p className="mt-3 text-paper/65">Move STRK into your private balance. The deposit amount is visible on-chain.</p>
    </div>
    {NETWORK === "sepolia" ? <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">Amount in STRK
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
          disabled={busy} required placeholder="0.1" className="mt-2 w-full border border-wire bg-transparent p-3" />
      </label>
      <button disabled={busy || !session?.strk20Capable} className="border border-signal px-5 py-3 text-signal disabled:opacity-40">
        {busy ? "Processing…" : "Shield on Sepolia"}
      </button>
      <p className="text-sm text-paper/55">Use Sepolia test tokens for this verification flow.</p>
    </form> : <p>This verification page is available on Sepolia.</p>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {tx && <a className="block break-all text-sm underline" target="_blank" rel="noreferrer"
      href={`https://sepolia.voyager.online/tx/${tx}`}>View submitted transaction</a>}
  </main>;
}
