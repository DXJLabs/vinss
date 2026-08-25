# VINSS Frontend Technical Documentation

The VINSS frontend is the **privacy-sensitive client layer** of the Deal Room.

It owns local cryptography, private deal state, participant key material, wallet interaction, STRK20 submission, local decryption, and recovery behavior.

The backend is intentionally **not** the plaintext trust authority.

---

## Core frontend capabilities

| Capability | Technical role | Status |
|---|---|---|
| **Invite** | Encrypted Deal Room bootstrap with on-chain commitment, expiry, and one-time consumption | Implemented |
| **Private Chat** | Pairwise encrypted Message flow with opaque routing and STRK20 submission | Current fee build redeploy pending |
| **Structured Offer** | Immutable encrypted Offer lifecycle with parent/root relationships | Current fee build redeploy pending |
| **Escrow Rekber** | Encrypted coordination + commitment-based custody/release/refund path | 🟡 E2E on-chain verification pending |
| **Wallet & STRK20** | Wallet capability detection, user authorization, `strk20InvokeTransaction()` execution | Implemented |
| **Participant / Key Management** | Per-room ECDH identity, pairwise key derivation, participant discovery | Implemented |
| **Encrypted Presence** | Typing/read/participant events relayed without plaintext payloads | Implemented |
| **Local Recovery** | Encrypted local history and recovery from delayed mobile-wallet callbacks | Implemented |
| **VINSS Agent** | Privacy-reduced context, proposal-only behavior, explicit approval boundary | Implemented |
| **Mainnet proof** | Mainnet STRK20 transaction evidence | 🟡 Pending |

---

## Deal Room execution path

```text
Invite
  ↓
Participant discovery
  ↓
Pairwise key derivation
  ↓
Private Chat
  ↓
Structured Offer
  ↓
Accept / Counter / Reject
  ↓
Encrypted Rekber setup
  ↓
Settlement
```

The frontend turns private Deal Room actions into encrypted, wallet-authorized application state.

---

## Privacy architecture

```text
Authorized user device
        │
        ├─ plaintext Message / Offer
        ├─ room secret
        ├─ pairwise ECDH private key
        ├─ pairwise encryption key
        ├─ local decrypted state
        └─ Escrow Rekber secrets
        │
        ▼
VINSS frontend privacy layer
        │
        ├─ encrypt payload
        ├─ derive opaque routing tags
        ├─ compute payload commitment
        └─ prepare wallet action
        │
        ▼
Privacy-enabled wallet
        │
        ▼
STRK20 Wallet API / Privacy Pool
        │
        ▼
VINSS helper contracts
        │
        ▼
public metadata + ciphertext
        │
        ▼
VINSS discovery backend
        │
        └─ ciphertext / opaque metadata only
        │
        ▼
authorized frontend matches + decrypts locally
```

### Frontend may hold

- plaintext Message content;
- plaintext Offer terms;
- room secrets;
- messaging private key material;
- pairwise encryption keys;
- local decrypted history;
- wallet interaction state;
- Escrow Rekber release/refund secrets.

### Backend must not receive

- pairwise private keys;
- room/channel keys;
- wallet private keys;
- plaintext Deal Room history through automatic discovery;
- Escrow Rekber release/refund secrets.

---

## Important implementation invariants

### 1. Direct communication uses pairwise keys

Current direct Chat and Offer use:

```text
P-256 ECDH
→ shared secret
→ HKDF-SHA-256
→ room-scoped pairwise VINSS key
```

The persisted ECDH private key is re-imported as a **non-exportable WebCrypto `CryptoKey`**.

See: [Privacy Model](./privacy-model.md)

### 2. Routing identity is opaque on-chain

Message and Offer records use fresh per-action routing tags derived from:

```text
routing key
+ role
+ participant identity
+ action locator
```

The helper does not need reusable plaintext sender/recipient identity fields.

See: [Two-Party Private Chat](./direct-chat.md) and [Private Offers](./offers.md)

### 3. Discovery is separate from decryption

The frontend may request:

```json
{ "kind": "message" }
```

or:

```json
{ "kind": "offer" }
```

The backend returns candidate ciphertext records.

The browser performs private route matching and decryption locally.

### 4. Wallet authorization remains explicit

VINSS prepares actions, but the wallet remains the transaction authority:

```text
VINSS frontend
→ wallet approval
→ STRK20 execution
```

The Agent and backend do not sign transactions.

### 5. Mobile-wallet callbacks are not treated as final truth

Ready/mobile browser handoff can delay a callback after a transaction has already been submitted.

VINSS persists prepared action metadata before wallet handoff and can reconcile pending state through ciphertext discovery.

See: [Application Flow](./application-flow.md)

---

## Main technical modules

```text
frontend/
├── hooks/room/
│   ├── useDirectConversation.ts
│   ├── useRoomParticipants.ts
│   └── useRoomOffers.ts
│
├── lib/deal-room/
│   ├── messaging.ts
│   ├── offers.ts
│   ├── invitation.ts
│   └── escrow.ts
│
├── lib/privacy/
│   ├── envelope.ts
│   ├── participantKeys.ts
│   ├── messageRouting.ts
│   ├── presence.ts
│   ├── encryptedChatCache.ts
│   └── channelKey.ts
│
├── lib/starknet/
│   ├── walletClient.ts
│   └── constants.ts
│
└── lib/agent.ts
```

`frontend/lib/deal-room/` is an **application-internal integration layer**, not currently presented as a stable external SDK.

---

## Read deeper

1. [Architecture](./architecture.md)
2. [Application Flow](./application-flow.md)
3. [Privacy Model](./privacy-model.md)
4. [Invitations](./invitation.md)
5. [Two-Party Private Chat](./direct-chat.md)
6. [Private Offers](./offers.md)
7. [Escrow Rekber](./escrow-rekber.md)
8. [Wallet & STRK20 Integration](./wallet-strk20.md)
9. [Agent Integration](./agent-integration.md)
10. [Local State](./local-state.md)
11. [Configuration](./configuration.md)
12. [Testing & Deployment](./testing-deployment.md)
13. [Current Scope](./current-scope.md)

---

## Evidence levels

VINSS documentation keeps these states separate:

```text
Implemented
≠
Tested
≠
Testnet On-chain Verified
≠
Mainnet Verified
```

Current strongest frontend evidence:

```text
Private Chat      ✅ Testnet on-chain verified
Structured Offer  ✅ Testnet on-chain verified
Escrow Rekber     🟡 E2E verification pending
Mainnet           🟡 Pending
```

---

## Documentation rule

Frontend technical documentation should explain:

```text
objective
→ responsibility
→ trust boundary
→ data flow
→ privacy boundary
→ execution mechanism
→ recovery/failure behavior
→ verification evidence
```

Only small code excerpts that expose an important invariant or mechanism are included.

The repository code remains the source of truth.
