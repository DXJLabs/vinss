# VINSS Backend Repair

## Privacy boundary repaired

- Removed `backend/src/indexer/decrypt.ts`.
- `POST /discover` no longer accepts a channel key.
- Discovery returns ciphertext chunks and public blockchain metadata only.
- Client-side discovery now decrypts locally with the locally-held channel key.
- No channel key is sent in message/offer discovery requests.
- Privacy boundary checks were extended to cover the new discovery path.

## Deliberately not changed

- Privacy Pool contract.
- Message Helper contract.
- Public channel identifiers.
- Encryption envelope format.

## Validation

`node scripts/test-privacy-boundaries.mjs` validates the source-level privacy
boundary.

A full TypeScript build could not be completed in this clean extracted archive
because dependencies are not installed (`express`, `cors`, `starknet`,
`groq-sdk`, and Node type definitions are absent). This is an environment
limitation, not a reported application build result.
