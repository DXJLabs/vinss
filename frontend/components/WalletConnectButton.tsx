"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
} from "react";

const WalletConnectModal = dynamic(
  () =>
    import(
      "@starknet-io/get-starknet-ui"
    ).then(
      (m) => m.WalletConnectModal,
    ),
  { ssr: false },
);

import {
  useWallet,
} from "@/components/providers/WalletProvider";
import {
  refreshInjectedWallets,
} from "@/lib/starknet/walletStore";

export function WalletConnectButton({
  showCapability = true,
}: {
  showCapability?: boolean;
}) {
  const {
    session,
    connected,
  } = useWallet();

  const connectedRef =
    useRef(connected);

  const connectAttemptedRef =
    useRef(false);

  useEffect(() => {
    connectedRef.current = connected;

    if (connected) {
      connectAttemptedRef.current = false;
    }
  }, [connected]);

  useEffect(() => {
    const recoverAfterWalletUnlock = () => {
      if (
        !connectAttemptedRef.current ||
        connectedRef.current
      ) {
        return;
      }

      /*
       * Ready X may refresh its injected wallet object while the browser
       * is backgrounded. Rediscover it when VINSS becomes active again,
       * but never remount the wallet modal here: doing so can abort an
       * in-flight connect request before Ready X has finished.
       */
      refreshInjectedWallets();
    };

    const visibility = () => {
      if (
        document.visibilityState === "visible"
      ) {
        recoverAfterWalletUnlock();
      }
    };

    window.addEventListener(
      "focus",
      recoverAfterWalletUnlock,
    );
    window.addEventListener(
      "pageshow",
      recoverAfterWalletUnlock,
    );
    document.addEventListener(
      "visibilitychange",
      visibility,
    );

    return () => {
      window.removeEventListener(
        "focus",
        recoverAfterWalletUnlock,
      );
      window.removeEventListener(
        "pageshow",
        recoverAfterWalletUnlock,
      );
      document.removeEventListener(
        "visibilitychange",
        visibility,
      );

    };
  }, []);

  const capability = connected
    ? session?.strk20Capable
      ? "STRK20 · SUPPORTED"
      : "STRK20 · NOT SUPPORTED"
    : "NOT CONNECTED";

  return (
    <div
      className="flex flex-col items-end gap-1.5"
      onFocusCapture={
        refreshInjectedWallets
      }
      onPointerDown={() => {
        connectAttemptedRef.current = true;
        refreshInjectedWallets();
      }}
    >
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

      {connected &&
        showCapability && (
          <div className="flex items-center gap-1.5 pr-1 text-[9px] font-mono uppercase tracking-wider text-paper/45">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />

            <span>
              {capability}
            </span>
          </div>
        )}
    </div>
  );
}
