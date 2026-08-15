# STRK20 Privacy Integration Plan — VINSS

Generated 2026-08-14 by the strk20-privacy-integration skill.

## 1. Project snapshot

- Stack: Next.js 16.3.1, React 19.2.8, TypeScript 5.5, starknet 10.7.0.
- Wallet packages: @starknet-io/get-starknet-discovery 6.0.4,
  @starknet-io/get-starknet-wallet-standard 6.0.4,
  @starknet-io/types-js 0.10.3.
- Cairo contracts already exist under `contracts/`, including messaging,
  offers, private escrow, and private escrow settlement.
- Wallet connection:
  `frontend/lib/starknet/walletClient.ts`
- Transaction/SDK integration:
  `frontend/lib/vinss-sdk/`
- Messaging:
  `frontend/lib/vinss-sdk/messaging.ts`
  `frontend/lib/vinss-sdk/envelope.ts`
  `frontend/lib/vinss-sdk/channelKey.ts`
- Existing UI entry points:
  `frontend/app/page.tsx`
  `frontend/app/wallet/page.tsx`
  `frontend/app/room/[roomId]/page.tsx`
- Current typecheck blockers:
  `frontend/lib/starknet/walletClient.ts`
  `frontend/lib/vinss-sdk/envelope.ts`
- Privacy goal:
  encrypted on-chain messaging over the existing STRK20 privacy pool,
  anonymous sender/recipient relationships, persistent encrypted channels,
  payment memos, private escrow negotiation, plus VINSS agentic application
  layer across messaging, escrow, deal-room workflows, automation, and future
  product capabilities.
- Environment: testnet-first for implementation and wallet verification.

## 2. Chosen route: Existing STRK20 messaging contracts + Wallet API + backend discovery + VINSS agentic application layer

VINSS already has the existing VINSS Cairo contracts required for its private messaging
and escrow flows, so this plan does NOT create or redesign those contracts.
The integration work is application-side: make the existing contracts usable
through the STRK20 wallet flow, finish encrypted-message discovery/indexing,
build the frontend UX, and expose safe capabilities to the VINSS agentic application layer across messaging, escrow,
deal-room workflows, automation, and future product capabilities.

The dapp never touches a user's viewing key, notes, proofs, or private keys.
User-side privacy actions are delegated to the privacy-enabled wallet through
starknet.js / WalletAccount.

## 3. What this delivers — hidden vs visible

| Private | Public |
|---|---|
| Sender identity for private messaging | Pool transaction exists |
| Recipient identity | Timing of the pool interaction |
| Message plaintext | Block/transaction metadata |
| Encrypted message payload | Public contract interaction exists |
| Channel-key-derived ciphertext | Any deliberately public application metadata |
| Private transfer relationship | Public ERC-20 legs for shield/unshield |
| Escrow negotiation contents | Public timing/fact of on-chain settlement |

VINSS must not describe this as "no metadata" in an absolute sense:
on-chain activity and timing remain observable. Privacy comes from keeping
identities and message contents out of the public transaction state.

## 4. Prerequisites & versions

- `starknet@10.7.0` — already satisfies the STRK20 WalletAccount requirement.
- `@starknet-io/get-starknet-discovery@6.0.4`
- `@starknet-io/get-starknet-wallet-standard@6.0.4`
- `@starknet-io/types-js@0.10.3`
- STRK20 Wallet API stable spec: v0.10.3.
- Test wallet: Ready extension.
- AVNU private swap SDK: 4.2.0 if private swap functionality is later added.

Freshness drift recorded:
- get-starknet packages moved from 6.0.3 to 6.0.4.
- `packages/sub_account_anonymizer` is no longer present in the privacy
  monorepo.
- `packages/shadow_account_anonymizer` is now present and must be inspected
  before planning sub-account functionality.

## 1. Phase 1 — unblock and establish the wallet/privacy foundation

1. Resolve the current `@starknet-io/get-starknet` import mismatch in
   `frontend/lib/starknet/walletClient.ts` using the current WalletAccount
   + get-starknet v6 integration.
2. Resolve the TypeScript `BufferSource` incompatibility in
   `frontend/lib/vinss-sdk/envelope.ts` without weakening encryption
   correctness.
3. Run `npm run typecheck`, then build.
4. Confirm wallet capability through the Wallet API capability mechanism;
   do not use shielded-balance reads merely for feature detection.
5. Add graceful degradation for wallets without STRK20 privacy support.
6. Verify connection and the first privacy-enabled action against Ready and
   the wallet test dapp.

Reference:
https://strk20-by-example.org/starknet-wallet-api/starknet-js

## 6. Phase 2 — VINSS private messaging UX

Implement the existing messaging primitives through the frontend:

