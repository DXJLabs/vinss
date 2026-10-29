# Fiat app fees v2 — Sepolia

The target app fee schedule is Unshield: message $0.01, offer $0.05, room activation $0.05. Shield app fees are twice these amounts. Wallet, STRK20 protocol and network fees are separate. The existing Rekber contract, percentage, minimum, sponsor reserve and workflow fees are unchanged.

VinssAppFeePolicy prices flat actions through Pragma using ceil-rounded integer arithmetic. It does not include the old sponsor-cost floor in actions 1–3. Action 4 delegates to the original policy. VinssPublicAppFeePolicy halves only the new flat action prices and delegates Rekber to the original policy, preserving the public adapter's source-policy check. The existing fee policy classes remain available for old deployments.

The feature branch workflow deploys the frontend after application and Cairo checks pass, using VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID from GitHub Actions secrets. Missing credentials fail with names only; never put secret values in the repository or chat.

A commit containing [deploy-app-fees-sepolia] stages and verifies new fee policies, native Shield helpers and a complete independent public adapter/helper deployment. It uses the existing Sepolia signer secrets. Artifacts contain public addresses and receipt start blocks. Retries use versioned deterministic salts and verify any reused class. The original Mainnet deployment and funded Rekber custody are never replaced.

Staging new contracts does not activate prices in the frontend. Before promotion, configure backends for the new message/offer helper addresses and start blocks, retain discovery for old ciphertext, confirm no existing public custody is orphaned, then apply the verified addresses to the frontend deployment profiles. Never label old live quotes as v2 prices. Until that rollout is complete, the fee page must continue showing actual live quotes, including the old 2 STRK quote if it is still configured.
