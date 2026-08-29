# VINSS Agent System

The VINSS Agent subsystem provides scoped reasoning, drafting, analysis, and proposal generation for Deal Room workflows.

Its core design goal is:

```text
useful remote reasoning
without
turning the remote model into transaction authority
```

The current implementation has two distinct AI boundaries:

```text
1. public VINSS Agent
   chat / offer / escrow

2. dedicated Dispute Agent
   dispute-only evaluation path
```

These must not be documented as the same privacy surface.

Executable backend source is the source of truth.

---

# Source Map

Primary Agent source:

```text
backend/src/agent/
├── context.ts
├── index.ts
├── prompts.ts
├── runtime.ts
├── tools.ts
├── providers/
│   ├── anthropic.ts
│   ├── groq.ts
│   ├── openai-compatible.ts
│   ├── registry.ts
│   └── types.ts
└── skills/
    ├── chat.ts
    ├── dispute.ts
    ├── escrow.ts
    ├── offer.ts
    ├── registry.ts
    └── types.ts
```

Public Agent route:

```text
backend/src/routes/agent.ts
```

Dedicated Dispute routes:

```text
backend/src/routes/dispute.ts
backend/src/dispute/
```

---

# Objective

VINSS Agent provides assistance such as:

```text
drafting a private message

reviewing explicitly shared Offer information

drafting Offer or counter-Offer proposals

preparing Rekber coordination parameters

reviewing Rekber readiness

performing illustrative fee calculations
```

while preserving the following authority boundary:

```text
Agent proposes
    ↓
user reviews
    ↓
frontend prepares transaction
    ↓
wallet authorizes
    ↓
Starknet execution
```

The Agent is not the user's wallet.

---

# Public Agent Request Path

Canonical public endpoint:

```text
POST /agent
```

High-level flow:

```mermaid
flowchart TD
    REQ[POST /agent]
    VALIDATE[Validate message context skill provider]
    SANITIZE[sanitizeAgentContext]
    SKILL[Resolve public skill]
    PROVIDERS[Resolve configured provider chain]
    PROMPT[Build scoped system + user input]
    LLM[Remote provider]
    TOOL{Tool call?}
    ENFORCE[executeSkillTool allowlist]
    RESULT[Tool result / proposal]
    ANSWER[Answer + proposal + provider metadata]
    ERROR[Generic Agent failed response]

    REQ --> VALIDATE
    VALIDATE --> SANITIZE
    SANITIZE --> SKILL
    SKILL --> PROVIDERS
    PROVIDERS --> PROMPT
    PROMPT --> LLM
    LLM --> TOOL
    TOOL -->|Yes| ENFORCE
    ENFORCE --> RESULT
    RESULT --> LLM
    TOOL -->|No| ANSWER
    PROVIDERS -->|all fail| ERROR
```

---

# Public Request Shape

`POST /agent` accepts application fields:

```text
message
context
skill
provider
```

Required:

```text
message
context
skill
```

Optional:

```text
provider
```

---

# `message`

The route requires:

```text
typeof message == string
message.trim() is non-empty
```

The message is sent to the selected remote provider.

Therefore:

> The Agent instruction itself is plaintext backend/provider input.

This is an explicit opt-in AI disclosure boundary.

It is not part of the ciphertext-only `/discover` path.

---

# `context`

The route requires:

```text
context is an object
context is not an array
```

The caller-provided object is **not** forwarded as-is.

It is rebuilt through:

```text
sanitizeAgentContext(...)
```

before entering the Agent runtime.

---

# Public Skill Validation

The public `/agent` route accepts only:

```text
chat
offer
escrow
```

Anything else returns:

```text
400
```

with the current public error:

```text
skill must be chat, offer, or escrow.
```

---

# Internal Skill Registry

The complete internal Agent skill type currently contains:

```text
chat
offer
escrow
dispute
```

Therefore:

```text
public Agent skills != complete internal Agent skill registry
```

The distinction is intentional.

---

# Dispute Skill Isolation

The internal:

```text
dispute
```

skill is deliberately excluded from:

```text
isPublicAgentSkillId(...)
```

and therefore cannot be selected through normal:

```text
POST /agent
```

The source explicitly preserves this separation so that the normal Agent remains free of dispute plaintext automatically.

Dedicated Dispute evaluation enters through:

```text
POST /dispute/challenge
POST /dispute/evaluate
```

instead.

---

# Agent Feature Flag

Agent routes are mounted only when:

```text
config.features.agent == true
```

Configuration:

```text
AGENT_ENABLED
```

Current default behavior:

```text
Sepolia / non-mainnet:
    enabled by default

Mainnet:
    disabled by default
```

unless explicitly overridden.

Because Dispute routes are mounted in the same Agent-enabled block, this feature flag currently also controls public exposure of:

```text
/dispute/challenge
/dispute/evaluate
```

---

# Mainnet Precision

The fact that Agent source exists in the repository does not mean a mainnet deployment exposes it.

Runtime exposure depends on:

```text
AGENT_ENABLED
```

and current deployment configuration.

Always verify the deployed environment.

---

# Agent Rate Limit

When Agent is enabled, the app mounts a fixed-window rate limiter for:

```text
/agent
```

using:

```text
RATE_LIMIT_WINDOW_MS
AGENT_RATE_LIMIT
```

The same configured Agent limit is currently also used for:

```text
/dispute
```

The limiter is in-memory and process-local.

Therefore:

```text
backend restart
```

resets counters.

Multiple replicas do not share rate-limit state unless deployment infrastructure supplies an external limiter.

---

# Context Sanitization

Normal Agent context is sanitized in:

```text
backend/src/agent/context.ts
```

The sanitizer uses an allowlist.

It does not attempt to maintain a giant blacklist of every possible private field.

This is the safer architectural direction.

---

# Normal Agent Context Output

Current sanitized `DealContext` may contain:

```text
timeline
latestOffer.actionLocator
```

The sanitizer does not retain arbitrary Deal Room fields.

---

# Timeline Limit

The sanitizer keeps at most:

```text
50
```

timeline items.

It takes:

```text
the last 50 supplied items
```

before rebuilding each item.

---

# Timeline Kind

Recognized privacy-safe kinds:

```text
message
offer
escrow
```

Anything else becomes:

```text
activity
```

This prevents arbitrary caller-supplied kind strings from being forwarded verbatim as semantic context.

---