- Persistent private channel creation/opening.
- Recipient selection without exposing the recipient relationship on-chain.
- Encrypted message compose/send.
- Local decryption only.
- Message history backed by discovery/indexing.
- Delivery/status UX that does not falsely claim on-chain delivery semantics.
- Payment memo flow: private payment plus encrypted message where supported
  by the existing contract architecture.
- Escrow negotiation UI inside the private channel.
- Clear distinction between encrypted/private content and public on-chain
  activity.

Relevant modules:
- `frontend/lib/vinss-sdk/messaging.ts`
- `frontend/lib/vinss-sdk/envelope.ts`
- `frontend/lib/vinss-sdk/channelKey.ts`
- `frontend/app/room/[roomId]/page.tsx`

Channel/message concepts:
https://strk20-by-example.org/channels-and-subchannels

## 7. Phase 3 — Backend/indexer/discovery

Build the discovery layer required to locate encrypted channel/message
payloads without turning the backend into a trusted plaintext server.

Requirements:

- Index only the public event/contract data required for discovery.
- Return encrypted payloads and metadata needed for local decryption.
- Never persist user viewing keys or private keys.
- Never decrypt user messages server-side.
- Define deterministic channel/message ordering.
- Handle reorg/retry/idempotency.
- Expose a narrow API used by the frontend SDK.
- Add tests for duplicate events, missed blocks, replay, and pagination.

The backend is a discovery transport, not a trusted messaging authority.

## 8. Phase 4 — VINSS agentic application layer

Add agentic capabilities only through explicit, least-privilege application
actions across messaging, escrow, deal-room workflows, automation, and future product capabilities.

VINSS should be able to:

- understand private conversation context available to the user;
- draft messages and payment memos;
- prepare escrow negotiation actions;
- summarize private conversations locally/with user-authorized context;
- prepare transactions for explicit user approval;
- track application state without accessing viewing keys or raw wallet secrets.

VINSS must NOT:

- receive or persist viewing keys/private keys;
- silently execute irreversible transfers;
- infer private balances by probing wallet APIs;
- expose private conversation content to an unauthorized backend;
- treat the relayer/transaction sender as the user.

Every financial action should have an explicit authorization boundary.

## 9. Future considerations

Revenue/monetization is not a current integration scope. If it arises later
as a product/business capability, it must sit above the privacy protocol
rather than monetize private content. Any revenue mechanism must not require
VINSS to inspect private message contents, viewing keys, or private balances.
Revenue experiments, if ever pursued, should be feature-gated and measurable
using public application events/aggregates only.

## 10. Testing

Testnet-first.

- `npm run typecheck`
- `npm run build`
- Existing Playwright E2E suite.
- Wallet connection tests.
- Encrypted message round-trip:
  sender encrypts → chain stores ciphertext → discovery returns it →
  recipient decrypts locally.
- Wrong recipient/key cannot decrypt.
- Duplicate/replayed discovery events are idempotent.
- Escrow negotiation does not leak plaintext.
- Payment memo content remains encrypted.
- Wallet without STRK20 capability degrades gracefully.
- Verify with Ready extension and wallet test dapp.

For private activity analytics, never identify users by transaction sender;
private pool activity must be attributed from the protocol's documented
events where applicable.

## 11. Compliance & security notes

- Deposit screening is enforced onchain by the STRK20 protocol.
- Selective disclosure can support legitimate regulatory requests; this is
  not automatic compliance or regulatory endorsement.
- VINSS owns application-level legal/compliance decisions.
- No viewing keys, private keys, proofs, or plaintext private messages belong
  in logs, telemetry, analytics, or server persistence.
- The existing Cairo contracts are treated as complete; this plan does not
  modify them.

## 12. Open items to re-verify at build time

- Current WalletAccount/get-starknet API details.
- Ready extension behavior and supported Wallet API capabilities.
- Wallet API v0.10.3 vs newer release candidate.
- Current starknet.js dist-tags.
- Current privacy monorepo capabilities.
- `shadow_account_anonymizer` capabilities before any sub-account work.
- Fee/paymaster UX.
- Backend indexing/event schema against the deployed VINSS contracts.
- Exact revenue mechanism after product validation.

## 13. Links

- STRK20 overview:
  https://strk20-by-example.org/what-is-strk20
- Channels/subchannels:
  https://strk20-by-example.org/channels-and-subchannels
- Viewing keys:
  https://strk20-by-example.org/viewing-keys
- Wallet API overview:
  https://strk20-by-example.org/starknet-wallet-api/overview
- starknet.js WalletAccount:
  https://strk20-by-example.org/starknet-wallet-api/starknet-js
- Private DeFi:
  https://strk20-by-example.org/starknet-wallet-api/private-defi
- Official Privacy SDK:
  https://github.com/starkware-libs/starknet-privacy
- Wallet test dapp:
  https://starknet-wallet-account.vercel.app/
