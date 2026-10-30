# Wallet integration diagnostics

Open `/debug/wallet`, connect the wallet, and select **Inspect wallet support**. Download the JSON report to compare wallet releases or share its advertised API versions and feature names.

The diagnostic only invokes the SDK's `supportedWalletApi` and `supportedSpecs` queries. Each query times out after 15 seconds; an unavailable response is inconclusive, not proof that all privacy methods are unsupported. Standard feature metadata is listed without invoking feature methods. Only explicit inspection triggers the queries.

Reports exclude account addresses, balances, viewing keys, signatures, and transaction payloads. They remain in page memory until downloaded. Changing the wallet session hides the previous report.

A feature/version report cannot prove support for a custom application fee or enumerate undocumented request methods. Confirm fee semantics against an official wallet integration and a real approval screen before changing VINSS fee collection.

Validation: frontend build TypeScript check passed. Live Ready testing must be performed by a user with the extension/mobile wallet; it was not performed in the development environment. No contract or frontend deployment accompanies this diagnostic.
