# VINSS Multichain Messaging — Production Transport Boundary

> Status: **Starknet Shield and Unshield active; Canton/EVM not connected.** Source review 31 October 2026, branch `feat/strk20-unshield-fees`. No Mainnet deployment, Canton Daml messaging deployment, EVM contract deployment or cross-chain relay is claimed.

## Design constraint: chain-agnostic confidentiality, chain-native delivery

VINSS is multichain by product design; messages must remain a chain-neutral application concept even when **one particular blockchain** publishes the encrypted payload. Separating plaintext confidentiality from transaction execution avoids treating STRK20 as a universal cross-chain message protocol.

| Concern | Shared client/application responsibility | Chain-specific implementation |
|---|---|---|
| Conversation | Private peer/group membership and authenticated identity associations | Binding to Starknet address, Canton Party or EVM account |
| Encryption | P-256 ECDH/HKDF for current direct chat, group secret, AES-GCM JSON payload | Serialize encrypted bytes to native ledger representation |
| Message routing | Ephemeral tags, logical message/recovery IDs | Chain-qualified immutable receipt, checkpoint and finality |
| Sender authority | User-approved action with correct wallet context | Shield native invoke and Unshield public account execution today; Canton/EVM must implement own signatures |
| Fees | Principal versus app revenue versus wallet/network cost remain distinct | Per-chain quote and fee token |
| Discovery | Encrypted candidate retrieval without giving server plaintext keys | Starknet event+getter indexer today; Canton/EVM native indexer in future |
| Replay & reliability | Unique encrypted message, dedupe, pending-wallet ambiguity | Network-specific nonce/locator, confirmed receipt, fork/finality rules |

## Implemented now

- `frontend/lib/deal-room/messageTransport.ts` implements a typed registry and explicit, fail-closed dispatch.
- Transport IDs are `family:network:rail`. Valid example `starknet:sepolia:strk20`; reserved future examples `canton:devnet:daml` and `evm:11155111:contract`.
- `frontend/lib/deal-room/messageGateway.ts` registers both Starknet rail IDs, `starknet:<network>:strk20` and `starknet:<network>:public`, backed by the actual domain functions `sendMessage` and `discoverMessages` from `frontend/lib/deal-room/messaging.ts`. It exposes the same interface used by the active direct and group hooks.
- `frontend/hooks/room/useDirectConversation.ts` and `useGroupConversation.ts` now use the gateway, preserving the deployed native action and backend read flow.
- `NEXT_PUBLIC_MESSAGE_TRANSPORT_ID` may select an **already registered** transport; selecting any unsupported ID rejects with an error. It never silently posts Canton or EVM messages to the Starknet helper.
- This milestone does **not** expose a misleading multichain selector in the UI.

## Ciphertext codec and historical recovery

`frontend/lib/privacy/feltCodec.ts` is a **Starknet-specific byte serialization adapter**, not the encryption primitive and not a protocol fee mechanism.

New payload: `[MAGIC, byteLength, sentinel-packed bytes...]`. Each packed data block contains one sentinel byte followed by up to 30 encrypted bytes (<=248 bits, valid Starknet felt), preserving leading zeros. The existing outer Cairo Message V2 envelope and Poseidon commitment formula are unchanged. With the 64-ciphertext-felt contract cap, up to **62 encrypted-data blocks** fit.

For prior records lacking the inner marker, the legacy decoder reconstructs zero-padded full chunks and tries at most 30 possible final lengths. **AES-GCM authentication alone** decides whether a byte candidate is valid; no unverified candidate is returned as plaintext. Historical on-chain records do not need to be rewritten. The same `encryptPayload`/`decryptPayload` functions are shared by Message/Offer/Private Escrow modules, so all must receive compatibility fixtures before production deployment.

On a non-Starknet ledger, use **the same encrypted byte payload model** with a suitable chain-native encoding; do not force Starknet felt packing on Canton/EVM.

## Required for actual cross-chain chat

1. **Chain-neutral messaging identity.** Current P-256 keys are scoped to a room and Starknet wallet address. Before real multichain, add verifiable signed association of the messaging public key with a Canton Party or EVM wallet; do not presume accounts are identical across chains.
2. **Canton-native and/or EVM-native adapter.** Wallet/Party consent, encrypted immutable storage, fee policy and finality must be implemented and independently tested.
3. **Cross-chain metadata privacy.** Avoid public reusable conversation identifiers and direct cleartext recipient links; ephemeral routing IDs and metadata leak analysis are required on each ledger.
4. **Explicit cross-chain delivery policy.** Merely registering multiple adapters does *not* transmit messages between chains. Opt-in relay/bridge semantics and independently provable source and destination receipts are needed.
5. **Dedupe / replay handling.** A private logical message identifier with chain-qualified delivery receipts prevents duplicated bubbles, replay and accidental multiple charge.
6. **Consistency.** A message displayed as confirmed must be readable via local decrypt and backed by a native accepted receipt, even when a wallet callback is ambiguous.
7. **Recovery and rotation.** Support key backup, group membership changes and legacy format migration; don't claim OpenMLS epoch-based forward secrecy until OpenMLS is truly integrated.
8. **Release evidence.** CI is source testing; before launch, run browser Alice/Bob E2E, active wallet transaction, actual indexed ciphertext/decrypt and fee/finality proofs **on each supported chain**.

## Security/release caveats

- Current key material, device-local room/group secrets and participant metadata have distinct privacy boundaries; the backend normal `/discover` endpoint remains ciphertext-only.
- Wallet exceptions in Message send now produce sanitized static categories instead of raw ciphertext-bearing payload logs. Review other logging and telemetry.
- New codec unit tests do not prove old real-chain records migrate; the real Sepolia acceptance test and historical fixtures remain release gates.
- OpenMLS remains on separate `feat/openmls-starknet`, to be integrated only with explicit protocol migration.
- Rekber 2% minimum/reserve, STRK20 fees and production Mainnet are not modified.

See [Message cross-layer audit](./messaging-implementation-audit.md), [Direct Chat](./direct-chat.md), [Privacy Model](./privacy-model.md), [Wallet STRK20](./wallet-strk20.md).
