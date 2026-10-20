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
