# Agent System

## Objective

VINSS Agent provides scoped reasoning and drafting assistance without turning a remote model into a transaction authority or automatically forwarding decrypted Deal Room history.

## Request path

```text
POST /agent
→ validate message/context/skill/provider
→ sanitizeAgentContext()
→ resolve explicit skill
→ expose skill-specific tool definitions
→ call configured provider
→ return draft / analysis / proposal
```

Supported skills:

```text
chat
offer
escrow
```

## Server-side context minimization

The server does not trust the caller to pre-sanitize correctly.

It rebuilds context itself.

Automatic timeline summaries become generic labels such as:

```text
Encrypted private message
Encrypted Offer action
Encrypted escrow action
Encrypted private activity
```

The latest Offer is reduced to:

```json
{
  "actionLocator": "0x..."
}
```

when available.

## Privacy trade-off

Because automatic context is deliberately stripped of Offer terms and detailed timeline semantics, remote Agent reasoning cannot reliably infer every private deal detail or lifecycle transition from automatic context alone.

The user may explicitly provide information in the Agent instruction when they want the remote model to reason about it.

That explicit text is remote-provider input.

## Skill boundaries

### Chat

```text
inspect_deal_state
draft_message
```

### Offer

```text
inspect_deal_state
analyze_offer
draft_offer
draft_counter_offer
calculate_fee
```

### Escrow

```text
inspect_deal_state
prepare_escrow
review_rekber
calculate_fee
```

Runtime enforcement:

```ts
if (!skill.allowedTools.includes(name)) {
  throw new Error(
    `Tool not allowed for ${skill.id} skill: ${name}`,
  );
}
```

## No execution authority

No Agent tool performs:

```text
wallet signing
transaction submission
escrow deposit
escrow release
escrow refund
Offer accept/reject execution
```

Agent proposals use:

```ts
requiresApproval: true
```

Actual blockchain execution remains a frontend + wallet action.

## Fee-tool boundary

`calculate_fee` uses `VINSS_FEE_BPS` and defaults to **25 bps** if unset.

It is an illustrative Agent calculation helper.

It is **not** the canonical source for the currently implemented Escrow Rekber contract/frontend fee path, which is defined elsewhere in the application code.

## Providers

Current provider registry supports:

```text
groq
openai
anthropic
qwen
```

`VINSS_LLM_PROVIDER` chooses the preferred provider and `VINSS_LLM_FALLBACKS` can define fallback order.

`GET /agent/providers` exposes configured provider IDs and available skills without exposing provider credentials.

## Provider failure boundary

Raw upstream failure content is not returned to the client.

`POST /agent` returns a generic:

```json
{ "error": "Agent failed." }
```

on internal provider/runtime failure.