# Timeline Summary Replacement

The caller's original timeline summary is discarded.

The backend generates fixed summaries.

For:

```text
message
```

it sends:

```text
Encrypted private message
```

For:

```text
offer
```

it sends:

```text
Encrypted Offer action
```

For:

```text
escrow
```

it sends:

```text
Encrypted escrow action
```

For unrecognized activity:

```text
Encrypted private activity
```

---

# Timeline Optional Fields

A sanitized timeline item may also retain bounded:

```text
sentAt
actionLocator
```

Current maximum lengths:

```text
sentAt       64 characters
actionLocator 128 characters
```

Empty strings are removed.

---

# What Timeline Sanitization Removes

For normal Agent context, caller-supplied fields such as:

```text
message plaintext
wallet address
room label
private event summary
Offer terms
arbitrary metadata
keys
secrets
```

are not retained merely because they are attached to a timeline object.

---

# Latest Offer Sanitization

The normal Agent sanitizer examines:

```text
context.latestOffer
```

but retains only:

```json
{
  "actionLocator": "..."
}
```

when the locator is present.

It strips automatically supplied fields such as:

```text
asset
amount
paymentTerms
conditions
```

---

# Important Offer Privacy Consequence

The Agent tool layer's `DealContext` type is capable of representing:

```text
asset
amount
paymentTerms
conditions
```

for tests or explicitly constructed internal contexts.

But normal public `/agent` context passes through the sanitizer first.

Therefore those private Offer terms are **not automatically available** to the remote Agent.

---

# Sanitizer Regression Evidence

The current backend Agent test explicitly constructs context containing:

```text
Secret Room
USDC
50000
Net 7
Private condition
private message body
wallet address
room secret
channel key
```

and verifies those values do not survive serialized sanitized context.

It also verifies:

```text
latestOffer
```

becomes only:

```text
actionLocator
```

and message summary becomes:

```text
Encrypted private message
```

This is explicit regression-test evidence for the current sanitizer.

---

# Privacy Trade-off

The privacy-safe sanitizer intentionally reduces model context.

As a result, the normal remote Agent may not know:

```text
Offer amount
Offer asset
payment terms
conditions
exact private message content
full negotiation history
participant identity
```

unless that information is explicitly supplied by the user through the Agent instruction or another deliberately allowed disclosure path.

---

# Explicit User Disclosure

If the user writes private business information directly into:

```text
message
```

that text is forwarded to the selected remote provider.

Therefore an accurate UI/privacy statement is:

> Automatic Deal Room context is minimized, but information the user explicitly types into the Agent request is shared with the selected Agent provider.

---

# Agent Input Object

The provider receives a JSON user input shaped conceptually as:

```json
{
  "request": "...",
  "currentDealStage": "...",
  "privacySafeContext": {}
}
```

constructed by:

```text
buildAgentInput(...)
```

---

# Deal Stage Inference

The Agent tool layer defines stages:

```text
discussion
negotiating
offer_pending
agreed
escrow_pending
funded
rekber_pending
completed
```

The stage is inferred from:

```text
sanitized timeline summary text
latestOffer existence
```

---

# Stage Inference Precision

Because normal timeline summaries are replaced with generic labels such as:

```text
Encrypted private message
Encrypted Offer action
Encrypted escrow action
```

many historical semantic strings used by `inferDealStage(...)` are no longer present in normal sanitized public Agent context.

Examples of strings the stage inference knows how to detect include:

```text
released
funded
escrow deposit
accept offer
prepare_escrow
```

but the normal sanitizer does not preserve arbitrary caller summary text.

Therefore normal Agent stage inference can be intentionally conservative.

Do not claim it reconstructs the full private lifecycle from ciphertext.

---

# Skill Model

A skill contains:

```text
id
description
instructions
allowedTools[]
```

The selected skill determines both:

```text
model instructions
tool visibility
```

---

# Skill Enforcement Layers

The implementation enforces tool scope in multiple places.

## Provider Tool Exposure

Only tools whose names appear in:

```text
skill.allowedTools
```

are sent to the provider.

## Runtime Execution Check

Even if the provider tries to call another tool, runtime checks:

```text
if (!skill.allowedTools.includes(name)) {
    throw
}
```

before execution.

## Unknown Tool Check

The lower-level tool executor also rejects unknown/unregistered tool names.

This means tool scope is not only prompt-level guidance.

---

# Skill Enforcement Diagram

```mermaid
flowchart TD
    SKILL[Selected skill]
    ALL[All registered Agent tools]
    FILTER[toolDefinitionsForSkill]
    VISIBLE[Provider-visible tools]
    CALL[Provider tool call]
    CODECHECK[executeSkillTool]
    EXEC[executeTool]
    BLOCK[Reject]

    SKILL --> FILTER
    ALL --> FILTER
    FILTER --> VISIBLE
    VISIBLE --> CALL
    CALL --> CODECHECK
    SKILL --> CODECHECK
    CODECHECK -->|Allowed| EXEC
    CODECHECK -->|Forbidden| BLOCK
```

---

# Public Chat Skill

Skill:

```text
chat
```

Description:

```text
Private messaging and conversation assistance.
```

Allowed tools:

```text
inspect_deal_state
draft_message
```

The skill instructions explicitly say:

```text
draft only
never send
do not create/counter Offers
do not prepare escrow
do not pretend to know undisclosed private plaintext
```

---

# Public Offer Skill

Skill:

```text
offer
```

Allowed tools:

```text
inspect_deal_state
analyze_offer
draft_offer
draft_counter_offer
calculate_fee
```

The skill instructions explicitly prohibit:

```text
accepting Offer
rejecting Offer
preparing escrow
funding escrow
```

and require private terms to be either:

```text
reviewed locally
```

or:

```text
explicitly supplied
```

when not present in privacy-safe context.

---

# Public Escrow Skill

Skill:

```text
escrow
```

Allowed tools:

```text
inspect_deal_state
prepare_escrow
review_rekber
calculate_fee
```

Instructions explicitly prohibit:

```text
deposit
release
refund
sign
move funds
draft chat messages
create Offers
counter Offers
```

---

# Internal Dispute Skill

Skill:

```text
dispute
```

Allowed tools:

```text
inspect_deal_state
```

only.

The skill is designed for evidence-scoped Rekber dispute reasoning.

---

# Dispute Prompt-Injection Boundary

The internal Dispute skill explicitly tells the model that:

