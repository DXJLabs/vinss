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
        const nextSession = await createWalletSession(wallet);

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
  }, [connected]);

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
        return;
      }

      if (!lastWalletId) return;

      const match = wallets.find((entry) => {
        if (entry.state !== "available") return false;

        try {
          return (
            entry.wallet.features[StarknetWalletApi].id ===
            lastWalletId
          );
        } catch {
          return false;
        }
      });

      if (!match || match.state !== "available") return;

      try {
        /*
         * IMPORTANT:
         * Do not open the wallet popup again.
         *
         * Wallet Standard's silent=true asks the wallet whether
         * the existing permission/connection can be restored.
         */
        const result =
          await match.wallet.features[
            StandardConnect
          ].connect({
            silent: true,
          });

        if (cancelled) return;

        if (result.accounts.length > 0) {
          await connect(match.wallet);
        }
      } catch (error) {
        /*
         * Silent restore failing is not an application error.
         * The user can simply press Connect Wallet again.
         */
        console.info(
          "[VINSS] silent wallet restore unavailable",
          error,
        );
      }
    }

    void restoreWallet();

    return () => {
      cancelled = true;
    };
  }, [connected, wallets, connect]);

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
