# Unshield Sepolia deployment

Deployed and initialized by [CI run 40171055489](https://github.com/DXJLabs/vinss/actions/runs/40171055489), from source commit `a5792cf7ed820f9163a05101428c0156df47c9ea`.

`manifest.json` records all eight contract addresses, class hashes, constructor calldata, deployment transactions, initialization transaction and indexer start block. CI verified adapter configuration, helper authorization, the public fee wrapper and unchanged Rekber economics against the existing Shield deployment. Application and Cairo CI tests passed before deployment.

`frontend.env` and `backend.env` contain public configuration only. Apply the frontend entries to a Sepolia deployment, and run a separate public backend/database using the cloned helper addresses and recorded start block. Set `NEXT_PUBLIC_UNSHIELD_BACKEND_URL` to that backend before enabling Unshield. Keep the existing Shield environment configured independently. Backend RPC, database, CORS and other service settings still require configuration.

This records successful contract deployment; frontend/backend service rollout and real-wallet full-room acceptance testing are not included in this CI run.

Deployment runs only for commits containing `[deploy-unshield-sepolia]` in the feature branch workflow, after both application and Cairo checks pass. Ordinary follow-up commits do not deploy. Deterministic deployment salts permit retries with the same deployer and constructor configuration; reused contract classes and addresses are checked before proceeding.