```text
accepted terms
statements
links
file labels
tracking text
evidence values
```

are untrusted data.

They must not be interpreted as model/system instructions.

The skill also instructs the model to ignore:

```text
prompt injection
commands
role overrides
tool requests embedded in evidence
```

This is a model-level safety layer.

It is not a cryptographic guarantee.

---

# Dispute Missing-Evidence Rule

The internal instructions direct uncertain cases such as:

```text
missing evidence
conflicting evidence
unverifiable evidence
identity-uncertain evidence
```

toward:

```text
needs_review
```

rather than invented certainty.

Actual AutoResolve eligibility is additionally enforced by dedicated dispute policy/backend logic outside the generic Agent tool registry.

---

# Dispute Execution Precision

The `dispute` skill itself has no signing or transaction tool.

However, the overall **Dispute backend subsystem** may later authorize a resolver transaction through separate:

```text
backend/src/dispute/executor.ts
```

logic when policy returns:

```text
AUTO_RESOLVE
```

Therefore the accurate statement is:

> The Agent skill cannot execute transactions; the separately privileged Dispute service may use a dedicated resolver authority after independent verification and policy gates.

Do not collapse these two layers.

---

# Registered Agent Tools

Current generic Agent tool registry contains:

```text
inspect_deal_state
analyze_offer
draft_message
draft_offer
draft_counter_offer
prepare_escrow
review_rekber
calculate_fee
```

There is no generic Agent tool named:

```text
send_transaction
sign_transaction
deposit_funds
release_escrow
refund_escrow
accept_offer
reject_offer
authorize_resolution
transfer_token
```

---

# `inspect_deal_state`

This tool returns only:

```text
stage
```

based on:

```text
inferDealStage(context)
```

It does not query Starknet directly.

It does not read PostgreSQL.

It does not decrypt anything.

---

# `analyze_offer`

This tool analyzes:

```text
context.latestOffer
```

if detailed fields are available.

It checks whether fields such as:

```text
paymentTerms
conditions
amount
```

are available/valid and produces:

```text
riskLevel
findings
offer
```

---

# `analyze_offer` Normal Public-Agent Limitation

Because `sanitizeAgentContext(...)` strips automatic Offer terms, a normal public Agent invocation will usually not have full:

```text
asset
amount
paymentTerms
conditions
```

in `context.latestOffer`.

Therefore this tool cannot be described as:

```text
automatically analyzing decrypted current Offer
```

under the standard public route.

---

# `draft_message`

Input:

```text
body
```

Result:

```text
AgentProposal
type = draft_message
requiresApproval = true
```

The tool only creates proposal data.

It does not call the messaging contract or frontend composer.

---

# `draft_offer`

Input:

```text
asset
amount
paymentTerms
conditions?
```

Result:

```text
AgentProposal
type = draft_offer
requiresApproval = true
```

The tool does not sign or create an on-chain Offer action.

---

# `draft_counter_offer`

Input:

```text
amount?
terms?
```

The tool also expects detailed:

```text
context.latestOffer
```

to contain enough shared Offer information.

If it lacks:

```text
asset
amount
paymentTerms
```

it throws a message explaining that private Offer terms are not available to the remote Agent and must be supplied explicitly.

This behavior aligns with normal Agent privacy minimization.

---

# `prepare_escrow`

Possible proposal payload:

```text
dealOfferLocator
amount
token
refundHours
```

If no explicit:

```text
dealOfferLocator
```

is provided, the tool may use:

```text
context.latestOffer.actionLocator
```

Current default proposal value:

```text
refundHours = "24"
```

when not supplied.

This is proposal-layer behavior.

It is not a canonical Rekber contract deadline or contract default.

---

# `prepare_escrow` Authority Boundary

The proposal description explicitly says:

```text
No funds will move until wallet approval.
```

The tool itself does not:

```text
transfer token
approve token
invoke Privacy Pool
fund Rekber
```

---

# `review_rekber`

Input:

```text
reason
```

Result:

```text
AgentProposal
type = review_rekber
requiresApproval = true
```

It is a review proposal only.

It does not release funds.

---

# `calculate_fee`

Input:

```text
amount
```

The tool converts amount with:

```text
Number(amount)
```

and rejects:

```text
non-finite
negative
```

values.

Calculation:

```text
fee = amount * feeBps / 10_000
total = amount + fee
```

---

# Agent Fee Configuration

Public Agent route passes:

```text
config.agent.feeBps
```

into the runtime.

Configuration:

```text
VINSS_FEE_BPS
```

Current default:

```text
200
```

basis points.

That equals:

```text
2%
```

for this illustrative helper.

---

# Fee Tool Is Not Canonical Contract Pricing

This is one of the most important documentation boundaries.

`calculate_fee` does **not** query:

```text
VinssFeePolicy
Pragma
VinssEscrowRekber.quote_rekber_fee
```

It performs local JavaScript arithmetic from:

```text
amount
feeBps
```

Therefore it is only:

```text
illustrative Agent calculation
```

---

# Production Fee Sources

Current production smart-contract pricing must be documented from the actual contract path, including:

```text
VinssFeePolicy
Rekber fee formula
oracle conversion
sponsor-cost floor
frontend workflow policy where applicable
```

The Agent's `VINSS_FEE_BPS` must not be described as a global protocol fee.

---

# Numeric Precision Boundary

`calculate_fee` uses JavaScript:

```text
Number
```

rather than integer token-unit arithmetic such as:

```text
bigint
```

Therefore it should not be used as authoritative financial settlement calculation for large or precision-sensitive token amounts.

It is presentation/advisory logic.

---

# Proposal Type

Proposal-producing tools return objects containing:

```text
type
title
description
requiresApproval: true
payload
```

Current proposal types:

```text
draft_message
draft_offer
draft_counter_offer
prepare_escrow
review_rekber
```

---

# Proposal Detection

Runtime identifies a result as an Agent proposal when the result:

```text
is an object
has type
has requiresApproval
requiresApproval == true
```

The provider keeps the most recently observed proposal during a tool-call loop.

---

# Proposal Is Not Execution

`requiresApproval: true` is an application-level semantic marker.

It does not itself cryptographically enforce wallet approval.

The deeper protection is that the generic Agent tool registry contains no user-transaction execution tool.

Actual transaction authority remains outside this subsystem.

---

# Base System Prompt

The base Agent system prompt explicitly requires:

