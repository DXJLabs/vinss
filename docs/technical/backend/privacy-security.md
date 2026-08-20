# Privacy & Security

## Core security objective

The VINSS backend must remain operationally useful without becoming capable of decrypting private Deal Room content through the normal protocol path.

## Forbidden server knowledge

The core backend must not receive:

| Data | Boundary |
|---|---|
| Message plaintext | Client-side only |
| Offer plaintext terms | Client-side only |
| Room secret | Client-side only |
| Channel / pairwise key | Client-side only |
| Viewing key | Client / privacy infrastructure only |
| Wallet private key | Wallet only |
| Decrypted Deal Room history | Client-side only |
| Escrow Rekber release/refund secrets | Client-side only |

## Allowed backend data

The backend may process:

| Data | Reason |
|---|---|
| Action locator | Public helper record |
| Payload commitment | Public helper record |
| Opaque sender/recipient tags | Public helper metadata |
| Ciphertext chunks | Discovery transport |
| Block number | Public chain metadata |
| Transaction hash | Public chain metadata |
| Encrypted presence envelope | Ephemeral relay |
| Sanitized Agent metadata | Scoped remote reasoning |
| Loyalty subject/event metadata | Auxiliary application state |

## Enforced ciphertext-only discovery

The route explicitly rejects a channel key:

```ts
if ("channelKeyHex" in body) {
  return res.status(400).json({
    error:
      "channelKeyHex is not accepted. Discovery is ciphertext-only.",
  });
}
```

This is a server-side boundary, not only a frontend convention.

Regression tests also verify that:

- discovery code has no decryption path;
- `DiscoverRequest` has no channel-key field;
- frontend Message/Offer discovery does not send channel keys;
- decryption remains in frontend code.

## No transaction-sender attribution

The event indexer reads VINSS helper events and keyed action locators.

It does **not** use a normal transaction sender as the private user identity.

Important code intent:

```ts
const actionLocator = event.keys[1];
const payloadCommitment = event.data[0];
```

User-facing attribution is reconstructed only after authorized client-side decryption/routing validation.

## Agent defense in depth

### Context sanitizer

The server rebuilds context from an allowlist.

Example:

```ts
if (isRecord(value.latestOffer)) {
  const actionLocator = boundedString(
    value.latestOffer.actionLocator,
    MAX_LOCATOR_LENGTH,
  );

  if (actionLocator) {
    context.latestOffer = { actionLocator };
  }
}
```

Offer asset, amount, payment terms, conditions, room labels, arbitrary addresses, and arbitrary plaintext timeline summaries are not automatically preserved.

### Skill tool allowlist

Tool scope is enforced in code:

```ts
if (!skill.allowedTools.includes(name)) {
  throw new Error(
    `Tool not allowed for ${skill.id} skill: ${name}`,
  );
}
```

The model cannot expand its own tool authority through prompting.

## Logging boundary

Normal request logging records:

```text
METHOD PATH
```

Request bodies are intentionally excluded.

Do not add:

```text
raw Agent context
request bodies
decrypted payloads
keys / secrets
provider raw errors that may echo prompts
```

to production logs.

## External trust assumptions

The backend still depends on:

- Starknet RPC correctness and availability;
- deployed helper correctness;
- STRK20 / wallet behavior outside this process;
- runtime hosting security;
- remote LLM providers for optional Agent functionality.

Privacy minimization reduces server knowledge; it does not eliminate infrastructure risk.
