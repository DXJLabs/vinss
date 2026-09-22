import { CONTRACTS, NETWORK } from "./constants";

// Existing mainnet data stays in place. Sepolia never reads those unscoped
// records, including old optimistic transactions and settlement secrets.
export const TESTNET_STORAGE_PREFIX = "vinss:sepolia:";
export const STORAGE_PREFIX = NETWORK === "mainnet" ? "" :
  `${TESTNET_STORAGE_PREFIX}${CONTRACTS.privacyPool}:`;

function keys(): string[] {
  return Object.keys(window.localStorage).filter((key) => STORAGE_PREFIX
    ? key.startsWith(STORAGE_PREFIX)
    : !key.startsWith(TESTNET_STORAGE_PREFIX));
}

export const networkStorage = {
  getItem(key: string): string | null { return window.localStorage.getItem(STORAGE_PREFIX + key); },
  setItem(key: string, value: string): void { window.localStorage.setItem(STORAGE_PREFIX + key, value); },
  removeItem(key: string): void { window.localStorage.removeItem(STORAGE_PREFIX + key); },
  get length(): number { return keys().length; },
  key(index: number): string | null {
    const key = keys()[index];
    return key === undefined ? null : key.slice(STORAGE_PREFIX.length);
  },
};