```text
operate only inside selected skill

never claim hidden-message/key access

never sign/send/fund/release/refund/execute

blockchain/financial actions need user approval + wallet confirmation

Ready/wallet remains final transaction authority

proposal is review-ready draft

never invent private deal facts
```

This prompt is defense-in-depth.

Code-level tool restrictions remain the stronger runtime boundary.

---

# System Prompt Construction

Provider system instructions combine:

```text
BASE_SYSTEM_PROMPT

+

systemPromptForSkill(skill)
```

The skill prompt includes:

```text
skill-specific instructions
allowed tool names
statement that any other tool is forbidden
```

---

# Provider Registry

Current logical provider IDs:

```text
groq
openai
anthropic
qwen
```

Selection type also supports:

```text
auto
```

---

# Public Provider Validation

`POST /agent` validates optional `provider`.

Accepted values:

```text
auto
groq
openai
anthropic
qwen
```

Invalid values return:

```text
400
```

before provider execution.

---

# `GET /agent/providers`

When Agent is enabled, this endpoint returns current information including:

```text
network
defaultProvider
configuredProviders
skills
```

The public `skills` response explicitly removes:

```text
dispute
```

from the internal skill list.

---

# Provider Credentials

`GET /agent/providers` does not return:

```text
API keys
base-url credentials
resolver private key
```

It exposes only configured provider IDs and public runtime metadata.

---

# Provider Configuration Detection

Each provider has an:

```text
isConfigured()
```

check.

Only providers that satisfy their configuration requirements enter the executable provider chain.

---

# Groq Configuration

Groq is considered configured when:

```text
GROQ_API_KEY
```

is non-empty.

Current model selection:

```text
GROQ_MODEL
```

or default:

```text
openai/gpt-oss-120b
```

---

# OpenAI-Compatible OpenAI Configuration

OpenAI provider requires:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

Current default base URL:

```text
https://api.openai.com/v1
```

which can be overridden with:

```text
OPENAI_BASE_URL
```

Unlike Groq/Qwen, current OpenAI provider has no built-in model default.

Without `OPENAI_MODEL`, it is not treated as configured.

---

# Qwen Configuration

Qwen API key can come from:

```text
QWEN_API_KEY
```

or:

```text
DASHSCOPE_API_KEY
```

Current default model:

```text
qwen-plus
```

Current default compatible-mode base URL:

```text
https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Override:

```text
QWEN_BASE_URL
QWEN_MODEL
```

---

# Anthropic Configuration

Anthropic requires:

```text
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
```

Default base URL:

```text
https://api.anthropic.com/v1
```

Override:

```text
ANTHROPIC_BASE_URL
```

Current default API version header:

```text
2023-06-01
```

Override:

```text
ANTHROPIC_VERSION
```

Current default max tokens:

```text
2048
```

Override:

```text
ANTHROPIC_MAX_TOKENS
```

---

# Default Provider Selection

Configuration parsing sets:

```text
VINSS_LLM_PROVIDER
```

with current fallback selection:

```text
groq
```

when absent.

Accepted config values:

```text
auto
groq
openai
anthropic
qwen
```

---

# Provider Resolution

The provider runtime determines a selected preference from:

```text
request.provider
```

when supplied.

Otherwise it uses:

```text
VINSS_LLM_PROVIDER
```

or effectively:

```text
groq
```

when no valid selection exists.

---

# Fallback Configuration

Fallback order is read from:

```text
VINSS_LLM_FALLBACKS
```

as a comma-separated list.

Recognized entries:

```text
groq
openai
anthropic
qwen
```

Unknown entries are removed.

Duplicates are deduplicated before execution.

---

# Fallback Semantics for Explicit Provider

For an explicit/non-auto selection:

```text
selected
+
VINSS_LLM_FALLBACKS
```

is used.

Example:

```text
provider = anthropic
VINSS_LLM_FALLBACKS = groq,qwen
```

candidate order becomes:

```text
anthropic
groq
qwen
```

after filtering to actually configured providers.

---

# Fallback Semantics for `auto`

For:

```text
provider = auto
```

if:

```text
VINSS_LLM_FALLBACKS
```

contains valid entries, that list itself becomes the preferred candidate order.

If no fallback list is configured, `auto` uses built-in order:

```text
groq
openai
anthropic
qwen
```

---

# Important `auto` Precision

With a non-empty:

```text
VINSS_LLM_FALLBACKS
```

the `auto` path does **not** automatically append every remaining built-in provider after the configured list.

It uses the configured fallback list, deduplicated and filtered to configured providers.

---

# Provider Availability Filtering

Candidate provider IDs are filtered against:

```text
configuredProviders()
```

before execution.

A selected provider that lacks required environment configuration is skipped.

If no providers remain:

```text
runVinssAgent(...)
```

throws:

```text
No configured VINSS LLM provider is available.
```

The route later maps this to generic client failure.

---

# Provider Failover

`runVinssAgent(...)` iterates providers sequentially.

For each candidate:

```text
try provider.run(...)
```

If the provider throws:

```text
log provider identity only
try next configured provider
```

If one succeeds:

```text
return immediately
```

If all fail:

```text
throw
```

---

# Provider Failure Logging

Current failure log:

```text
[VINSS AGENT PROVIDER FAILED] <provider-id>
```

The implementation intentionally does not log raw upstream error content there.

Reason:

> Provider errors may echo request content.

This reduces accidental disclosure of Agent prompts/private explicit user input.

---

# Public Provider Failure Response

`POST /agent` catches internal Agent/provider failures and returns:

```json
{
  "error": "Agent failed."
}
```

with:

```text
HTTP 500
```

Raw upstream provider error text is not returned through this route.

---

# Tool-Calling Loop

Each current provider implementation allows at most:

```text
4
```

tool-call iterations.

If the model continues requesting tools beyond that bound, provider execution fails.

Examples:

```text
Groq reached maximum tool iterations.
Anthropic reached maximum tool iterations.
openai/qwen reached maximum tool iterations.
```

Those internal errors are eventually hidden behind public:

```text
Agent failed.
```

if no fallback provider succeeds.

---

# Groq Runtime

Groq uses:

```text
groq-sdk
```

with:

```text
tool_choice = auto
temperature = 0.2
```

and the skill-filtered tool list.

Each returned tool call is executed locally through:

```text
executeSkillTool(...)
```

and its result is sent back to the model as tool output.

---

# OpenAI-Compatible Runtime

OpenAI and Qwen share the compatible provider implementation.

The runtime calls:

```text
<baseUrl>/chat/completions
```

with:

```text
model
messages
tools
tool_choice = auto
```

The backend executes returned tool calls locally.

---

# Anthropic Runtime

Anthropic uses:

```text
<baseUrl>/messages
```

and transforms the generic Agent tool definitions into Anthropic tool schema:

```text
name
description
input_schema
```

Returned:

```text
tool_use
```

blocks are executed locally and returned as:

```text
tool_result
```

blocks.

---

# Provider Result Shape

Successful provider execution returns:

```text
answer
dealStage
proposal
provider
model
```

`runVinssAgent(...)` then also adds:

```text
skill
```

---

# Public Agent Response

The route returns the Agent result plus:

```text
network
contextShared: true
```

Conceptually:

```json
{
  "answer": "...",
  "dealStage": "discussion",
  "proposal": null,
  "provider": "groq",
  "model": "...",
  "skill": "chat",
  "network": "sepolia",
  "contextShared": true
}
```

Exact values depend on runtime/provider output.

---

# `contextShared` Meaning

Current route always returns:

```text
contextShared = true
```

after successful Agent execution.

This should not be interpreted as:

```text
full Deal Room context shared
```

The route has shared:

```text
explicit message
+
sanitized context
```

The sanitizer strips private automatic fields.

---

# No Generic Transaction Authority

No generic Agent tool performs:

```text
wallet signing
transaction submission
token approval
Privacy Pool invocation
Rekber funding
Rekber release
Rekber refund
Offer accept
Offer reject
Settlement Certificate claim
resolver authorization
```

This is directly regression-tested for representative forbidden tool names.

---

# Agent Tool Regression Tests

Current test source checks that generic tool definitions do not contain representative execution tools:

```text
send_transaction
release_escrow
deposit_funds
sign_transaction
```

It also confirms that trying to execute:

```text
send_transaction
```

through generic `executeTool(...)` throws:

```text
Tool not allowed
```

---

# Skill-Specific Regression Tests

Current tests verify:

```text
Chat tool list is exactly:
  draft_message
  inspect_deal_state

