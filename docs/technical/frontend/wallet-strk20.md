# Wallet & STRK20 Integration

## Objective

The wallet layer keeps transaction signing and user authorization outside the VINSS backend and Agent.

## Wallet session

VINSS connects with Wallet Standard and constructs a Starknet `WalletAccountV6`.

## STRK20 capability detection

Current minimum treated as STRK20-capable:

```text
0.10.3
```

Implementation:

```ts
const versions = await walletV6.supportedWalletApi(wallet);

return versions.some(
  (version) =>
    compareVersion(version, MIN_STRK20_WALLET_API) >= 0,
);
```

Capability is detected through supported API versions rather than by attempting a data-moving action.

## Execution primitive

Private Message, Offer, Invite, and Escrow-related paths use:

```ts
account.strk20InvokeTransaction(...)
```

with action bundles appropriate to each helper.

## Address normalization

The STRK20 Wallet API validates felt-like fields strictly.

VINSS normalizes contract/token addresses with:

```ts
function normalizeAddress(address: string): string {
  return address ? num.toHex(address) : address;
}
```

This avoids invalid zero-padded felt formatting at wallet boundaries.

## Authority boundary

```text
VINSS frontend
    prepares action
        ↓
wallet
    shows / authorizes action
        ↓
STRK20 Wallet API
        ↓
Privacy Pool / helper
```

The frontend never receives the wallet private key.

The backend and Agent do not sign transactions.

## Network boundary

Contract addresses are environment-driven because Sepolia and mainnet deployments differ.

Frontend network, RPC, backend, and contract configuration must all refer to the same environment.
