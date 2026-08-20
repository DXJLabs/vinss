# Frontend Privacy Model

## Objective

The frontend protects private deal context from public observers and from unnecessary backend access.

It does not claim that all blockchain metadata disappears.

## 1. Per-room, per-wallet messaging identity

Direct communication uses browser-generated P-256 ECDH identity material.

Important implementation:

```ts
const generated = await crypto.subtle.generateKey(
  { name: "ECDH", namedCurve: "P-256" },
  true,
  ["deriveBits"],
);
```

The private key is then re-imported as non-exportable before persistence:

```ts
const privateKey = await crypto.subtle.importKey(
  "jwk",
  privateJwk,
  { name: "ECDH", namedCurve: "P-256" },
  false,
  ["deriveBits"],
);
```

The non-exportable private key is stored in IndexedDB.

## 2. Pairwise direct key

Alice and Bob derive the same room-scoped pairwise key:

```text
P-256 ECDH
→ shared secret
→ HKDF-SHA-256
→ VINSS_DIRECT_MESSAGE_KEY_V1
```

Relevant derivation:

```ts
const derived = await crypto.subtle.deriveBits(
  {
    name: "HKDF",
    hash: "SHA-256",
    salt,
    info: new TextEncoder().encode(
      "VINSS_DIRECT_MESSAGE_KEY_V1",
    ),
  },
  hkdfMaterial,
  256,
);
```

The room ID is included in the HKDF salt.

## 3. Opaque per-action routing

Routing tags are HMAC-derived and change with every action locator:

```ts
const input = new TextEncoder().encode(
  `VINSS_MSG_ROUTE_V2:${role}:${canonicalIdentity}:${actionLocator.toString(16)}`,
);

const digest = await crypto.subtle.sign(
  "HMAC",
  key,
  input,
);
```

This avoids reusable plaintext sender/recipient fields in helper records.

It does not guarantee zero metadata or perfect unlinkability.

## 4. Payload encryption

Application payloads are encrypted locally with AES-GCM using a fresh IV.

Conceptually:

```text
JSON payload
→ AES-GCM
→ IV + ciphertext
→ Starknet-safe felt chunks
```

## 5. Room-level key

The currently active room-level key path derives from the shared room secret:

```ts
SHA-256("VINSS_ROOM_KEY_V1:" + roomSecret)
```

This is VINSS application keying.

It must not be described as identical to STRK20 internal note-encryption ECDH.

A separate Stark-curve ECDH path exists as scaffolded code but is not the active UI path.

## 6. Presence

Typing, read, and participant announcements are encrypted before relay.

The relay receives:

```text
opaque channel id
event id
IV
ciphertext
TTL
```

not plaintext presence payloads.

## 7. Public-observer boundary

Private application data includes:

- Message body;
- Offer terms;
- participant metadata inside encrypted payloads;
- local keys;
- Escrow Rekber secrets.

Public or observable data can still include:

- transaction timing;
- pool interaction;
- helper interaction;
- action locator;
- routing tags;
- commitments;
- ciphertext;
- current Rekber token/amount path.

Privacy is therefore a boundary, not a claim that all metadata disappears.
