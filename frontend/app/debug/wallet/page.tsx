"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { walletV6 } from "starknet";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useWallet } from "@/components/providers/WalletProvider";

// Only version queries are sent. Never probe support by submitting a transaction.
async function queryVersion(query: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      Promise.resolve().then(query),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("No response within 15 seconds")), 15_000);
      }),
    ]);
    return { status: "ok", value };
  } catch (error) {
    // Do not export raw errors: wallets may attach request/account details.
    const code = typeof error === "object" && error !== null && "code" in error
      && typeof error.code === "number" ? error.code : null;
    return { status: "unavailable", code };
  } finally {
    clearTimeout(timer);
  }
}

export default function WalletDebugPage() {
  const { session } = useWallet();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ wallet: typeof session; json: string } | null>(null);
  const running = useRef(false);
  const visibleReport = report?.wallet === session ? report.json : null;

  async function inspect() {
    if (!session || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const wallet = session.wallet;
      const api = wallet.features["starknet:walletApi"];
      const [walletApi, rpcSpecs] = await Promise.all([
        queryVersion(() => walletV6.supportedWalletApi(wallet)),
        queryVersion(() => walletV6.supportedSpecs(wallet)),
      ]);
      const features = Object.entries(wallet.features).map(([name, value]) => ({
        name,
        version: value && typeof value === "object" && "version" in value
          && typeof value.version === "string" ? value.version : null,
      }));
      setReport({ wallet: session, json: JSON.stringify({
        checkedAt: new Date().toISOString(),
        wallet: { name: wallet.name, id: api.id, walletVersion: api.walletVersion },
        features,
        walletApi,
        rpcSpecs,
        applicationFee: "Not established by version or feature listing. Requires a documented integration and wallet confirmation.",
      }, null, 2) });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function download() {
    if (!visibleReport) return;
    const url = URL.createObjectURL(new Blob([visibleReport], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vinss-wallet-debug.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-5 py-10 text-paper">
      <Link href="/" className="text-signal">← VINSS</Link>
      <h1 className="text-2xl font-semibold">Wallet integration debug</h1>
      <p className="text-paper/70">Connect Ready, then inspect its advertised features and API versions. This check does not sign messages, submit transactions, or read shielded balances.</p>
      <WalletConnectButton showCapability={false} />
      <button type="button" onClick={inspect} disabled={!session || busy}
        className="rounded-xl border border-signal px-4 py-3 text-signal disabled:opacity-40">
        {busy ? "Checking wallet…" : "Inspect wallet support"}
      </button>
      <p className="text-sm text-paper/60">A version number does not prove application-fee support. An unavailable query means no result was obtained; it does not establish that all STRK20 features are unsupported.</p>
      {visibleReport && <>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-paper/20 p-4 text-xs">{visibleReport}</pre>
        <button type="button" onClick={download} className="rounded-xl border border-paper/30 px-4 py-3">Download debug JSON</button>
        <p className="text-sm text-paper/60">The report contains wallet metadata and versions. Account addresses, balances, viewing keys, and transaction data are excluded. Results stay in this page until you download them.</p>
      </>}
    </main>
  );
}
