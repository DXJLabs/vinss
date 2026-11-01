# Invite creation fees v3

Requested 1 November 2026: Unshield $0.01 and Shield $0.02 per new link, including Regenerate. Acceptance does not charge the VINSS creation fee. Wallet/protocol/network costs remain separate and cannot be set through this app's price policy.

`VinssAppFeePolicy` now prices action 1 at 20,000 USD micros. The public wrapper halves that amount with ceiling division. Message/Offer prices and all legacy Rekber economics remain unchanged. Existing policy contracts are immutable; source changes require a new deployment before they affect quotes or payments.

## Isolated activation

The existing deployment script stages a versioned contract suite using the established, tested helper and adapter classes. Only its Invite contracts are selected for application activation:

- `NEXT_PUBLIC_SHIELD_INVITE_OVERRIDE_ADDRESS` selects the new native Invite helper. `NEXT_PUBLIC_INVITE_ADDRESS` retains the prior helper for old links and existing general-rail configuration.
- `NEXT_PUBLIC_PUBLIC_INVITE_PROFILE` pins the new public adapter and its full verified configuration. The frontend uses that adapter only for Invite creation/acceptance. Message, Offer, discovery, and funded Rekber continue to use their original configured v2 contracts.
- New public links bind the chosen adapter into their encrypted payload and capability commitment. Old links are accepted only for the retained configured original adapter. Consumer proofs bind the same adapter, chain, commitment and wallet.
- Native link reads search the configured new and original helpers; consumption targets the helper that actually contains the commitment. Unknown public deployments are rejected before signing or approving.

The UI reads actual USD and STRK amounts from the selected Invite policy and refreshes when the account/mode changes. Source targets on `/fees` remain separate from active on-chain quotes. Backend indexer migration is unnecessary for this Invite-only activation; no new Message/Offer helper is activated.

## Validation and rollout

`frontend/tests/invite-fee-routing.test.ts` exercises real invitation encryption and Starknet capability signing with simulated wallet/RPC boundaries: lower fees in both modes, legacy link decoding and consumption, exact adapter approvals, invalid configuration rejection, and unchanged active custody pointers. Cairo policy tests assert both USD and STRK quotes and preserve Rekber delegation.

The deployment workflow requires application and contract checks before staging Sepolia. Deployment artifacts must be verified and recorded in `deployments/sepolia/invite-fees-v3/` before switching `scripts/deploy-sepolia.mjs` to that profile. Keep v2 base variables intact; add only the two Invite overrides. Vercel publication and a real two-wallet transaction remain separate acceptance steps.
