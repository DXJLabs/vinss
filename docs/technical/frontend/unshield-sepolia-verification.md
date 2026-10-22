# Native STRK20 Unshield — Sepolia verification

Scope: branch feat/strk20-unshield-fees. Do not deploy Mainnet or change main.

## Proof boundaries

CI verifies exact token-unit conversions, wallet/RPC chain guard, read-only FeePolicy quote logic, and receipt-verifier behavior against synthetic cases. CI success is not proof of any real Sepolia transaction.

## Steps with a real wallet

1. Connect a STRK20-capable wallet on Sepolia with a small shielded test balance (and adequate network gas). Keep all private keys inside the wallet.
2. Open VINSS /unshield, select STRK or USDC, enter a small amount and a public Sepolia recipient you control. Check the wallet's fees and approve.
3. Save the transaction hash. Submitted is not the same as confirmed.
4. In frontend/.env.local set NEXT_PUBLIC_STARKNET_NETWORK=sepolia, NEXT_PUBLIC_RPC_URL, and the relevant NEXT_PUBLIC_STRK_ADDRESS or NEXT_PUBLIC_USDC_ADDRESS. Only use verified Sepolia contract addresses.
5. From frontend/ after npm ci, run:

```bash
node --experimental-strip-types scripts/verify-sepolia-unshield.mjs 0x_TX_HASH STRK 0x_RECIPIENT 0.0001
```

Use the *actual* transaction hash, selected asset, recipient and amount. USDC is supported with 6 decimals, STRK with 18.

The read-only verifier checks Sepolia chain ID, transaction hash, accepted status, successful INVOKE execution, and an exact ERC-20 Transfer event to the public recipient. Legacy and SNIP-13 indexed event layouts are supported. Network actual_fee is reported in its original WEI/FRI unit; it is not the VINSS fee or the STRK20 privacy fee.

An ERC-20 Transfer event is evidence of public payout, not independent proof of wallet shielded-accounting behavior or confidential STRK20 internals. If an event is absent, investigate receipt and token ABI instead of marking success.

## On-chain VINSS app fees

Run node scripts/audit-sepolia-fees.mjs with current Sepolia helper addresses. It reads linked FeePolicy and current quotes; it does not prove reduced source fee rates are deployed. Rekber minimum/reserve and 2% remain unchanged.

Keep an acceptance record: asset, amount, recipient, tx hash, receipt, token Transfer event, wallet quoted protocol fee, on-chain actual_fee, and active VINSS helper quote. Do not paste private keys or private messaging content.