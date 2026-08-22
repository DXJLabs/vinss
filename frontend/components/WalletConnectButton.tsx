"use client";

import dynamic from "next/dynamic";

const WalletConnectModal = dynamic(
  () => import("@starknet-io/get-starknet-ui").then((m) => m.WalletConnectModal),
  { ssr: false },
);
import { useWallet } from "@/components/providers/WalletProvider";

export function WalletConnectButton({
  showCapability = true,
}: {
  showCapability?: boolean;
}) {
  const { session, connected } = useWallet();

  const capability = connected
    ? session?.strk20Capable
      ? "STRK20 · SUPPORTED"
      : "STRK20 · NOT SUPPORTED"
    : "NOT CONNECTED";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <WalletConnectModal
        buttonClassName="
          border border-signal/60
          bg-signal/5
          px-3 py-1.5
          font-display
          text-[10px]
          font-medium
          uppercase
          tracking-widest
          text-signal
          transition-all
          hover:bg-signal
          hover:text-ink
        "
      />

      {connected && showCapability && (
        <div className="flex items-center gap-1.5 pr-1 text-[9px] font-mono uppercase tracking-wider text-paper/45">
          <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_5px_#10b981]" />
          <span>{capability}</span>
        </div>
      )}
    </div>
  );
}