Offer does not expose prepare_escrow

Escrow does not expose draft_message

Dispute tool list is exactly:
  inspect_deal_state
```

---

# Cross-Skill Execution Regression Tests

Current tests verify runtime rejection for examples such as:

```text
chat -> draft_offer

offer -> prepare_escrow

escrow -> draft_message

dispute -> prepare_escrow
```

These fail with the skill-specific:

```text
Tool not allowed for <skill> skill
```

guard.

---

# Proposal Regression Tests

Current tests verify:

```text
draft counter Offer
-> requiresApproval == true

draft private message
-> requiresApproval == true
```

This provides regression evidence for current proposal semantics.

---

# Fee Test Boundary

Current Agent test calls:

```text
calculateFee("10000", 25)
```

and verifies:

```text
fee = 25
total = 10025
```

This proves deterministic local arithmetic for that test input.

It does not prove:

```text
FeePolicy correctness
Rekber oracle quote correctness
production sponsor-cost behavior
```

---

# Agent vs Smart Contract Fee Boundary

Keep these separate:

```text
Agent illustrative fee helper
    -> VINSS_FEE_BPS
    -> Number arithmetic

Message / Offer / Invite contract fees
    -> VinssFeePolicy

Rekber funding fee
    -> VinssEscrowRekber quote logic
    -> FeePolicy/oracle/2% rules

application workflow fee
    -> frontend/application policy where implemented
```

They are not interchangeable.

---

# Public Agent Privacy Boundary

The normal Agent receives:

```text
explicit user message
sanitized context
```

It should not automatically receive:

```text
room secret
channel key
pairwise key
wallet private key
full decrypted chat history
full decrypted Offer terms
unrelated Deal Room plaintext
```

---

# Remote Provider Boundary

When using a remote provider, transmitted content includes at least:

```text
system prompt
skill instructions
explicit Agent request
sanitized Agent context
tool definitions
tool results generated during the reasoning loop
```

Provider-specific transport/security/data-retention policies are external service properties.

VINSS backend code cannot make them equivalent to local-only processing.

---

# Tool Results Can Contain Explicitly Supplied Data

If the user explicitly supplies fields through a tool call/request path, a tool result can contain those values and they can be sent back into the provider conversation.

For example a drafted Offer proposal may contain:

```text
asset
amount
payment terms
conditions
```

because the Agent needs them to generate the requested draft.

Therefore:

```text
sanitize automatic context
```

does not mean:

```text
no explicitly disclosed private data can ever reach provider
```

---

# Normal Agent Does Not Read `/discover`

The current generic Agent tool registry does not contain a tool that calls:

```text
POST /discover
```

or directly queries:

```text
DiscoveryStore
```

for ciphertext/decrypted content.

The sanitized context is supplied by the caller.

---

# Agent Does Not Decrypt Ciphertext

No generic Agent tool contains:

```text
channel key
pairwise key
AES key
room secret
ciphertext decrypt
```

logic.

Therefore Agent cannot independently decrypt indexed Deal Room ciphertext.

---

# Agent Does Not Know Wallet Identity From Routing Tags

Normal Agent context does not convert:

```text
senderTag
recipientTag
```

into participant wallet identities.

The generic Agent architecture should not claim identity resolution from encrypted helper routing metadata.

---

# `inspect_deal_state` Is Not Chain Verification

The name:

```text
inspect_deal_state
```

can sound stronger than its current implementation.

It only calls:

```text
inferDealStage(context)
```

against supplied/sanitized context.

It does not perform:

```text
Rekber get_custody RPC
certificate lookup
indexer lookup
wallet verification
```

Therefore do not describe it as on-chain state verification.

---

# Normal Agent vs Dispute Chain Reads

This is another important separation.

Normal:

```text
inspect_deal_state
```

is local context inference.

Dedicated Dispute flow separately performs explicit:

```text
readAndVerifyDisputeCustody(...)
readVerifiedPrincipalUsdMicros(...)
```

against configured chain data.

Do not attribute Dispute verification strength to normal Agent tools.

---

# Public Agent Skill Table

| Public skill | Allowed tools | Transaction authority |
|---|---|---|
| `chat` | `inspect_deal_state`, `draft_message` | None |
| `offer` | `inspect_deal_state`, `analyze_offer`, `draft_offer`, `draft_counter_offer`, `calculate_fee` | None |
| `escrow` | `inspect_deal_state`, `prepare_escrow`, `review_rekber`, `calculate_fee` | None |

---

# Internal Dispute Skill Table

| Internal skill | Public `/agent` selectable | Allowed tools | Generic transaction authority |
|---|---:|---|---:|
| `dispute` | No | `inspect_deal_state` | None |

Dedicated dispute execution authority, when enabled, lives outside this generic skill/tool mechanism.

---

# Agent Security Layers

Current Agent safety design includes:

```text
public skill validation

