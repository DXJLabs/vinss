# Public Unshield mode — Starknet Sepolia acceptance

VINSS Unshield is the **public wallet ERC20 transfer mode**, not
`strk20InvokeTransaction({type:"withdraw"})`.

1. Open Deal Room payment sheet; confirm default Shield still shows original Rekber.
2. Select Unshield · Public. Public wallet balance must hold small test STRK/USDC and gas.
3. Enter an address **you control**. Verify asset, amount and chain in wallet.
4. Confirm the ordinary account execute ERC20 transfer.
5. Verify successful on-chain receipt and matching token Transfer event. A hash alone is not success.
6. Check no VINSS service fee transfer and no Rekber contract execution.
7. Check Shield flow and encrypted messages are unaffected. Avoid Mainnet until reviewed.

No real Sepolia transaction is claimed by source unit tests. The older
`verify-sepolia-unshield.mjs` script validates supplied receipt/event
information only; it cannot establish a private-note withdrawal.
