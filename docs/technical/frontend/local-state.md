# Local State

## Objective

Local state provides privacy-preserving persistence and mobile recovery without treating browser storage as an authoritative network database.

## Room records

Current room records use:

```text
vinss:local-rooms
```

and can contain:

```text
id
label
roomSecret
createdAt
```

The room secret is currently stored in browser `localStorage`.

This is a deliberate current implementation boundary and a browser-origin security risk.

## Messaging identity

Per-room/per-wallet direct messaging identity is stored in IndexedDB:

```text
database: vinss-messaging-keys
store: identities
```

The persisted ECDH private key is a non-exportable WebCrypto `CryptoKey`.

## Participant cache

Peer address/public-key metadata can be cached in localStorage.

This cache improves continuity after mobile wallet/browser remounts.

It is not an authoritative participant registry.

## Encrypted chat history

History is encrypted before localStorage persistence:

```ts
const encrypted = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv,
  },
  key,
  plaintext,
);
```

Stored record shape:

```text
version
iv
ciphertext
```

## Pending transaction recovery

Prepared Message/Offer metadata can be persisted locally before wallet handoff.

This allows the frontend to reconcile a transaction whose wallet callback was delayed.

## Security boundary

Browser-local privacy depends on the integrity of the frontend origin.

Critical risks include:

- XSS;
- compromised dependencies;
- malicious browser extensions;
- origin compromise;
- device compromise.

A non-exportable `CryptoKey` reduces accidental key export but does not make a compromised browser environment safe.
