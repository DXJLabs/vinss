# Backend Deployment

## Objective

Deployment must preserve the privacy boundary and environment consistency, not merely start the process successfully.

## Build gate

```bash
cd ~/vinss/backend

npm run typecheck
npm run build
npm test
```

Do not use production deployment as the first build test.

## Current Railway flow

```bash
cd ~/vinss/backend
railway up
```

## Post-deploy smoke checks

```bash
curl -s https://<backend-domain>/health
echo

curl -s https://<backend-domain>/agent/providers
echo

curl -s https://<backend-domain>/openapi.json | head
```

Also inspect:

```text
https://<backend-domain>/docs
```

## Environment consistency gate

Before enabling frontend traffic, confirm:

```text
network
RPC
Message Helper
Offer Helper
Private Escrow Helper
Escrow Rekber reference
production CORS
```

all belong to the intended deployment environment.

## Privacy deployment checks

Confirm that:

- request bodies are not logged;
- channel keys are rejected by discovery;
- provider credentials remain server-side;
- no raw provider prompt/error content appears in logs;
- production CORS is explicit.

## In-memory service warning

Redeploy/restart resets:

```text
encrypted presence map
loyalty account/event maps
```

Presence is ephemeral by design.

Loyalty must not be treated as durable valuable state in its current form.

## Rollback

If a release changes privacy behavior unexpectedly:

1. stop routing traffic to the affected release;
2. restore the previous known-good deployment;
3. preserve only safe operational evidence;
4. identify the boundary violation;
5. patch + add regression coverage;
6. redeploy only after privacy tests pass.
