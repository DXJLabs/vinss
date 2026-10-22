# Native STRK20 Shield & Unshield — Frontend Technical Addendum

> Audited on `feat/strk20-unshield-fees`, 23 October 2026. UI/source implementation is **not** evidence of a real Sepolia private balance transfer or a Mainnet deployment.

## Paths, transaction shapes, fee authority

| Route | Meaning | Native STRK20 action | Added VINSS revenue transfer |
|---|---|---|---|
| `/shield` | Public STRK/USDC → shielded wallet balance | `{type:"deposit", token, amount}` | None |
| `/unshield` | Shielded balance → public Starknet recipient | `{type:"withdraw", token, amount, recipient}` | None |
| `/fees` | Read deployed helper fee quotes | RPC `callContract` | No write |

The same VINSS wallet connects from both forms, with reciprocal navigation and homepage actions. Both require `strk20Capable`, a valid positive amount and an explicit acknowledgment; `/unshield` also validates a public recipient address. Calls use `session.account.strk20InvokeTransaction([action])`, **not** a generic `account.execute` or a VINSS fee transfer.

### Safety invariants

- `buildShieldAction` and `buildUnshieldAction`, in `frontend/lib/starknet/unshield.ts`, use bigint decimal conversion (STRK 18 decimals, USDC 6) and normalize Starknet felt addresses. Principal is not the app or protocol fee.
- `walletV6.requestChainId(session.wallet)` and `getProvider().getChainId()` are checked immediately before signing and must agree with `NETWORK`. This is a **per-route** guard, not proof all VINSS workflows have one.
- The form does not set STRK20 fees. Wallet/protocol/network charges are reviewed in the connected wallet; Shield may cost more than Unshield, but no invented fixed price is displayed.
- VINSS's new **source** flat service fee floors are Message $0.01, Offer $0.05, room activation $0.05. Active deployed rates can differ; read them from helper-linked FeePolicy. Rekber remains 2% with its unchanged minimum and sponsor reserves.
- The wallet-submitted transaction hash means *submitted*, **not confirmed**. Wallet balance, chain receipt and public transfer proof are different evidence classes.
- Users should back up the STRK20 viewing key via wallet-controlled UI, never paste it into VINSS.

## Execution and verification

1. Configure exact **Sepolia** RPC/token addresses; connect supported wallet with test tokens and gas.
2. Shield a small amount in `/shield`, review wallet fees and confirm; verify the accepted receipt and new private wallet balance.
3. Unshield a small amount to an owned public Sepolia address; confirm token, recipient, amount and wallet fees first.
4. Use `frontend/scripts/verify-sepolia-unshield.mjs` to verify chain ID, successful accepted INVOKE receipt and a matching public ERC-20 Transfer. This establishes evidence of **public payout**, not internal private-account accounting.
5. Use `frontend/scripts/audit-sepolia-fees.mjs` to read the actual Message/Offer/Room helper FeePolicy quotes from Sepolia. This does not prove the newer policy class has been deployed.
6. Record wallet/version, hash, contract/token addresses, wallet fee quote, network fee and confirmed outcome in the Sepolia acceptance record.

Current CI run [39812347541](https://github.com/DXJLabs/vinss/actions/runs/39812347541) passed Shield/Unshield UI tests, TypeScript typecheck, frontend production build and Cairo tests. **It did not submit a wallet transaction.**

See [Unshield Sepolia verification](./unshield-sepolia-verification.md) and [Message security audit](./messaging-implementation-audit.md).

## No changes in this addendum

No Mainnet deployment, change to `main`, Rekber fee change, STRK20 protocol fee change, redesign of VINSS home UI, or merge with `feat/openmls-starknet`.
