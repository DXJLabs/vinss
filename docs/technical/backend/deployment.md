# Deployment

## Build first

```bash
cd ~/vinss/backend
npm run build
npm test
```

Do not use deployment as the first build validation.

## Railway

Current deployment flow:

```bash
cd ~/vinss/backend
railway up
```

Deploy from the backend application directory unless the Railway project root is explicitly configured otherwise.

## Post-deploy smoke checks

```bash
curl -s https://<backend-domain>/health
echo

curl -s https://<backend-domain>/agent/providers
echo

curl -s https://<backend-domain>/openapi.json | head
```

Open:

```text
https://<backend-domain>/docs
```

## Mainnet deployment sequence

Recommended sequence:

```text
1. Freeze commit SHA
2. Build and test locally/CI
3. Verify mainnet environment variables
4. Verify deployed contract addresses
5. Deploy backend
6. Check health/readiness
7. Smoke-test discovery
8. Smoke-test Agent provider list
9. Verify logs contain no request bodies
10. Enable frontend traffic
```

## Rollback

Keep the previous known-good deployment available.

If a backend release changes privacy behavior unexpectedly:

1. stop routing new traffic to the bad release;
2. roll back to the previous known-good commit/deployment;
3. preserve operational logs that do not contain secrets;
4. inspect the privacy boundary before redeploying.

## Database note

The current presence and loyalty services are in-memory.

A process redeploy resets those maps.

Do not assume Railway deployment persistence for these structures.
