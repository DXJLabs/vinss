# Unshield Sepolia deployment

Deployed and initialized by [CI run 40171055489](https://github.com/DXJLabs/vinss/actions/runs/40171055489), from source commit `a5792cf7ed820f9163a05101428c0156df47c9ea`.

`manifest.json` records all eight contract addresses, class hashes, constructor calldata, deployment transactions, initialization transaction and indexer start block. CI verified adapter configuration, helper authorization, the public fee wrapper and unchanged Rekber economics against the existing Shield deployment. Application and Cairo CI tests passed before deployment.

`frontend.env` and `backend.env` contain public configuration only. Apply the frontend entries to a Sepolia deployment, and run a separate public backend/database using the cloned helper addresses and recorded start block. Set `NEXT_PUBLIC_UNSHIELD_BACKEND_URL` to that backend before enabling Unshield. Keep the existing Shield environment configured independently. Backend RPC, database, CORS and other service settings still require configuration.

This records successful contract deployment; frontend/backend service rollout and real-wallet full-room acceptance testing are not included in this CI run.

## Railway backend (27 October 2026)

The Unshield backend runs in the new private Railway project [vinss-starknet-sepolia](https://railway.com/project/accabdf7-6118-4740-a995-d9340afb4f28), environment `sepolia`. Its public API is `https://vinss-unshield-api-sepolia.up.railway.app`; check `/health` for the network, helper addresses and indexer checkpoints. PostgreSQL is a new persistent database connected through Railway private networking. Existing Mainnet backups and the Canton project are independent of this deployment.

Service `vinss-unshield-api` builds `/backend` with Node 24, `npm run build`, `npm start`, and `/health` as its health check. The deployed source is pinned to commit `d235e1f2bf8069904c8450e969b489ba7e8728d2`; pushes do not automatically change that pinned backend. Express/body-parser/proxy-addr/qs were patched within their existing version ranges. The 46 backend tests, typecheck, build, privacy boundaries and runtime dependency audit passed before the updated deployment.

The backend uses `https://starknet-sepolia-rpc.publicnode.com`. Before rollout, live reads verified Sepolia chain ID, all eight deployed class hashes, all eight adapter configuration values, and a discovery event scan using the backend SDK. Indexing starts at the recorded deployment block. The public endpoint must report `network: sepolia`, the public helper addresses from this manifest, and healthy indexers.

`frontend.env` now supplies the verified API URL, RPC, network and token addresses along with public contract addresses. Merge these values into the frontend configuration, retaining separately verified Shield settings. Updating a local env file does not update Vercel's configured build variables: apply the values in the frontend hosting environment before rebuilding it. The existing Shield backend and its addresses are not supplied by this Unshield deployment.

The API's CORS origin is `https://vinss-nu.vercel.app`. AI agent routes and automatic dispute execution are disabled until their provider/resolver credentials are configured on this new service. No Mainnet credentials were copied. Real-wallet invite/message/offer/custody acceptance testing remains separate from this infrastructure deployment.

Deployment runs only for commits containing `[deploy-unshield-sepolia]` in the feature branch workflow, after both application and Cairo checks pass. Ordinary follow-up commits do not deploy. Deterministic deployment salts permit retries with the same deployer and constructor configuration; reused contract classes and addresses are checked before proceeding.
