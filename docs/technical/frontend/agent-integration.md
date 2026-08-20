# Agent Integration

## Objective

VINSS Agent assists with reasoning and preparation without becoming a signing authority or receiving the full private Deal Room timeline automatically.

## Supported skills

```text
chat
offer
escrow
```

## Frontend context minimization

Automatic timeline context is reduced before transmission.

Important implementation:

```ts
summary:
  item.kind === "offer"
    ? "Encrypted Offer action"
    : item.kind === "message"
      ? "Encrypted private message"
      : "Encrypted private activity"
```

The latest Offer is reduced to its action locator rather than sending the entire decrypted Offer object automatically.

## Explicit user text

Text typed directly into the Agent input is intentionally transmitted to the backend/provider.

This is different from automatic timeline context.

## Proposal boundary

Agent proposals include:

```text
draft_message
draft_offer
draft_counter_offer
prepare_escrow
review_rekber
```

Each proposal type requires approval:

```ts
requiresApproval: true
```

## Authority boundary

```text
Agent
→ draft / analysis / proposal
→ user reviews
→ user chooses whether to act
→ wallet authorizes transaction
```

The Agent has no independent transaction-signing authority.

It must not receive:

- wallet private keys;
- pairwise private keys;
- channel keys;
- release/refund secrets.
