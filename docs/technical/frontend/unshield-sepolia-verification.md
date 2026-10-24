# Public Unshield mode — Starknet Sepolia acceptance

VINSS Unshield is the **public wallet ERC20 transfer mode**, not
`strk20InvokeTransaction({type:"withdraw"})`.

1. Open Deal Room payment sheet; confirm default Shield still shows original Rekber.
2. Select Unshield · Public. Public wallet balance must hold small test STRK/USDC and gas.
3. Enter an address **you control**. Verify asset, amount and chain in wallet.
4. Confirm the ordinary account execute ERC20 transfer.
5. Use **Check transaction status**. Only an accepted, successful INVOKE with
   the exact token, sender, recipient and amount becomes confirmed. A hash alone
   is not success. Pending blocks another transfer; check that closing/reopening
   the sheet and switching modes preserves that pending status. RPC failure must
   leave the hash available and payment unverified. Test a reverted receipt too.
   Actual gas must be displayed separately from the transferred amount and VINSS fee.
6. Check no VINSS service fee transfer and no Rekber contract execution.
7. Check Shield flow and encrypted messages are unaffected. Avoid Mainnet until reviewed.

No real Sepolia transaction is claimed by source unit tests. The read-only `frontend/scripts/verify-sepolia-unshield.mjs` uses the same
receipt verifier as the UI. It requires a known sending wallet and deployment
configuration, and does not establish a private-note withdrawal:

```bash
cd frontend
NEXT_PUBLIC_STARKNET_NETWORK=sepolia node --experimental-strip-types scripts/verify-sepolia-unshield.mjs TX_HASH STRK RECIPIENT AMOUNT SENDER
```

Set `NEXT_PUBLIC_RPC_URL` and the appropriate `NEXT_PUBLIC_STRK_ADDRESS` or
`NEXT_PUBLIC_USDC_ADDRESS` from the deployment before running. The final
`SENDER` argument is now required; older four-argument invocations must be
updated. Save the transaction hash before reloading: UI tracking currently
lives in room page memory only.
