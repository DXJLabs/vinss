# Verified Sepolia app fee contracts v2

Deployed and verified by [CI run 40823019439](https://github.com/DXJLabs/vinss/actions/runs/40823019439), commit 4abae032c559a4231806cca171d6981f5fa78706. Application checks and the full Cairo contract suite passed. No Vercel deployment job is present.

| App action | Unshield | Shield |
| --- | --- | --- |
| Message | $0.01 | $0.02 |
| Offer | $0.05 | $0.10 |
| Room activation | $0.05 | $0.10 |

Policies convert USD prices to STRK through Pragma. Flat prices do not include the old sponsor minimum. Wallet/protocol/network charges are separate. Rekber economics are unchanged; the native Rekber deployment is retained and the new public Rekber uses the original revenue policy and parameters.

`shield-manifest.json` records the two application policies and three native helpers, with receipt start blocks from their original successful deployment. `public-manifest.json` records all eight public contracts, their deployment transaction hashes, classes and constructor calldata. The public wrapper used by the adapter is the one in public-manifest.json, not the standalone policy recorded in shield-manifest.json.

`shield-frontend.env` contains only the native helper changes. `public-frontend.env` contains public deployment addresses. These are configuration artifacts, not a record of frontend publication. Backend discovery must index the new helpers at the recorded blocks and retain access to old ciphertext before frontend activation. Do not point the new helpers at a backend still indexing only v1. Existing public custody remains at its original adapter/contract; preserve those agreements and their discovery. Mainnet settings are independent.

## Backend activation

`shield-backend-rollout.env` and `public-backend-rollout.env` update the existing Sepolia services. Additional ciphertext helper definitions preserve old Shield/public history and discover both modes within the same room; no room key or plaintext is sent to discovery. Primary checkpoints retain their kind labels and additional checkpoints expose their full identities in health responses. Native Rekber/certificate addresses remain unchanged.

`frontend.env` is the combined v2 public configuration. The manual `node scripts/deploy-sepolia.mjs` command reads this profile when the user chooses to publish to Vercel. CI does not publish the frontend.