server-side context allowlist

fixed timeline summaries

latest Offer minimization

skill-specific system instructions

provider-visible tool filtering

runtime cross-skill tool rejection

no generic transaction tools

approval-required proposal objects

provider failover with identity-only error logging

generic public failure response

mainnet-disabled-by-default feature flag

route rate limiting
```

No single layer should be treated as sufficient by itself.

---

# Agent Non-Guarantees

The Agent subsystem does not guarantee:

```text
LLM factual correctness

Offer economic fairness

work quality

counterparty honesty

legal enforceability

oracle truth

wallet security

private data retention policies of remote providers

successful transaction execution

correct frontend handling of proposal payload

complete Deal Room lifecycle inference

canonical contract fee calculation
```

---

# Prompt Injection Boundary

Normal Agent input is user-provided instructions.

The backend does not execute arbitrary model-requested functions outside the registered skill allowlist.

Therefore a prompt injection that asks the model to call:

```text
send_transaction
```

cannot create that missing tool inside the generic registry.

This is an important code-level containment property.

---

# Tool Argument Validation Precision

Tool definitions expose JSON schemas with:

```text
additionalProperties: false
```

for provider guidance.

However the backend should not overclaim schema-level cryptographic validation.

Provider responses are still parsed by runtime JavaScript, and tool functions themselves perform relevant validation/conversion.

Security-critical authorization comes from:

```text
tool name allowlist
```

not merely generated JSON schema.

---

# Provider Tool-Call JSON Parsing

Groq/OpenAI-compatible paths parse tool arguments from provider-returned JSON.

Malformed JSON can cause provider execution to throw and trigger fallback behavior.

This is acceptable fail-closed behavior for the Agent request.

It does not execute partially parsed transaction authority because no such generic tool exists.

---

# Maximum Tool Iterations

The fixed:

```text
4 iteration
```

limit provides a simple bound against endless provider tool loops.

It is not a complete model-cost budget.

Production controls may additionally require:

```text
provider quotas
API-key limits
request rate limits
cost monitoring
timeouts
```

depending on deployment.

---

# Provider Timeout Boundary

The current provider calls shown in this subsystem do not establish a generic explicit AbortController timeout in the Agent provider code.

Therefore network/provider timeouts depend on surrounding runtime/fetch/SDK behavior unless deployment adds another timeout layer.

Do not claim a specific Agent upstream timeout without checking current runtime/deployment configuration.

---

# Provider Fallback Privacy

Fallback means the same Agent request may be sent to more than one configured provider sequentially if earlier providers fail.

Therefore, when:

```text
VINSS_LLM_FALLBACKS
```

is configured, operators should understand that explicitly disclosed Agent text may reach multiple remote providers during one request failure chain.

This is an operational privacy consideration.

---

# `configuredProviders()` Order

Current built-in order:

```text
groq
openai
anthropic
qwen
```

`GET /agent/providers` reports configured provider IDs in this built-in order.

Actual execution order can differ based on:

```text
request.provider
VINSS_LLM_PROVIDER
VINSS_LLM_FALLBACKS
```

---

# Provider Credential Logging

Agent runtime should never log:

```text
GROQ_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
QWEN_API_KEY
DASHSCOPE_API_KEY
```

Current provider failover logging only outputs provider ID.

That behavior should be preserved.

---

# Agent HTTP Error Boundary

Current normal `/agent` validation errors include:

```text
message is required.

privacy-safe context is required.

skill must be chat, offer, or escrow.

provider must be auto, groq, openai, anthropic, or qwen.
```

These are client input errors.

Provider/runtime failures become:

```text
Agent failed.
```

---

# Agent Availability Endpoint

`GET /agent/providers` is useful for frontend capability discovery.

It tells the frontend:

```text
which providers are configured

which public skills are available

which provider is the configured default
```

It should not be treated as proof that a provider request will succeed.

A provider may be configured but unavailable at runtime.

---

# Public Skills Returned by Provider Endpoint

Although:

```text
listAgentSkills()
```

includes:

```text
dispute
```

the route filters it out before returning public skills.

This is deliberate API behavior.

---

# Dispute Agent Overview

Dedicated Dispute workflow has a stronger explicit-disclosure model.

It may process plaintext such as:

```text
accepted terms
party statements
evidence values
wallet addresses
principal snapshot
fulfillment snapshot
```

after the user/parties intentionally submit those fields.

---

# Dispute Consent

Each dispute party packet must contain:

```text
consentToAgentReview = true
```

before the dispute evidence sanitizer accepts it.

This makes the disclosure intentional at application level.

---

# Dispute Evidence Is Untrusted

The Dispute skill prompt treats:

```text
statements
links
file labels
tracking text
other evidence values
```

as untrusted data.

That is particularly important because evidence may contain arbitrary attacker-controlled strings.

---

# Dispute Agent Does Not Get Unrelated Chat Automatically

The dedicated dispute sanitizer is an allowlist.

It does not accept arbitrary unknown keys as part of canonical dispute case data.

The source specifically intends fields such as:

```text
roomSecret
channelKey
private keys
unrelated chat
```

to be dropped.

---

# Dispute vs Normal Agent Summary

```mermaid
flowchart LR
    ROOM[Private Deal Room]

    NORMAL[Normal Agent]
    NSAN[Sanitized metadata]
    PROMPT[Explicit user prompt]
    LLM[Remote provider]

    DISPUTE[Dispute Agent]
    CONSENT[Explicit party consent]
    EVIDENCE[Disclosed terms statements evidence]
    VERIFY[Binding + chain verification]
    POLICY[Dispute policy]
    RESOLVER[Optional resolver authorization]

    ROOM --> NSAN
    NSAN --> NORMAL
    PROMPT --> NORMAL
    NORMAL --> LLM

    ROOM --> CONSENT
    CONSENT --> EVIDENCE
    EVIDENCE --> DISPUTE
    DISPUTE --> VERIFY
    VERIFY --> POLICY
    POLICY --> RESOLVER
