# Wallet & STRK20 Integration

## Wallet layer

Key file:

```text
lib/starknet/walletClient.ts
```

VINSS connects through Wallet Standard and creates a Starknet `WalletAccountV6`.

STRK20 capability is detected from supported Wallet API versions. The current minimum treated as capable is:

```text
0.10.3
```

## Submission

Private Chat and Offer actions use:

```text
account.strk20InvokeTransaction(...)
```

The frontend Deal Room integration layer builds the action bundle expected by the current wallet/privacy flow and VINSS helper contract.

## Current application revenue

```text
Private message  0.5 STRK
Offer action     1 STRK
```

## Address normalization

Contract addresses are normalized with `num.toHex()` before wallet use so zero-padded felt strings do not violate strict Wallet API formatting.

## Authority

Transaction approval and wallet private keys remain in the wallet. The VINSS backend and Agent do not sign transactions.
