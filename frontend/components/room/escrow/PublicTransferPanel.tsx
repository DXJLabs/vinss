"use client";

import { useEffect, useRef, useState } from "react";
import { hash as starknetHash, walletV6 } from "starknet";
import { NETWORK, STRK_ADDRESS, USDC_ADDRESS } from "@/lib/starknet/constants";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { getProvider } from "@/lib/starknet/walletClient";
import { assertUnshieldNetwork, formatTokenUnits, parseTokenUnits } from "@/lib/starknet/unshield";
import { buildPublicTransferCall } from "@/lib/starknet/publicTransfer";
import { verifyPublicTransferReceipt } from "@/lib/starknet/publicTransferReceipt";
import type { ExpectedPublicTransfer, PublicTransferReceiptResult } from "@/lib/starknet/publicTransferReceipt";

type Asset = "STRK" | "USDC";
const assetConfig = (asset: Asset) => asset === "STRK"
  ? { address: STRK_ADDRESS, decimals: 18 }
  : { address: USDC_ADDRESS, decimals: 6 };

/** Keep tracking in the room so closing the sheet cannot hide a submitted payment. */
export function usePublicTransferTracking() {
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState<(ExpectedPublicTransfer & { asset: Asset; displayAmount: string }) | null>(null);
  const [receipt, setReceipt] = useState<PublicTransferReceiptResult>({ status: "pending" });
  const [checking, setChecking] = useState(false);
  const submitting = useRef(false);
  const checkingReceipt = useRef(false);
  const pending = transfer !== null && receipt.status === "pending";
  return { busy, setBusy, transfer, setTransfer, receipt, setReceipt, checking, setChecking,
    submitting, checkingReceipt, pending };
}