```

These are intentionally different privacy/security workflows.

---

# Transaction Authority Summary

## Normal Agent

```text
No signing key
No wallet signing tool
No transaction submission tool
No fund movement tool
```

## Dispute skill itself

```text
No signing/execution tool
Read-only generic tool list
```

## Dedicated Dispute executor

Potentially:

```text
dedicated resolver key
resolver contract call
```

only when enabled and separately policy-authorized.

This is the only privileged Agent-adjacent execution exception that must be documented explicitly.

---

# Ready / Wallet Boundary

Base system prompt says:

```text
Ready/wallet remains the final transaction authority.
```

For normal participant actions, architecture remains:

```text
Agent proposal
    ↓
frontend
    ↓
user approval
    ↓
Ready / wallet
    ↓
transaction
```

The remote Agent never becomes the participant's wallet.

---

# Frontend Proposal Responsibility

When frontend receives:

```text
proposal
```

it must treat the payload as:

```text
suggested application data
```

not as trusted transaction calldata.

Frontend should still perform:

```text
input validation
current-state validation
fee quote refresh
wallet confirmation
contract compatibility checks
```

before any execution.

---

# Stale Proposal Boundary

Agent proposal data can become stale if chain/app state changes after generation.

Examples:

```text
Offer already countered

Rekber already funded

fee changed

deadline changed

custody consumed

wallet changed account
```

Therefore proposal generation must never replace execution-time validation.

---

# Fee Quote Refresh

Especially for production fees:

```text
Agent illustrative calculate_fee result
```

must not be reused as:

```text
quoted_fee
```

without obtaining the actual current application/contract fee source required by that transaction.

---

# Agent Output Trust

Treat model-generated:

```text
answer
proposal
analysis
```

as advisory.

Do not use natural-language model output as direct smart-contract authorization.

Where structured proposal data is consumed, it must pass frontend/application validation.

---

# Model Name Exposure

Successful response includes:

```text
provider
model
```

This is operational transparency for the request.

It also means frontend/logging systems should avoid assuming one fixed model forever.

Models are environment-configurable.

---

# Agent Configuration Summary

Relevant current configuration includes:

```text
AGENT_ENABLED

AGENT_RATE_LIMIT
RATE_LIMIT_WINDOW_MS

VINSS_FEE_BPS

VINSS_LLM_PROVIDER
VINSS_LLM_FALLBACKS

GROQ_API_KEY
GROQ_MODEL

OPENAI_API_KEY
OPENAI_MODEL
OPENAI_BASE_URL

ANTHROPIC_API_KEY
ANTHROPIC_MODEL
ANTHROPIC_BASE_URL
ANTHROPIC_VERSION
ANTHROPIC_MAX_TOKENS

QWEN_API_KEY
DASHSCOPE_API_KEY
QWEN_MODEL
QWEN_BASE_URL
```

Not all of these are parsed into the central `AppConfig` object.

Some provider-specific values are read directly from:

```text
process.env
```

inside provider registry/implementations.

---

# Central Config vs Provider Env

Central `config.ts` handles:

```text
VINSS_LLM_PROVIDER
VINSS_FEE_BPS
AGENT_ENABLED
AGENT_RATE_LIMIT
```

Provider modules additionally read their own API/model/base-URL variables directly.

`VINSS_LLM_FALLBACKS` is currently read directly inside the provider registry.

This distinction matters when validating deployment configuration.

---

# Default Values Summary

Current notable defaults include:

```text
VINSS_FEE_BPS
    200

VINSS_LLM_PROVIDER
    groq

GROQ_MODEL
    openai/gpt-oss-120b

QWEN_MODEL
    qwen-plus

OPENAI_BASE_URL
    https://api.openai.com/v1

ANTHROPIC_BASE_URL
    https://api.anthropic.com/v1

ANTHROPIC_VERSION
    2023-06-01

ANTHROPIC_MAX_TOKENS
    2048
```

OpenAI currently requires an explicit:

```text
OPENAI_MODEL
```

to be considered configured.

Anthropic also requires an explicit:

```text
ANTHROPIC_MODEL
```

---

# Testing Evidence

Current Agent test suite explicitly includes tests for:

```text
deterministic fee helper arithmetic

Offer analysis behavior

counter-Offer proposal requires approval

private message proposal requires approval

deal-stage inference

absence of representative transaction tools

domain-specific skill tool lists

cross-skill execution rejection

Dispute skill limited to inspect_deal_state

normal Agent sanitizer strips private plaintext
```

---

# Testing Boundary

These tests do not by themselves prove:

```text
live Groq availability
live OpenAI availability
live Anthropic availability
live Qwen availability

provider retention policy

provider prompt confidentiality

frontend proposal rendering

wallet confirmation

Starknet execution

Dispute AutoResolve mainnet safety
```

Those require separate integration/deployment evidence.

---

# Provider Integration Testing

A strong production test plan should distinguish:

```text
provider registry unit tests

provider API smoke tests

tool-call integration

fallback behavior

sanitization tests

frontend proposal tests

wallet/transaction boundary tests
```

Do not treat a successful provider API response as proof of chain execution correctness.

---

# Privacy Regression Requirements

High-value regression cases include:

```text
roomSecret removed

channelKey removed

walletAddress removed from normal timeline

Offer amount removed from automatic normal context

paymentTerms removed

conditions removed

raw message summary replaced

dispute skill absent from public /agent skills

cross-skill tool call rejected
```

These should remain release-blocking for Agent privacy.

---

# Execution Regression Requirements

High-value regression checks include:

```text
no generic sign tool

no generic transaction tool

no generic fund tool

no generic release/refund tool

all proposal tools return requiresApproval = true

frontend does not auto-execute proposal
```

The backend test suite directly covers the first classes.

Frontend auto-execution behavior must be checked in frontend tests/code separately.

---

# Provider Failure Requirements

Operationally important checks include:

```text
one provider fails
-> next configured fallback tried

all providers fail
-> public generic error

provider error body
-> not exposed to client

provider error content
-> not printed by runVinssAgent failure log
```

---

# Mainnet Agent Checklist

Before enabling Agent on mainnet:

```text
Confirm AGENT_ENABLED intentionally true.

