# Local State

## Rooms

Current room records use:

```text
vinss:local-rooms
```

and include:

```text
id
label
roomSecret
createdAt
```

The room secret is currently stored in browser `localStorage` and used locally to derive the room-level key.

## Messaging private key

Direct messaging identity is stored in IndexedDB:

```text
database: vinss-messaging-keys
store: identities
```

The persisted private ECDH key is a non-exportable WebCrypto `CryptoKey`.

## Participant cache

Known peer address/public-key metadata is cached locally for UX continuity. It is not an authoritative on-chain participant registry.

## Encrypted chat cache

Chat history can be stored in `localStorage` as:

```text
version
iv
ciphertext
```

encrypted with AES-GCM.

## Invitations

Prepared invitation links can be persisted locally for mobile-wallet recovery. Invite encryption keys use the URL fragment (`#k=...`), which is not part of the normal HTTP request URL.

## Security boundary

Because room secrets and some application metadata are browser-local, XSS, compromised dependencies, origin compromise, and unsafe browser extensions are privacy-critical client risks.
