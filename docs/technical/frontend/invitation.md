# Invitation Flow

## Objective

The invitation flow bootstraps a private Deal Room without publishing the invitation payload as plaintext.

## Current model

Invite V3 supports:

```text
direct
group
```

with explicit expiry.

## Encrypted payload

The frontend generates:

- a random AES key;
- a fresh 96-bit IV;
- an on-chain secret;
- an invite commitment.

Important encryption shape:

```ts
const encrypted = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv,
    additionalData: getInviteAad("VINSS_INVITE_V3"),
  },
  key,
  plaintext,
);
```

## On-chain commitment

The contract receives a commitment rather than the plaintext invite secret:

```ts
Poseidon(
  VINSS_INVITE_V1,
  onchainSecret,
)
```

The deployed invite contract enforces one-time use and expiry.

## URL key boundary

The encrypted invite payload and key are transported separately.

The decryption key is intended to live in the URL fragment (`#k=...`), which is not part of the normal HTTP request URL.

## Recovery behavior

Before wallet handoff, VINSS can persist prepared invitation metadata locally.

If the wallet callback times out, the frontend checks on-chain invite state before deciding that creation failed.

## Security notes

Anyone who obtains the complete invite link can potentially join before expiry/consumption.

The invitation mechanism protects the payload from ordinary public transport/on-chain exposure; it does not protect against a recipient intentionally forwarding the complete invite link.
