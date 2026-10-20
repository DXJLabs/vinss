# Starknet OpenMLS integration — isolated development branch

Origin: `ntfound-dev/Vinss-canton` OpenMLS Rust/WASM and browser bridge (MIT).
This branch imports the **cryptographic engine**, not the Canton ledger transport.

## Current boundary

- The original Starknet UI and message flow remain unchanged on `main`.
- The import provides the OpenMLS group engine, KeyPackage/Welcome/Commit support,
  epoch handling, and encrypted IndexedDB state snapshots.
- `createStarknetOpenMlsSession` creates a **local cryptographic session only**.
  It is NOT yet an authenticated end-to-end Starknet messaging flow.
- The existing Starknet ECDH P-256 / AES-GCM envelopes still decrypt historical
  messages. Do not replace or silently reinterpret them.
- Rust WASM is built reproducibly from `wasm/vinss_mls`; no dependency on a live
  Canton validator, Canton SDK, or Daml.
- Never market this isolated port as production OpenMLS integration.

## Production tasks before enabling MLS in the UI

1. **Identity authentication:** generate per-device MLS installation credentials
   and bind the KeyPackage to the Starknet wallet with a verified fresh signature,
   chain ID, room ID, expiry, and anti-replay mechanism. Never trust an unverified
   claimed wallet address from client metadata.
2. **Starknet delivery:** deliver KeyPackages, Welcome and Commit reliably using
   authenticated discovery/relay backed by existing Starknet infrastructure.
   Define maximum payload size; the existing Cairo MessageHelper caps ciphertext
   chunks at 64 × 30 bytes. Do not truncate or silently split an MLS handshake.
3. **State consistency:** durably persist each MLS epoch and membership commit
   before marking outgoing messages sent. Implement ordering, retry, restart,
   deduplication, pending-commit recovery, and out-of-sync recovery.
4. **Migration:** default existing rooms to the proven legacy crypto. A new
   MLS-enabled room negotiates explicit `mls-v1` capability. Preserve legacy
   envelopes and read paths; never reinterpret old messages as MLS ciphertext.
5. **Membership:** implement true MLS add/remove, Welcome processing, and group
   epoch updates. Adding someone must not grant access to previous messages.
   Removing someone must rotate epoch keys before new messages go out.
6. **Tests:** actual Alice/Bob onboarding and message exchange, 3-person group,
   removal, stale/out-of-order messages, different wallets/chains, offline
   reconnect, corrupted ciphertext, expired/forged KeyPackages, reload.
7. **UI:** reuse Starknet layout/styles/components exactly. No redesign.

## Building WASM

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked --version 0.14.0
wasm-pack build wasm/vinss_mls --release --target web \
  --out-dir ../../frontend/lib/openmls
```

GitHub Actions builds the browser package and publishes generated output on
this feature branch after Rust compilation succeeds. Keep the generated
`vinss_mls.js`, `vinss_mls.d.ts`, and `vinss_mls_bg.wasm` together.

No production switch is enabled by this phase.


## Decision (20 Oct 2026): MLS ciphertext is on-chain

All MLS application ciphertext AND encrypted transport envelopes carrying
KeyPackage, Welcome and Commit are submitted as Cairo MessageHelper events /
contract data on **Starknet**, through the existing \`sendMessage\`
STRK20 path. This design has **no off-chain ciphertext mailbox**.
The existing indexer may relay ciphertext bytes for discovery, but it is
not a canonical message store and must not receive plaintext or MLS secrets.

Added files:
- \`frontend/lib/openmls-core/starknet-framing.ts\` — binary-safe fragment codec.
- \`frontend/lib/openmls-core/starknet-onchain-transport.ts\` — wallet-signing
  adapter through the existing Starknet encrypted message helper.
- \`tests/openmls-starknet-framing.test.mjs\` — byte preservation, disorder,
  duplicates, missing parts, corruption, and network isolation.

### Framing protocol

An outgoing MLS packet (KeyPackage, Welcome, Commit, or application
ciphertext) is split into 384-byte slices. Each slice has a private
logical packet ID, complete-packet SHA-256, total length and index.
These fields are inside the **existing client-side AES-GCM envelope**.
On-chain observers see encrypted calldata and the existing
MessageHelper routing tags/fee/metadata, **not the plaintext frame JSON**.

The receiver must see every fragment and verify the full SHA-256 before
the transport considers the packet complete. Incomplete packets are
reported separately; corrupted or conflicting packets are rejected.
Each fragment is a separate wallet transaction. An explicit confirmation
callback is mandatory when more than one transaction is needed.

Hard limits at this stage:
- Up to 16 KiB per MLS packet and 384 raw bytes per fragment (up to 43 tx).
- No automatic off-chain fallback.
- No automatic retry of an incomplete multi-transaction packet, since
  each retry would incur more privacy-pool and Starknet fees.
- No claims of atomic delivery for multi-transaction MLS packets.
- On-chain transaction acceptance does not by itself prove delivery,
  ordered processing, or peer decryption.

The new feature branch also prevents the older 30-byte-felt encoding
from silently losing a leading zero byte: outbound AES-GCM encryption
resamples the random IV if any 30-byte segment would be lossy. Its
historical ciphertext format is unchanged.

### Not production-ready

The on-chain adapter is **not yet wired** to the React conversation hooks.
A production integration still requires:
1. Wallet-signed fresh KeyPackage registration and **independent verification**
   that the signing wallet is authorized for the claimed MLS installation.
   The inherited P-256 transport key/HMAC routing tag is not a Starknet
   signature. Do not treat a claimed \`senderIdentity\` as authority.
2. Persisted fragment outbox with transaction receipts, retries and
   deduplication. Resume without creating a fresh MLS commit or losing
   an epoch after partial submissions. Never mark the MLS state as
   delivered until receipts and relevant ordering checks succeed.
3. Integration with the \`BrowserOpenMlsBridge\` / \`OpenMlsMessagingProvider\`,
   KeyPackage discovery, Welcome/Commit synchronization, direct and
   group membership changes, and the existing room hooks.
4. Browser validation with two distinct Starknet accounts and a
   three-member group; rotate MLS epochs after removal. Confirm
   local and on-chain state after refresh and offline recovery.
5. Verification of fragment cost, maximum calldata/pool limits,
   backend indexing completeness, account permissions, and real Sepolia
   transaction hashes before considering a Mainnet deployment.

Legacy messages are still handled by ECDH/AES-GCM. New MLS packets must
be indicated by their explicit \`vinss:mls:v1:\` prefix *inside* the
encrypted payload, not inferred from old ciphertext. The current port
is an **isolated engineering branch**, not a production chat upgrade.