Confirm public skill list excludes dispute.

Confirm provider credentials stored in secret manager/environment only.

Confirm configured provider and fallback order.

Understand whether failover can send prompts to multiple providers.

Confirm Agent rate limits.

Confirm logs do not contain prompts or provider raw failures.

Run context-sanitizer regression tests.

Run cross-skill tool tests.

Confirm no transaction tools exist.

Confirm frontend requires explicit approval for proposals.

Confirm production fee code does not trust calculate_fee.

Confirm provider API/model configuration.

Confirm incident path for provider outage.

Confirm privacy disclosure copy in UI.

Confirm Dispute AutoResolve configuration separately.
```

---

# Mainnet Dispute Checklist

If dedicated Dispute/AutoResolve is enabled:

```text
Confirm party consent requirements.

Confirm attestation verification.

Confirm Rekber participant binding verification.

Confirm chain custody re-read.

Confirm verified principal calculation.

Confirm policy threshold behavior.

Confirm resolver address.

Confirm resolver private key isolation.

Confirm resolver contract authority matches deployment.

Confirm evidence is never written to generic request logs.

Confirm prompt-injection tests/policy.

Confirm manual-review fallback.

Confirm transaction execution monitoring.

Confirm resolver key rotation/revocation plan.
```

---

# Incident Boundary

If a remote Agent provider is compromised/unavailable:

```text
disable AGENT_ENABLED
```

can remove Agent and Dispute route exposure from the current app mounting behavior.

Core:

```text
/discover
/rekber/events
/activity
/health
/royalty
/presence
/attachments
/feedback
```

does not structurally depend on the normal Agent provider registry.

---

# Provider Outage Does Not Change Chain Truth

If all LLM providers fail:

```text
POST /agent
```

can fail.

That does not change:

```text
existing Message commitments
Offer commitments
Rekber custody
Settlement Certificate state
```

Agent is an assistance layer.

It is not the canonical settlement ledger.

---

# Agent Does Not Grant Privacy to Explicit Prompt Text

A common incorrect privacy statement would be:

```text
VINSS Agent never sees plaintext.
```

That is false.

Correct:

> VINSS automatically minimizes Deal Room context before normal Agent calls, but the explicit Agent prompt is plaintext sent to the selected remote provider.

---

# Agent Does Not Receive Full Decrypted History Automatically

Another incorrect statement:

```text
The Agent automatically reads your private room.
```

Current source does not support that claim.

The normal sanitizer strips detailed timeline semantics and private Offer terms.

---

# Accurate Product Language

Accurate:

> VINSS Agent receives your explicit instruction plus a server-sanitized Deal Room context. It can draft and analyze within a selected skill, but it cannot sign or execute participant blockchain transactions.

Also accurate:

> Dispute Agent is a separate opt-in workflow where both parties may explicitly disclose terms and evidence for evaluation.

---

# Inaccurate Product Language

Avoid:

```text
The Agent has access to all private messages.

The Agent can automatically settle your deal.

The Agent decides who receives escrow.

The Agent fee calculator is the protocol fee oracle.

The Agent never receives plaintext.

Agent proposals are already approved transactions.

Dispute evidence is part of normal Agent context.

Agent fallback never sends data to another provider.
```

---

# Architecture Summary

```mermaid
flowchart TD
    USER[User]
    FE[Frontend]

    SAN[Normal context sanitizer]
    ROUTE[POST /agent]
    SKILL[Public skill]
    PROVIDER[Remote provider]
    TOOLS[Scoped local tools]
    PROPOSAL[Approval-required proposal]

    WALLET[Ready / wallet]
    CHAIN[VINSS contracts]

    USER --> FE
    FE --> ROUTE
    FE --> SAN
    SAN --> ROUTE
    ROUTE --> SKILL
    SKILL --> PROVIDER
    PROVIDER <--> TOOLS
    PROVIDER --> PROPOSAL
    PROPOSAL --> FE
    FE --> WALLET
    WALLET --> CHAIN

    TOOLS -. no transaction authority .-> WALLET
```

The dotted relationship is conceptual:

```text
Agent tools do not call the wallet.
```

---

# Source-of-Truth Boundaries

For:

```text
tool list
skill list
context sanitizer
provider selection
proposal types
```

backend Agent source is authoritative.

For:

```text
fees
settlement state
custody rules
capability commitments
certificate eligibility
```

smart-contract/application source is authoritative.

For:

```text
actual provider availability
API-key presence
model selection
feature exposure
```

deployed environment is authoritative.

---

# Review Checklist

When changing the Agent subsystem, verify:

```text
Did PublicAgentSkillId change?

Did an internal skill accidentally become public?

Did normal context sanitizer start preserving private fields?

Did timeline summary handling change?

Did latestOffer sanitization change?

Did a new generic tool gain side effects?

Did any existing tool begin calling a network or wallet?

Do all proposal tools still require approval?

Did fee helper semantics change?

Did provider configuration requirements change?

Did provider fallback semantics change?

Could fallback expose prompt data to new providers?

Did tool iteration limit change?

Did provider error logging begin printing raw exceptions?

Did /agent public error behavior change?

Did AGENT_ENABLED default behavior change?

Did Agent route rate limiting change?

Did Dispute routes remain isolated from public skill selection?

Did dedicated resolver authority change?

Do tests cover the new boundary?
```

---

# Related Backend Documentation

```text
README.md
architecture.md
backend-interaction-flow.md
privacy-security.md
api-reference.md
configuration.md
testing.md
mainnet-readiness.md
known-limitations.md
```

Dispute-specific behavior should also be cross-checked against:

```text
backend/src/dispute/
backend/src/routes/dispute.ts
```

and canonical Rekber contract documentation.

---

# Bottom Line

The current VINSS Agent is:

```text
remote-model capable
skill-scoped
server-sanitized
tool-allowlisted
proposal-oriented
provider-fallback capable
non-transactional for normal participant actions
```

The normal privacy boundary is:

```text
explicit user Agent prompt
+
strictly minimized automatic context
```

The normal execution boundary is:

```text
Agent proposes
user approves
wallet executes
```

The dedicated Dispute subsystem is intentionally separate:

```text
explicit evidence disclosure
+
party consent
+
chain/binding verification
+
policy evaluation
+
optional privileged resolver execution
```

Keeping those boundaries separate is required for technically accurate VINSS documentation.
