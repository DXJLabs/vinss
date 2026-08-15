"use client";

import Link from "next/link";
import { useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";

/**
 * Shield / balance UI.
 *
 * Follows the gotchas in
 * .agents/skills/strk20-privacy-integration/references/wallet-api-route.md:
 *
 * - A deposit is TWO transactions (ERC-20 approve, then the private
 *   deposit) — the wallet prompts twice, so the UI names both steps rather
 *   than letting a "duplicate transaction" prompt surprise the user.
 * - Freshly shielded notes mature ~10 blocks before they're spendable —
 *   shown as a wait state, not silently retried.
 * - The pool charges a flat per-operation fee — read live via
 *   `get_fee_amount`, never hardcode; not yet wired here (see TODO below).
 * - `strk20Balances([])` is a balance READ gated behind wallet consent —
 *   never call it just to feature-detect (see walletClient.ts); it's fine
 *   to call it here because the user is explicitly asking to see balances.
 */
export default function WalletPage() {
  const [session, setSession] = useState<VinssWalletSession | null>(null);
  const [balances, setBalances] = useState<{
    public: string;
    shielded: string;
  } | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [shieldAmount, setShieldAmount] = useState("");
  const [shieldToken, setShieldToken] = useState("");
  const [step, setStep] = useState<"idle" | "approving" | "depositing" | "maturing">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function loadBalances() {
    if (!session || !shieldToken.trim()) return;
    setLoadingBalances(true);
    setError(null);
    try {
      const anyAccount = session.account as unknown as {
        strk20Balances: (
          tokens: string[],
        ) => Promise<Array<{ token: string; publicBalance: string; shieldedBalance: string }>>;
      };
      const result = await anyAccount.strk20Balances([shieldToken.trim()]);
      const entry = result[0];
      setBalances({
        public: entry?.publicBalance ?? "0",
        shielded: entry?.shieldedBalance ?? "0",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal ambil balance: ${err.message}`
          : "Gagal ambil balance.",
      );
    } finally {
      setLoadingBalances(false);
    }
  }

  async function handleShield() {
    if (!session || !shieldToken.trim() || !shieldAmount.trim()) return;
    setError(null);
    try {
      setStep("approving");
      const anyAccount = session.account as unknown as {
        shield: (params: { token: string; amount: string }) => Promise<{
          transaction_hash: string;
        }>;
      };
      setStep("depositing");
      await anyAccount.shield({
        token: shieldToken.trim(),
        amount: shieldAmount.trim(),
      });
      setStep("maturing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal shield.");
      setStep("idle");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs text-paper/40 hover:text-signal">
            ← Home
          </Link>
          <h1 className="mt-2 font-display text-2xl">Wallet</h1>
        </div>
        <WalletConnectButton />
      </div>

      {!session && (
        <p className="border border-wire px-4 py-3 text-xs text-paper/50">
          Hubungkan wallet untuk melihat saldo publik/private dan melakukan
          shield.
        </p>
      )}

      {error && (
        <p className="mb-4 border border-danger/40 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {session && (
        <div className="space-y-10">
          <section>
            <p className="mb-2 font-display text-xs uppercase tracking-widest text-paper/50">
              Saldo
            </p>
            <div className="flex gap-2">
              <input
                value={shieldToken}
                onChange={(e) => setShieldToken(e.target.value)}
                placeholder="Alamat token ERC-20 (0x…)"
                className="flex-1 border border-wire bg-transparent px-3 py-2 text-sm placeholder:text-paper/30 focus:border-signal"
              />
              <button
                onClick={loadBalances}
                disabled={loadingBalances || !shieldToken.trim()}
                className="border border-wire px-4 py-2 font-display text-xs uppercase tracking-widest text-paper/60 hover:border-paper/40 hover:text-paper disabled:opacity-40"
              >
                {loadingBalances ? "…" : "Cek"}
              </button>
            </div>
            {balances && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="border border-wire px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-paper/40">
                    Publik
                  </p>
                  <p className="font-display text-lg">{balances.public}</p>
                </div>
                <div className="border border-signal/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-signal/70">
                    Shielded
                  </p>
                  <p className="font-display text-lg text-signal">
                    {balances.shielded}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="ledger-rule pt-8">
            <p className="mb-2 font-display text-xs uppercase tracking-widest text-paper/50">
              Shield
            </p>
            <p className="mb-3 text-xs text-paper/40">
              Dua transaksi: approve ERC-20, lalu deposit privat. Wallet akan
              minta tanda tangan dua kali — ini normal, bukan bug.
            </p>
            <div className="flex gap-2">
              <input
                value={shieldAmount}
                onChange={(e) => setShieldAmount(e.target.value)}
                placeholder="Jumlah"
                disabled={step !== "idle"}
                className="flex-1 border border-wire bg-transparent px-3 py-2 text-sm placeholder:text-paper/30 focus:border-signal disabled:opacity-40"
              />
              <button
                onClick={handleShield}
                disabled={step !== "idle" || !shieldToken.trim() || !shieldAmount.trim()}
                className="border border-signal px-4 py-2 font-display text-xs uppercase tracking-widest text-signal hover:bg-signal hover:text-ink disabled:opacity-40"
              >
                {step === "idle" && "Shield"}
                {step === "approving" && "Approve…"}
                {step === "depositing" && "Deposit…"}
                {step === "maturing" && "Menunggu ~10 block…"}
              </button>
            </div>
            {step === "maturing" && (
              <p className="mt-3 text-xs text-amber">
                Dana baru di-shield butuh ~10 block sebelum bisa dibelanjakan
                (note maturity). Jangan langsung transfer dari saldo ini.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
