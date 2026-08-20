# Testing & Deployment

## Objective

Frontend verification should prove both software correctness and privacy/execution behavior.

A successful build alone is not equivalent to an on-chain verification.

## Static/build checks

```bash
cd ~/vinss/frontend
npm run typecheck
npm run build
```

Package scripts currently use Next.js with webpack explicitly.

## E2E commands

```bash
npm run test:e2e
npm run test:e2e:video
```

Wallet/browser automation availability depends on the execution environment.

## Manual technical verification

For two-user private Chat:

```text
wallet A + wallet B
→ same Deal Room
→ participant identity discovery
→ pairwise key derivation
→ A sends Message
→ B discovers ciphertext
→ B decrypts locally
→ reload / remount
→ history recovers
→ backend never receives key
```

For private Offer:

```text
create
→ peer decrypts
→ counter / accept / reject
→ immutable locator relationship remains correct
→ delayed callback can reconcile through discovery
```

For Escrow Rekber:

```text
accepted Offer
→ prepare/link escrow
→ funding
→ custody
→ release OR refund
→ expected recipient outcome
```

Escrow Rekber must remain labeled pending until this is proven end-to-end on-chain.

## Release checks

```bash
cd ~/vinss/frontend
npm run typecheck
npm run build

cd ~/vinss
git diff --check
```

## Evidence rule

Use distinct labels:

```text
Implemented
Tested
Testnet On-chain Verified
Mainnet Verified
```

Do not collapse them into one generic "working" status.
