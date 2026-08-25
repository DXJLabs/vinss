"use client";

import {
  GetStarknetProvider,
  useConnect,
  useStarknetProvider,
} from "@starknet-io/get-starknet-ui";
import {
  StandardConnect,
  StarknetWalletApi,
  type WalletWithStarknetFeatures,
} from "@starknet-io/get-starknet-wallet-standard/features";

import type { WalletWithStarknetFeatures as WalletWithStarknetFeaturesV6 } from
  "@starknet-io/get-starknet-wallet-standard-v6/features";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import { createWalletSession } from "@/lib/starknet/walletClient";
import {
  refreshInjectedWallets,
  walletStore,
  watchForInjectedWallets,
} from "@/lib/starknet/walletStore";

const LAST_WALLET_KEY = "vinss:last-wallet-id";

interface WalletContextValue {
  session: VinssWalletSession | null;
  connected: boolean;
  connectWallet: (wallet: WalletWithStarknetFeatures) => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function WalletState({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connected, connect, disconnect } = useConnect();
  const { wallets } = useStarknetProvider();

  const [session, setSession] =
    useState<VinssWalletSession | null>(null);

  // Ready X can temporarily background/remount the dapp on mobile.
  // Bump this value whenever VINSS becomes active again so wallet
  // connection/session restoration is retried without a manual refresh.
  const [resumeNonce, setResumeNonce] = useState(0);

  useEffect(() => {
    let resumeTimer: number | null = null;

    const resume = () => {
      /*
       * Ready X extension can invalidate the wallet object that
       * initiated connect while the extension was still locked.
       *
       * Re-discover first, then retry restoration after the browser
       * has returned from the extension unlock flow.
       */
      refreshInjectedWallets();

      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
      }

      resumeTimer = window.setTimeout(() => {
        refreshInjectedWallets();
        setResumeNonce((value) => value + 1);
      }, 350);
    };

    const visibility = () => {
      if (document.visibilityState === "visible") {
        resume();
      }
    };

    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", visibility);

      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
      }
    };
  }, []);

  /*
   * Keep wallet discovery alive while the app is open.
   */
  useEffect(() => {
    return watchForInjectedWallets();
  }, []);

  /*
   * Build the VINSS session whenever the Starknet provider
   * reports a connected wallet.
   */
  useEffect(() => {
    let cancelled = false;

    async function buildSession() {
      if (!connected) {
        setSession(null);
        return;
      }

      try {
        const wallet = connected as WalletWithStarknetFeatures;
        const nextSession = await createWalletSession(
          wallet as unknown as WalletWithStarknetFeaturesV6,
        );

        if (cancelled) return;

        setSession(nextSession);

        /*
         * Remember only the public wallet identifier.
         * Never store private keys, accounts or wallet secrets.
         */
        try {
          const walletId =
            wallet.features[StarknetWalletApi].id;

          localStorage.setItem(
            LAST_WALLET_KEY,
            walletId,
          );
        } catch {
          // Wallet may not expose the optional API metadata.
        }
      } catch (error) {
        console.error(
          "[VINSS] failed to create wallet session",
          error,
        );

        if (!cancelled) {
          setSession(null);
        }
      }
    }

    void buildSession();

    return () => {
      cancelled = true;
    };
  }, [connected, resumeNonce]);

  /*
   * RESTORE AFTER BROWSER REFRESH
   *
   * useConnect() itself is React state, therefore it is empty after
   * a full reload. We use the wallet's public ID to find the same
   * discovered wallet and ask it for a silent connection.
   */
  useEffect(() => {
    if (connected || !wallets?.length) return;

    let cancelled = false;

    async function restoreWallet() {
      let lastWalletId: string | null = null;

      try {
        lastWalletId =
          localStorage.getItem(LAST_WALLET_KEY);
      } catch {
        // Storage may be unavailable; silent wallet probing can
        // still recover an already-approved connection.
      }

      const available = wallets.filter(
        (entry) => entry.state === "available",
      );

      if (available.length === 0) return;

      // Prefer the previously connected wallet, but on FIRST connect
      // there is no saved wallet id yet. In that case silently probe
      // discovered wallets. `silent: true` must never open a popup.
      const candidates = lastWalletId
        ? [
            ...available.filter((entry) => {
              try {
                return (
                  entry.wallet.features[StarknetWalletApi].id ===
                  lastWalletId
                );
              } catch {
                return false;
              }
            }),
            ...available.filter((entry) => {
              try {
                return (
                  entry.wallet.features[StarknetWalletApi].id !==
                  lastWalletId
                );
              } catch {
                return true;
              }
            }),
          ]
        : available;

      for (const entry of candidates) {
        if (cancelled) return;

        try {
          const result =
            await entry.wallet.features[
              StandardConnect
            ].connect({
              silent: true,
            });

          if (
            cancelled ||
            result.accounts.length === 0
          ) {
            continue;
          }

          // Synchronize get-starknet-ui state. Because the wallet is
          // already silently connected this should not request approval.
          await connect(entry.wallet);
          return;
        } catch {
          // This wallet has no approved connection. Try the next one.
        }
      }
    }
    void restoreWallet();

    return () => {
      cancelled = true;
    };
  }, [connected, wallets, connect, resumeNonce]);

  const value = useMemo<WalletContextValue>(
    () => ({
      session,
      connected: Boolean(session),

      connectWallet: async (
        wallet: WalletWithStarknetFeatures,
      ) => {
        await connect(wallet);
      },

      disconnectWallet: () => {
        void disconnect();

        try {
          localStorage.removeItem(LAST_WALLET_KEY);
        } catch {
          // Ignore storage errors.
        }

        setSession(null);
      },
    }),
    [session, connect, disconnect],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GetStarknetProvider store={walletStore}>
      <WalletState>{children}</WalletState>
    </GetStarknetProvider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error(
      "useWallet must be used inside WalletProvider",
    );
  }

  return context;
}