export function PublicTransferPanel({ session, tracking }: {
  session: VinssWalletSession | null;
  tracking: ReturnType<typeof usePublicTransferTracking>;
}) {
  const [asset, setAsset] = useState<Asset>("STRK");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { busy, setBusy, transfer, setTransfer, receipt, setReceipt, checking, setChecking,
    submitting, checkingReceipt, pending } = tracking;
  const [error, setError] = useState("");

  useEffect(() => {
    setConfirmed(false); setError(""); setRecipient("");
  }, [session?.address]);

  const token = assetConfig(asset);
  let displayAmount = "";
  try { displayAmount = formatTokenUnits(parseTokenUnits(amount, token.decimals), token.decimals); }
  catch { displayAmount = ""; }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || pending) return;
    setError("");
    if (!session) { setError("Connect a Starknet wallet before transferring."); return; }
    if (!confirmed) { setError("Confirm the public recipient, amount and lack of escrow protection."); return; }
    try {
      if (!token.address) throw new Error("Token address is not configured on this network.");
      // Validate address, exact amount and calldata before requesting wallet signature.
      const call = buildPublicTransferCall({
        token: token.address, recipient, amount, decimals: token.decimals,
      });
      submitting.current = true;
      setBusy(true);
      const [walletChainId, rpcChainId] = await Promise.all([
        walletV6.requestChainId(session.wallet), getProvider().getChainId(),
      ]);
      assertUnshieldNetwork(NETWORK, walletChainId, rpcChainId);
      // Unshield mode = public ERC20 transfer, NOT STRK20 withdraw.
      const tx = await session.account.execute(call);
      if (!tx.transaction_hash) throw new Error("Wallet did not return a transaction hash. Check wallet activity before retrying.");
      setTransfer({
        transactionHash: tx.transaction_hash, token: call.contractAddress,
        sender: session.address, recipient: call.calldata[0],
        amountUnits: BigInt(call.calldata[1]) + (BigInt(call.calldata[2]) << 128n),
        transferSelector: starknetHash.getSelectorFromName("Transfer"),
        asset, displayAmount,
      });
      setReceipt({ status: "pending" });
      setConfirmed(false); setAmount("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Public transfer failed.");
    } finally { submitting.current = false; setBusy(false); }
  }

  async function checkReceipt() {
    if (!transfer || checkingReceipt.current) return;
    checkingReceipt.current = true;
    setChecking(true); setError("");
    try {
      const provider = getProvider();
      const chainId = await provider.getChainId();
      assertUnshieldNetwork(NETWORK, chainId, chainId);
      const result = verifyPublicTransferReceipt(
        await provider.getTransactionReceipt(transfer.transactionHash), transfer,
      );
      setReceipt(result);
    } catch {
      // An RPC outage or an unavailable/mismatched receipt does not mean the payment failed.
      setError("Payment is still unverified. Check the explorer or retry status; do not send it again.");
    } finally { checkingReceipt.current = false; setChecking(false); }
  }

  return (
    <section aria-label="Unshield public payment" className="space-y-4">
      <p className="rounded-lg border border-amber/30 bg-amber/5 p-3 text-xs leading-5 text-paper/70">
        <strong className="text-amber">Public, not escrow.</strong>{" "}
        Unshield sends tokens from your public wallet balance. It does not withdraw a STRK20
        private balance and cannot be reversed by Rekber. Room chat and Offers remain encrypted.
      </p>
      <form className="space-y-4" onSubmit={submit}>
        <fieldset disabled={busy || pending} className="space-y-4">
          <legend className="sr-only">Public transfer details</legend>
          <label className="block text-xs text-paper/70">Asset
            <select name="asset" value={asset} onChange={(e) => { setAsset(e.target.value as Asset); setConfirmed(false); }}
              className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-3 text-paper">
              <option value="STRK">STRK</option><option value="USDC">USDC</option>
            </select>
          </label>
          <label className="block text-xs text-paper/70">Public recipient address
            <input name="recipient" required autoCapitalize="off" autoCorrect="off" value={recipient} onChange={(e) => { setRecipient(e.target.value); setConfirmed(false); }}
              placeholder="0x..." autoComplete="off" spellCheck={false}
              className="mt-1.5 w-full rounded-lg border border-wire bg-ink px-3 py-3 font-mono text-xs text-paper" />
          </label>
          <label className="block text-xs text-paper/70">Amount ({asset})
            <input name="amount" required value={amount} onChange={(e) => { setAmount(e.target.value); setConfirmed(false); }}
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
            <input name="acknowledgement" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I verified the recipient and know this public payment has no escrow or refund guarantee.
          </label>
          <button type="submit" disabled={!session || busy || pending || !confirmed || !displayAmount || !recipient}
            className="w-full rounded-lg bg-signal px-4 py-3 text-sm font-medium text-ink disabled:opacity-40">
            {busy ? "Waiting for wallet…" : "Review public transfer in wallet"}
          </button>
        </fieldset>
      </form>
      {error && <p role="alert" className="break-words text-xs text-danger">{error}</p>}
      {transfer && <div className="space-y-3 rounded-lg border border-wire p-3 text-xs">
        <p role="status" className="text-signal">
          {receipt.status === "confirmed" ? "Confirmed: exact token transfer verified." :
            receipt.status === "reverted" ? "Transaction reverted. No payment completed; network gas may still apply." :
            "Submitted, not yet confirmed. Check status before sending another payment."}
        </p>
        <p className="break-all text-paper/65">{transfer.displayAmount} {transfer.asset} → {transfer.recipient}</p>
        <a className="block break-all underline" target="_blank" rel="noreferrer"
          href={(NETWORK === "mainnet" ? "https://starkscan.co/tx/" : "https://sepolia.starkscan.co/tx/") + transfer.transactionHash}>
          {transfer.transactionHash}
        </a>
        {receipt.status === "confirmed" && receipt.networkFee && <p className="text-paper/65">
          Actual network fee: {formatTokenUnits(receipt.networkFee.amount, 18)} {receipt.networkFee.unit === "FRI" ? "STRK" : "ETH"}. VINSS transfer service fee: 0.
        </p>}
        {pending && <button type="button" onClick={checkReceipt} disabled={checking}
          className="min-h-12 rounded-lg border border-wire px-4 py-3 disabled:opacity-40">
          {checking ? "Checking receipt…" : "Check transaction status"}
        </button>}
      </div>}
    </section>
  );
}
