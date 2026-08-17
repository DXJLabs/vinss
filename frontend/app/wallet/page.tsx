"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { getProvider } from "@/lib/starknet/walletClient";
import { shield } from "@/lib/vinss-sdk/shield";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";

/**
 * Shield / balance UI.
 *
 * - A deposit is TWO transactions (ERC-20 approve, then the private
 *   deposit) — the wallet prompts twice; named as two steps so it doesn't
 *   read as a stuck/duplicate prompt.
 * - Freshly shielded notes mature ~10 blocks before they're spendable —
 *   tracked live against the chain head, not a fixed timer.
 * - The pool charges a flat per-operation fee — not yet read live here
 *   (TODO: wire `get_fee_amount` once exposed).
 * - `strk20Balances([])` is a balance READ gated behind wallet consent —
 *   only called on an explicit user press.
 */

const MATURITY_BLOCKS = 10;

type Step = "idle" | "submitting" | "maturing" | "done";

export default function WalletPage() {
  const [session, setSession] = useState<VinssWalletSession | null>(null);
  const [balances, setBalances] = useState<{
    public: string;
    shielded: string;
  } | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [shieldAmount, setShieldAmount] = useState("");
  const [shieldToken, setShieldToken] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [shieldedAtBlock, setShieldedAtBlock] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the chain head only while a note is maturing — stop as soon as it
  // matures or the user leaves the page.
  useEffect(() => {
    if (step !== "maturing" || shieldedAtBlock === null) return;

    const provider = getProvider();
    pollRef.current = setInterval(async () => {
      try {
        const head = await provider.getBlockNumber();
        setCurrentBlock(head);
        if (head - shieldedAtBlock >= MATURITY_BLOCKS) {
          setStep("done");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Transient RPC hiccup — next tick retries, nothing to show the user.
      }
    }, 4000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, shieldedAtBlock]);

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
    setStep("submitting");
    try {
      const amount = BigInt(shieldAmount.trim());
      await shield(session.account, amount, shieldToken.trim());

      const provider = getProvider();
      const head = await provider.getBlockNumber();
      setShieldedAtBlock(head);
      setCurrentBlock(head);
      setStep("maturing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal shield.");
      setStep("idle");
    }
  }

  function resetShield() {
    setStep("idle");
    setShieldedAtBlock(null);
    setCurrentBlock(null);
    setShieldAmount("");
  }

  const blocksLeft =
    shieldedAtBlock !== null && currentBlock !== null
      ? Math.max(0, MATURITY_BLOCKS - (currentBlock - shieldedAtBlock))
      : MATURITY_BLOCKS;

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
              minta tanda tangan dua kali — ini normal, bukan bug. Ini juga
              yang meregistrasi akunmu di pool: wajib sekali sebelum kirim
              pesan/transfer privat apa pun.
            </p>

            {step === "idle" && (
              <div className="flex gap-2">
                <input
                  value={shieldAmount}
                  onChange={(e) => setShieldAmount(e.target.value)}
                  placeholder="Jumlah (raw units, mis. wei-STRK)"
                  className="flex-1 border border-wire bg-transparent px-3 py-2 text-sm placeholder:text-paper/30 focus:border-signal"
                />
                <button
                  onClick={handleShield}
                  disabled={!shieldToken.trim() || !shieldAmount.trim()}
                  className="border border-signal px-4 py-2 font-display text-xs uppercase tracking-widest text-signal hover:bg-signal hover:text-ink disabled:opacity-40"
                >
                  Shield
                </button>
              </div>
            )}

            {step === "submitting" && (
              <div className="border border-wire px-4 py-3 text-xs text-paper/60">
                Menunggu tanda tangan wallet (approve → deposit)…
              </div>
            )}

            {step === "maturing" && (
              <div className="border border-amber/40 px-4 py-3">
                <p className="text-xs text-amber">
                  Deposit terkirim. Menunggu maturity: {blocksLeft} block lagi.
                </p>
                <p className="mt-1 text-[10px] text-paper/40">
                  Jangan kirim pesan/transfer privat dari saldo ini sebelum
                  matang — akan gagal.
                </p>
              </div>
            )}

            {step === "done" && (
              <div className="border border-signal/40 px-4 py-3">
                <p className="text-xs text-signal">
                  Matang. Akun sudah teregistrasi di pool — silakan lanjut ke
                  room untuk kirim pesan privat.
                </p>
                <button
                  onClick={resetShield}
                  className="mt-2 font-display text-[10px] uppercase tracking-widest text-paper/40 hover:text-paper"
                >
                  Shield lagi
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
