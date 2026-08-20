# Application Flow

## End-to-end client path

```text
Connect wallet
    ↓
Open / join Deal Room
    ↓
Establish room-level context
    ↓
Discover participant identity
    ↓
Derive pairwise key
    ↓
Create private action
    ↓
Encrypt locally
    ↓
Derive opaque routing tags
    ↓
Commit encrypted envelope
    ↓
STRK20 wallet submission
    ↓
VINSS helper event
    ↓
Backend ciphertext discovery
    ↓
Local route match
    ↓
Local decrypt
    ↓
UI state reconciliation
```

## Message and Offer share the same privacy shape

Both direct Message and direct Offer paths use:

```text
pairwise key
+
fresh action locator
+
opaque sender/recipient tags
+
ciphertext
+
payload commitment
```

The semantics differ, but the privacy and discovery pattern is intentionally consistent.

## Recovery is part of the flow

Mobile wallet interaction can background or remount the dapp before a callback returns.

VINSS therefore persists prepared action metadata before wallet handoff and later reconciles using discovery.

Conceptually:

```text
prepare locator
→ persist pending state
→ open wallet
→ callback may return late
→ discovery confirms action
→ local state reconciles
```

This prevents a delayed wallet callback from being treated automatically as a failed on-chain action.

## Financial actions

Agent suggestions and local UI state do not execute financial actions independently.

The execution boundary remains:

```text
user decision
→ wallet authorization
→ STRK20 action
```
