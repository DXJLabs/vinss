# Testing

## Standard validation

```bash
cd ~/vinss/backend

npm run typecheck
npm run build
npm test
git diff --check
```

## Current backend tests

The test command runs:

```text
Agent/tool tests
Privacy boundary checks
Ciphertext-only discovery boundary checks
```

Important behaviors covered include:

- deterministic fee calculation;
- Offer analysis behavior;
- approval-required counter proposals;
- private message remains a draft;
- deal-stage inference;
- Agent tool allowlist excludes execution tools;
- skill-specific tool exposure;
- cross-domain tool execution is blocked;
- Agent context sanitizer strips private plaintext;
- backend discovery remains ciphertext-only.

## Release gate

For mainnet-targeted releases, do not deploy if any of these fail:

```text
TypeScript build
Unit tests
Privacy boundary tests
Ciphertext-only checks
git diff --check
```

## Additional mainnet test categories

Before mainnet, add or verify:

- mainnet configuration validation tests;
- rate-limit behavior;
- malformed request fuzz/validation tests;
- RPC outage behavior;
- large discovery result behavior;
- provider timeout/fallback behavior;
- presence restart behavior;
- loyalty replay/idempotency persistence if enabled;
- contract-address/network mismatch tests;
- smoke tests against deployed mainnet helper contracts.

## Privacy regression principle

Whenever a new backend field is added, ask:

> Does this field allow the server or a remote provider to learn more private deal metadata than before?

If yes, update the threat model and privacy tests before shipping.
