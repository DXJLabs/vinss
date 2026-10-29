# Shield Sepolia recovery — 29 October 2026

The live frontend at vinss-nu.vercel.app selected Sepolia but embedded the Mainnet pool and helper addresses from the README's Mainnet table. Sepolia RPC returned contract-not-found for those addresses. Its Shield backend URL, vinss-production.up.railway.app, returned HTTP 404 at /health.

This profile restores the existing Sepolia STRK20 deployment. Provenance and receipt blocks are in manifest.json, recovered from the verified September profile on commit f4a2562. Live RPC reads on 29 October confirmed the Message, Invite, Offer and Rekber helpers use pool 0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91. No contract redeployment or Mainnet change is required.

The replacement Railway service vinss-shield-api runs the backend at pinned commit d235e1f2bf8069904c8450e969b489ba7e8728d2, in project vinss-starknet-sepolia / environment sepolia. Its domain is https://vinss-shield-api-sepolia.up.railway.app. Indexing begins at each contract's deployment block. The database uses the existing Sepolia PostgreSQL service; records and checkpoints are separated by network, contract address and event kind. Agent routes and automatic dispute resolution remain disabled.

Deploy the frontend from the repository root:

```sh
node scripts/deploy-sepolia.mjs
```

Requires the user's authenticated Vercel CLI and existing frontend project link. The script passes all public Shield and Unshield configuration as build and runtime overrides, preventing stale Vercel variables from selecting Mainnet contracts on Sepolia. Do not overwrite Mainnet deployments with this profile. This session has no Vercel login, so the existing frontend URL still needs that deployment.

Mode selection now applies to the next transaction in the same room, including rooms with historical transactions. Obsolete room locks are migration hints only. Existing escrow authorization checks continue to reject an action submitted on a different rail from its agreement; select the agreement's mode to continue its lifecycle. Discovery currently follows the selected rail, while encrypted local history stays in the room.

This recovery does not change deployed fee policies. The public policy still derives half the Shield quote, including the sponsor floor; reducing that requires a separate contract pricing change. Wallet approval is distinct from gas, and the exact final debit must be verified from the transaction receipt. Real-wallet Shield acceptance remains to be checked after the corrected frontend rollout.
