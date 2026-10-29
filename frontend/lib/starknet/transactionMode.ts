/** Rail identity is scoped to an account view; it never mutates the connected wallet. */
import type { WalletAccountV6 } from "starknet";
export type TransactionMode = "shield" | "unshield";
const scopes = new WeakMap<object, { mode: TransactionMode; roomId?: string }>();
export function transactionModeOf(account?: object | null): TransactionMode {
  return account ? scopes.get(account)?.mode ?? "shield" : "shield";
}
export function roomIdOf(account: object): string | undefined { return scopes.get(account)?.roomId; }
export function accountForMode(account: WalletAccountV6, mode: TransactionMode, roomId?: string): WalletAccountV6 {
  const scoped = new Proxy(account, { get(target, key) {
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  scopes.set(scoped, { mode, roomId });
  wallets.set(scoped, wallets.get(account));
  return scoped;
}
export function parseTransactionMode(value: unknown): TransactionMode {
  if (value === undefined || value === "shield") return "shield";
  if (value === "unshield") return "unshield";
  throw new Error("Unsupported VINSS transaction mode.");
}
const wallets = new WeakMap<object, unknown>();
export function bindAccountWallet(account: object, wallet: unknown): void { wallets.set(account, wallet); }
export function walletForAccount(account: object): unknown { return wallets.get(account); }
/** Read-only context for deployment-specific quotes without a connected wallet. */
export function createRailContext(mode: TransactionMode): object {
  const context = {};
  scopes.set(context, { mode });
  return context;
}
