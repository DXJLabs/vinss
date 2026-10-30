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


## Follow-up: live wallet and submission fee ownership

The user's read-only diagnostic succeeded with Ready X (`argentX`), advertising Wallet API versions `0.10.4`, `0.10.3`, and `0.7.2`. Its wallet-version metadata was the literal string `undefined`. The report's `applicationFee` text was written by VINSS, not returned by Ready. Neither that text nor version support proves app-fee acceptance or rejection.

Upstream clarification [starknet-specs PR #401](https://github.com/starkware-libs/starknet-specs/pull/401) explicitly describes the wallet's paymaster/relayer fee action as a **withdrawal**. For `wallet_strk20InvokeTransaction`, the wallet adds it; for `wallet_strk20PrepareInvoke`, the submitting dapp must arrange its own paymaster fee withdrawal. Thus a withdrawal can fund a fee; the unresolved requirement is wallet recognition and presentation, not the mere existence of a token movement.

The reference [client paymaster implementation](https://github.com/starkware-libs/starknet-privacy/blob/main/client/src/paymaster.ts) likewise returns a quoted withdrawal (`type`, `recipient`, `token`, `amount`) to add before proving. This establishes an alternative submission architecture, not permission to change Ready's quote or classify an arbitrary treasury withdrawal as an application fee. A dapp-owned relayer could in principle collect a payment and distribute proceeds, but Ready's approval UI classification remains unverified. Do not migrate VINSS to that architecture on this evidence alone.

The pool's `collect_fee` is a separate mechanism: it charges the caller using the configured pool amount and collector. No receipt or complete wallet breakdown has established how the screenshot's 2 STRK splits between pool cost, network cost, and relayer pricing. Do not infer its precise composition or mainnet price formula from the screenshot.

No supported application-fee request has been found in the public Wallet API examined. The public argent-x repository tree also did not expose STRK20-specific files in the path inventory checked; it cannot establish how the user's installed privacy-capable Ready build classifies fees. Absence from that source is not proof that a private integration does not exist.

### Exact integration question for Ready (draft; not sent)

> We use Ready X with Wallet API 0.10.4 for VINSS. Can a dapp collect an application fee to its treasury and have Ready explicitly display it as a separate VINSS application fee in the fee breakdown of a STRK20 approval, rather than as an ordinary withdraw/transfer/OpenNote operation? If supported, please provide the documented request shape, supported wallet versions, fee-recipient verification requirements, and a Sepolia example. Does a dapp-submitted `wallet_strk20PrepareInvoke` flow support such classification, or only a relayer fee configured by Ready? We need to preserve the existing pool fee and avoid duplicate fees.

Investigation status: payment execution is available, but the requested Ready fee presentation remains blocked on an identified supported integration. No financial probe, new fee, contract upgrade, or deployment was performed for this follow-up.


## Distributed Ready code and live pool reads

The follow-up now includes static inspection of a publicly distributed Ready X extension (manifest version 5.33.16), rather than assuming the public GitHub repository matches the installed privacy wallet. See [evidence and hashes](./ready-fee-trace-2026-10-30.json).

Current read-only pool views returned 2 STRK on Sepolia and 2.5 STRK on mainnet, with separate configured collectors. These values match the user's reported magnitudes; without a transaction hash they do not establish the exact screenshot transaction's complete fee composition or a USD pricing formula.

The inspected extension strictly accepts only actions and api_version for Invoke (Prepare additionally accepts simulate). Its Invoke handler fetches internal per-token paymaster quotes, its action builder appends the quoted withdrawal, and its fee UI adapter converts feeAction.amount into the displayed paymaster fee. VINSS's helper payment and treasury OpenNote remain ordinary dapp actions in that request path. No app-controlled fee metadata field was found in these handlers. Changing the VINSS helper alone does not populate this internal wallet quote.

This establishes the behavior of the inspected distributed build, not necessarily the user's exact installed version. A separate wallet-supported partner integration remains possible but unverified. The exact requested app-fee presentation still requires that integration; arbitrary fields, spoofed quote metadata, or redirecting a known relayer payment are not valid implementations.
