# Wallet-native VINSS application fee: integration blocker

Checked 30 October 2026. The requested result is a separately identified VINSS application fee in Ready's fee breakdown, rather than a transfer/OpenNote presented as a payment operation. This requirement is not satisfied by fee v2: that deployment reduced the app's price but retained its payment mechanism.

## Verified interfaces

- VINSS currently pins starknet.js 10.4.0 and uses Wallet API types 0.10.3.
- The published stable releases checked were starknet.js 10.8.0 and @starknet-io/types-js 0.10.4. The 0.10.4 package was inspected separately; project dependencies were not changed.
- `wallet_strk20InvokeTransaction.params` contains `actions` and optional `api_version`. Its action union contains deposit, withdraw, transfer, invoke and shadow_account_invoke. It does not expose an application fee action or a dapp-selected fee-recipient field.
- The official Starknet.js guide says the wallet adds its fee action when submitting `strk20InvokeTransaction`. It does not document adding a VINSS fee to that wallet-owned charge.
- In the inspected pool source, `collect_fee` reads the pool's configured fee amount and collector. A VINSS helper cannot redirect that existing pool fee to its own treasury.

Sources:

- https://starknet-js.com/docs/guides/account/walletAccount/#submitting-a-strk20-transaction
- https://strk20.starknet.io/docs/starknet-wallet-api/starknet-js
- https://registry.npmjs.org/@starknet-io/types-js/-/types-js-0.10.4.tgz (`dist/types/wallet-api/methods.d.ts` and `components.d.ts`)
- https://github.com/starkware-libs/starknet-privacy/blob/main/packages/privacy/src/privacy.cairo (`collect_fee`)

## Required upstream capability

Ready must expose a supported application-fee integration, or confirm a supported existing integration not described in these public interfaces. It must allow the wallet to independently verify the app identity, token, amount, recipient and action being charged, then present the app charge separately from pool/network charges. The exact request format must come from the wallet's documented API; the fields above are requirements, not an invented payload schema.

After that interface is available, implement its capability detection and fee request in the VINSS wallet adapter. Change the helper payment ABI only if the verified integration requires it. Acceptance requires a real Ready approval screen identifying the VINSS fee under fees, plus receipt/balance verification of the intended charges and recipient. Keep pool charges and Rekber economics independent.

## Current status

Blocked on that wallet integration. No native-wallet fee implementation is claimed. No unsupported payload, replacement treasury, fee waiver, contract redeployment or frontend publication was introduced for this request. Existing fee collection is unchanged. Merely renaming a transfer in VINSS would not satisfy this requirement. No message or issue has been sent to Ready on the user's behalf.
