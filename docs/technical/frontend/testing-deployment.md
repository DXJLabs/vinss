# Testing & Deployment

## Validation

```bash
cd ~/vinss/frontend
npm run typecheck
npm run build
```

Package scripts use Next.js with webpack explicitly.

## E2E commands

```bash
npm run test:e2e
npm run test:e2e:video
```

Wallet/browser E2E availability depends on the execution environment.

## Manual two-user verification

For the current MVP:

```text
connect wallet A
connect wallet B
join same private room
discover peer identity
send A → B private message
send B → A private message
reload and recover private history
create private Offer
receive/decrypt Offer on peer
perform Offer lifecycle action
verify backend discovery remains ciphertext-only
```

## Release checks

```bash
npm run typecheck
npm run build
cd ~/vinss
git diff --check
```

Frontend network/backend/contract configuration must refer to the same deployment environment.
