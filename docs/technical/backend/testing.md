# Backend Testing

## Objective

Backend tests should verify both normal behavior and privacy boundaries.

A successful TypeScript build does not prove the server remains privacy-safe.

## Standard validation

```bash
cd ~/vinss/backend

npm run typecheck
npm run build
npm test

cd ~/vinss
git diff --check
```

## Current `npm test`

Current script runs:

```text
backend/tests/agent-tools.test.ts
+
scripts/test-privacy-boundaries.mjs
```

## Agent/tool coverage

Current tests verify, among other things:

- deterministic fee calculation;
- Offer analysis behavior;
- approval-required proposals;
- private Message remains a draft;
- skill-specific tool exposure;
- no transaction-execution tools;
- cross-skill tool execution is rejected;
- Agent context sanitizer strips private plaintext.

Example security assertion:

```ts
assert.throws(
  () =>
    executeSkillTool(
      getAgentSkill("offer"),
      "prepare_escrow",
      {},
      {},
      25,
    ),
  /Tool not allowed for offer skill/,
);
```

## Ciphertext-only regression coverage

The privacy script verifies:

```text
backend discovery has no decrypt path
backend rejects channelKeyHex
DiscoverRequest has no channelKeyHex
indexer contains no decryption code
frontend Message/Offer discovery sends no channel key
frontend performs local decryption
```

## Verification levels

Use distinct labels:

```text
Implemented
Tested
Testnet On-chain Verified
Mainnet Verified
```

Backend unit/privacy tests are not a substitute for deployed network evidence.

## Mainnet-targeted additions

Before serious public mainnet operation, add/verify:

- mainnet configuration validation;
- rate-limit behavior;
- malformed input/fuzz cases;
- RPC outage/failover behavior;
- large discovery responses;
- provider timeout/fallback behavior;
- multi-instance presence behavior if used;
- loyalty auth/durability tests if enabled;
- network/contract mismatch protection;
- deployed helper smoke tests.
