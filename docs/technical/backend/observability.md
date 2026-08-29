# VINSS Backend Observability

This document describes the current observability model for the VINSS backend.

The backend intentionally favors:

```text
minimal operational visibility
+
privacy-safe failure classification
+
persistent indexer checkpoints
```

over:

```text
verbose request tracing
+
raw error dumping
+
prompt/body logging
```

That trade-off is deliberate.

Observability must never become a secondary plaintext datastore.

---

# Objective

VINSS observability should answer:

```text
Is the process running?

Is PostgreSQL reachable?

Are the three indexer families progressing?

Which network and contract identities are active?

Is an API path failing?

Is an external Agent provider failing?

Did the process restart?

Did graceful shutdown occur?

Is an index stale?

Is a privileged resolver transaction being attempted?
```

without requiring logs to contain:

```text
room secrets

channel keys

private Message text

Offer terms

dispute evidence

wallet private keys

resolver private key

provider API keys
```

---

# Current Observability Surfaces

The current backend exposes observability through:

```text
console logs

GET /health

persistent checkpoint rows

HTTP status codes

rate-limit response headers

selected API metadata

hosting/platform logs

public Starknet transaction/event state
```

---

# What Is Not Currently Implemented

The source currently does **not** include a built-in:

```text
Prometheus /metrics endpoint

OpenTelemetry tracing

request correlation IDs

structured JSON logger

histogram/timer middleware

central latency metrics

automatic alerting

distributed trace propagation

runtime CPU/memory metrics endpoint

provider token/cost accounting

dedicated resolver transaction journal
```

These are recommended future hardening areas, not current implementation claims.

---

# Architecture

```mermaid
flowchart TD
    CLIENT["Client"]
    API["Express API"]
    LOG["Console logs"]
    HEALTH["GET /health"]

    DISC["DiscoveryIndexer"]
    REK["RekberIndexer"]
    CERT["CertificateIndexer"]

    DB[("PostgreSQL")]
    RPC["Starknet RPC"]
    PROVIDER["LLM providers"]
    CHAIN["Starknet contracts"]

    CLIENT --> API

    API --> LOG
    API --> HEALTH

    DISC --> DB
    REK --> DB
    CERT --> DB

    DISC --> RPC
    REK --> RPC
    CERT --> RPC

    API --> DB
    API --> PROVIDER
    API --> CHAIN

    HEALTH --> DISC
    HEALTH --> REK
    HEALTH --> CERT
```

---

# Privacy-First Logging Principle

Every observable field should answer one question:

```text
Does an operator need this field to restore service safely?
```

If the answer is no:

```text
do not log it
```

especially when it can contain private Deal Room information.

---

# Current Global Request Logger

The current Express middleware logs:

```text
METHOD PATH
```

only.

Implementation:

```ts
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

---

# Request Bodies Are Intentionally Excluded

Current application source explicitly states:

```text
Request bodies are intentionally never logged.
```

This is an important privacy invariant.

---

# Example Request Logs

Possible:

```text
GET /health

POST /discover

POST /agent

POST /dispute/evaluate

GET /activity

GET /royalty/0xabc
```

---

# What Global Request Logger Does Not Include

It does not currently add:

```text
status code

response time

IP address

user agent

request body

query object

headers

wallet address

request ID
```

---

# Important Precision

The application's own logger is minimal.

Hosting infrastructure can still independently log:

```text
IP address

headers

latency

request metadata

proxy metadata
```

depending on platform configuration.

Source code cannot guarantee platform retention policy.

---

# Query String Behavior

The logger uses:

```text
req.path
```

rather than:

```text
req.originalUrl
```

Therefore ordinary query parameters are not included in the global request log line.

---

# Benefit

This reduces accidental logging of query values such as:

```text
custodyCommitment

address

pagination cursor
```

where they are present as query parameters.

---

# Path Parameter Caveat

Path parameters remain part of `req.path`.

Example:

```text
/royalty/0xabc
```

contains the address in the path.

Likewise:

```text
/attachments/<uuid>
```

contains the attachment ID.

---

# Metadata Rule

A path value may be public or opaque but still be metadata.

Do not equate:

```text
not plaintext
```

with:

```text
no privacy significance
```

---

# Current Startup Logs

Successful listen:

```text
VINSS backend listening on :<port> (<network>)
```

---

# Startup Failure Logs

Database/store initialization failure:

```text
[startup] database initialization failed
```

Top-level fatal initialization failure:

```text
[startup] fatal initialization error
```

---

# What Startup Logs Intentionally Avoid

They do not print:

```text
DATABASE_URL

RPC_URL

contract secrets

provider keys

resolver private key
```

---

# Current Shutdown Log

Graceful shutdown emits:

```text
[shutdown] SIGTERM
```

or:

```text
[shutdown] SIGINT
```

---

# Shutdown Meaning

After that log, runtime attempts to:

```text
stop DiscoveryIndexer

stop RekberIndexer

stop CertificateIndexer

close HTTP server

close PostgreSQL pool
```

---

# Shutdown Observability Limitation

There is no current explicit log for each completed shutdown stage.

A single shutdown signal line does not prove every cleanup stage completed before a hard platform termination.

---

# Database Error Logging

Unexpected idle PostgreSQL pool error logs:

```text
[database] unexpected idle client error
```

---

# Why Error Details Are Omitted

Current source explicitly avoids printing:

```text
connection details

environment values
```

---

# Database Observability Limitation

The current database pool does not expose built-in application metrics for:

```text
active connections

idle connections

waiting requests

query latency

connection acquisition latency
```

---

# Hosting-Level DB Metrics

These may still be available from:

```text
Railway

managed PostgreSQL provider

APM
```

but are external to backend source.

---

# Discovery Indexer Logs

Latest-block query failure:

```text
[indexer] latest block query failed: <ErrorName>
```

Definition sync failure:

```text
[indexer] <identity> sync failed: <ErrorName>
```

---

# Discovery Identity in Logs

Definition identity is:

```text
<network>:<kind>:<contractAddress>
```

---

# Example

```text
[indexer] mainnet:offer:0x123... sync failed: Error
```

---

# Privacy Property

Discovery sync logs do not print:

```text
ciphertext

action locator

routing tags

room secret

channel key

raw RPC error body
```

in the catch path.

---

# Error Classification

Current indexer logging usually reduces an exception to:

```text
error.name
```

---

# Benefit

This lowers risk that upstream errors echo:

```text
RPC URL credential

request payload

provider response body
```

into logs.

---

# Cost

It reduces debugging detail.

---

# Rekber Indexer Logs

Latest-block failure:

```text
[rekber-indexer] latest block query failed: <ErrorName>
```

Sync failure:

```text
[rekber-indexer] <network>:rekber:<contract> sync failed: <ErrorName>
```

---

# Certificate Indexer Logs

Latest-block failure:

```text
[certificate-indexer] latest block query failed: <ErrorName>
```

Sync failure:

```text
[certificate-indexer] <network>:certificate:<contract> sync failed: <ErrorName>
```

---

# Three Indexer Families

Observability should always distinguish:

```text
Discovery

Rekber

Certificate
```

---

# Discovery Sub-Identities

Discovery itself has three checkpoint identities:

```text
message

offer

escrow
```

---

# Why This Matters

A backend can be partially degraded.

Example:

```text
Message caught_up

Offer error

Private Escrow caught_up

Rekber caught_up

Certificate caught_up
```

---

# Avoid One Boolean Mental Model

Do not reduce backend state to:

```text
up / down
```

when diagnosing indexed data.

---

# Persistent Checkpoint Observability

The most useful current durable observability data is persisted in PostgreSQL checkpoint rows.

---

# Discovery Checkpoint Fields

Current checkpoint view includes:

```text
identity

kind

contractAddress

startBlock

nextBlock

lastIndexedBlock

latestObservedBlock

status

updatedAt
```

---

# Rekber Checkpoint Fields

Conceptually includes:

```text
identity

contractAddress

startBlock

nextBlock

lastIndexedBlock

latestObservedBlock

status

updatedAt
```

---

# Certificate Checkpoint Fields

Similarly includes:

```text
identity

contractAddress

startBlock

nextBlock

lastIndexedBlock

latestObservedBlock

status

updatedAt
```

---

# Status Values

Current indexer status model includes:

```text
idle

syncing

caught_up

error
```

---

# `GET /health`

Current health route queries:

```text
DiscoveryIndexer.getStatus()

RekberIndexer.getStatus()

CertificateIndexer.getStatus()
```

in parallel.

---

# Health Success

If no tracked checkpoint status equals:

```text
error
```

response is:

```text
HTTP 200
```

with:

```text
status = ok
```

---

# Health Degraded

If any tracked checkpoint status is:

```text
error
```

response is:

```text
HTTP 503
```

with:

```text
status = degraded
```

---

# Health Retrieval Failure

If reading status itself throws:

```text
HTTP 503
```

and all indexer fields become:

```text
null
```

in the health response.

---

# Health Response Concept

```json
{
  "status": "ok",
  "network": "mainnet",
  "indexer": {
    "message": {},
    "offer": {},
    "escrow": {}
  },
  "rekberIndexer": {},
  "certificateIndexer": {}
}
```

---

# Health Is More Than Process Liveness

Older wording:

```text
health only proves process responds and reports network
```

is incomplete.

Current health also reads persistent indexer checkpoint state.

---

# Health Is Still Not Full Readiness

It does not directly verify:

```text
actual RPC chain ID

current RPC reachability at request time

contract class hash

frontend connectivity

frontend decryption

Ready wallet

AVNU/paymaster

LLM provider availability

attachment table path

Feedback email delivery

resolver account gas/funding

two-wallet E2E
```

---

# Critical Latest-Block Failure Nuance

Each indexer first asks RPC for:

```text
latest block
```

---

# If That Query Fails

Current code:

```text
logs failure
returns from cycle
```

---

# It Does Not Immediately Do

```text
checkpoint.status = error
```

for that latest-block failure path.

---

# Consequence

A checkpoint can still show:

```text
caught_up
```

from a previous successful cycle while RPC is currently failing.

---

# Therefore

`GET /health` can temporarily remain:

```text
200
```

during a latest-block query outage.

---

# This Is the Main Current Health Blind Spot

Operators should not rely only on:

```text
status
```

---

# Also Monitor

```text
updatedAt

lastIndexedBlock

latestObservedBlock

checkpoint age

chain head

indexer logs
```

---

# Freshness Metric

A useful derived metric is:

```text
observedLag =
    latestObservedBlock
    -
    lastIndexedBlock
```

when both values exist.

---

# Freshness Caveat

`latestObservedBlock` itself can become stale if latest-block RPC queries fail.

---

# Better Operational Metric

Compare checkpoint data against an independent current Starknet head if available.

---

# Checkpoint Age

Useful:

```text
now - updatedAt
```

---

# Why Checkpoint Age Matters

A checkpoint that remains:

```text
caught_up
```

but has not updated for an unexpectedly long interval can signal:

```text
RPC outage

stuck process

indexer loop failure

DB failure
```

---

# Poll Interval Context

Default indexer poll interval:

```text
5000 ms
```

---

# Alert Threshold Rule

Do not alert at exactly one poll interval.

Allow for:

```text
RPC latency

event scan time

DB latency

deployment pauses
```

---

# Example Starting Threshold

Operational policy could alert when:

```text
checkpoint age > several expected poll cycles
```

rather than on one missed cycle.

This is a recommendation, not current source behavior.

---

# Current Route Error Logs

Several read APIs use privacy-safe generic log lines.

---

# Discovery Lookup Failure

```text
[discover] indexed lookup failed
```

Public response:

```text
500
Discovery failed.
```

---

# Rekber Lookup Failure

```text
[rekber] indexed lookup failed
```

Public response:

```text
500
Rekber lookup failed.
```

---

# Activity Lookup Failure

```text
[activity] indexed lookup failed
```

Public response:

```text
500
Activity lookup failed.
```

---

# Royalty Lookup Failure

Current Royalty log includes:

```text
[royalty] lookup failed <ErrorName>
```

---

# Route Error Principle

Read-model routes avoid logging:

```text
SQL statements

database credentials

full stack/error body
```

in their route catches.

---

# Feedback Logs

Feedback storage failure:

```text
[feedback] storage failed
```

---

# Resend Success

```text
[feedback] email notification sent
```

---

# Resend Failure

Either:

```text
[feedback] Resend notification failed
```

or:

```text
[feedback] Resend notification failed (<status>)
```

---

# Feedback Privacy Caveat

The email itself intentionally contains plaintext feedback content.

---

# Logging vs Email

Do not confuse:

```text
not logged
```

with:

```text
not transmitted
```

Feedback email can transmit:

```text
rating

outcome

role

deal type

network

comment
```

to the configured email provider.

---

# Feedback Observability Rule

Operational metrics may safely track:

```text
feedback stored count

email provider success/failure count
```

without recording the comment.

---

# Attachment Logs

Encrypted attachment upload failure:

```text
[attachments] encrypted upload failed
```

---

# Attachment Download Failure

```text
[attachments] encrypted download failed
```

---

# Attachment GET Completion Log

Current route also logs:

```text
[attachments] GET <id> -> <statusCode>
```

---

# Attachment ID Is Logged

This is a current metadata exposure.

The attachment:

```text
capability token
```

is not intentionally logged.

---

# Attachment Ciphertext Is Not Logged

Current source does not print:

```text
ciphertext bytes
```

---

# Attachment Observability Recommendation

If attachment IDs are considered correlation-sensitive, consider:

```text
hashing/redacting IDs in future logs
```

while retaining request-level diagnostics.

---

# Agent Provider Failure Log

Current Agent orchestrator catches provider failures and logs:

```text
[VINSS AGENT PROVIDER FAILED] <providerId>
```

---

# Provider IDs

Possible:

```text
groq

openai

anthropic

qwen
```

---

# Raw Provider Errors Are Intentionally Not Logged

Current source comment:

```text
Provider errors may echo request content.
Log identity only.
```

---

# This Is a Security Boundary

Do not replace it with:

```ts
console.error(error)
```

without a privacy review.

---

# Agent Route Failure

If all configured providers fail, public route returns:

```text
500
Agent failed.
```

---

# Agent Route Does Not Log Request Body

The global request logger still logs only:

```text
POST /agent
```

---

# Agent Observability Gap

Current backend does not provide built-in metrics for:

```text
Agent latency

provider attempt count

fallback count

tokens

cost

success rate

model response time
```

---

# Safe Agent Metrics

Recommended:

```text
agent_requests_total

agent_success_total

agent_failure_total

provider_attempt_total{provider}

provider_failure_total{provider}

provider_latency_ms{provider}

fallback_depth
```

---

# Avoid Agent Metric Labels Containing

```text
message text

room ID

Offer asset

payment terms

context JSON

wallet private identifiers
```

---

# Model Name Logging

Model names may be useful operational metadata.

However provider/model names should be treated as:

```text
deployment metadata
```

not user data.

---

# Dispute Logging

Current `/dispute/evaluate` catch path includes an explicit comment:

```text
Do not log evidence, signatures or resolver credentials.
```

---

# Current Dispute Catch Behavior

It returns an HTTP error but does not intentionally print:

```text
evidence

signature arrays

resolver private key
```

---

# Observability Cost

This preserves privacy but means operators have less direct server-side forensic detail.

---

# Safe Dispute Metrics

Recommended:

```text
challenge_total

challenge_failure_total

evaluate_total

evaluate_failure_total

policy_status_total

execution_status_total

resolver_tx_total
```

---

# Safe Execution Status Values

```text
authorized

already_authorized

not_enabled

not_eligible
```

---

# Dangerous Dispute Metric Labels

Never label metrics with:

```text
statement text

evidence text

wallet signature

private key

acceptedTerms

fulfillment plaintext
```

---

# Resolver Executor Observability

Current executor returns:

```text
status

optional transactionHash

optional payerAmount

optional payeeAmount
```

to the caller.

---

# No Dedicated Resolver Log

The executor source itself does not currently emit a dedicated:

```text
authorized tx <hash>
```

console log.

---

# No Dedicated Resolver Journal

There is no current PostgreSQL table that records:

```text
resolver execution attempts

resolver execution failures

policy decision IDs
```

as an operational journal.

---

# Public Chain as Resolver Audit Trail

When an authorization succeeds, the Starknet transaction and resulting Rekber state are public.

That is the authoritative external audit surface.

---

# Recommended Resolver Observability

Add privacy-safe telemetry around:

```text
execution status

transaction hash

custody commitment if approved as public metadata

network

contract address

latency
```

without:

```text
evidence

signatures

resolver key
```

---

# Resolver Key Must Never Be Telemetry

Never log:

```text
DISPUTE_RESOLVER_PRIVATE_KEY
```

including partially.

---

# Provider API Keys

Never log:

```text
GROQ_API_KEY

OPENAI_API_KEY

ANTHROPIC_API_KEY

QWEN_API_KEY

DASHSCOPE_API_KEY
```

---

# Database URL

Never log the complete:

```text
DATABASE_URL
```

because it can contain credentials.

---

# RPC URL

Treat:

```text
RPC_URL
```

as potentially sensitive because hosted providers can embed API keys in:

```text
hostname

path

query
```

---

# Current Rate-Limit Headers

The fixed-window limiter emits:

```text
RateLimit-Limit

RateLimit-Remaining

RateLimit-Reset
```

---

# When Blocked

It also emits:

```text
Retry-After
```

and returns:

```text
HTTP 429
```

---

# Rate-Limit Headers as Observability

These are useful client-visible telemetry for:

```text
/discover

/agent

/dispute

/feedback
```

where the limiter is mounted.

---

# Rate-Limit Limitations

Limiter state is:

```text
process-local
```

---

# Consequence

Metrics inferred from one replica do not automatically represent total cluster behavior.

---

# No Rate-Limit Counter Export

Current source does not expose:

```text
current bucket count

blocked requests total

active bucket count
```

as metrics.

---

# Suggested Rate-Limit Metrics

```text
requests_total{scope,status}

rate_limit_block_total{scope}

rate_limit_remaining_histogram
```

---

# Current Health vs Recommended Readiness

The current `/health` endpoint is closest to:

```text
indexer status / partial readiness
```

not pure liveness.

---

# Pure Liveness Would Ask

```text
Can the Node process answer HTTP?
```

---

# Strong Readiness Would Ask

```text
Is DB reachable?

Is RPC reachable now?

Is chain identity correct?

Are required contract views/events compatible?

Are indexes fresh enough?

Are critical optional dependencies available?
```

---

# Current `/health` Sits Between Them

It checks DB-backed checkpoint state and indexer error status.

It does not actively probe every dependency.

---

# Recommended Future Endpoint Split

Possible:

```text
/health/live

/health/ready

/health/freshness
```

---

# `/health/live`

Could verify only:

```text
process event loop / HTTP
```

---

# `/health/ready`

Could verify:

```text
DB query

RPC chain ID

contract compatibility

checkpoint freshness threshold
```

---

# `/health/freshness`

Could expose:

```text
head block

indexed block

lag

checkpoint age
```

for each index family.

---

# Privacy Rule for Health

Health should not expose:

```text
DB credentials

RPC API tokens

provider keys

resolver key
```

---

# Contract Address Exposure

Contract addresses are public and are already exposed through indexer checkpoint views.

This is acceptable.

---

# Start Block Exposure

Start blocks are public deployment metadata.

---

# Network Exposure

`network` is public deployment metadata.

---

# Current Checkpoint Status Is Persistent

Because checkpoints live in PostgreSQL, status survives:

```text
process restart
```

---

# Important Consequence

A newly restarted process can initially report historical checkpoint state before a new polling cycle refreshes it.

---

# Startup Observation

After deploy:

```text
observe multiple indexer cycles
```

not just one immediate health response.

---

# Caught-Up Meaning

`caught_up` means:

```text
nextBlock > latestObservedBlock
```

relative to the latest block observed during a successful cycle.

---

# It Does Not Mean

```text
zero real-time lag forever
```

---

# Syncing Meaning

`syncing` indicates:

```text
there is indexed work up to a previously observed head
```

---

# Error Meaning

`error` means a sync path failed after latest block was known and the indexer persisted error state.

---

# Idle Meaning

Usually initial/default checkpoint state before active sync transitions.

---

# Mainnet Monitoring Priorities

For first mainnet deployment, monitor:

```text
process restarts

startup errors

DB errors

Discovery checkpoint freshness

Rekber checkpoint freshness

Certificate checkpoint freshness

RPC latest-block failures

sync failures

HTTP 5xx

HTTP 429

Agent provider failures if enabled

resolver authorization transactions if enabled
```

---

# Discovery Recommended Metrics

These are **recommended**, not currently emitted.

```text
discovery_checkpoint_block{kind}

discovery_latest_observed_block{kind}

discovery_lag_blocks{kind}

discovery_checkpoint_age_seconds{kind}

discovery_sync_errors_total{kind}

discovery_events_scanned_total{kind}

discovery_actions_hydrated_total{kind}

discovery_chunk_getters_total{kind}

discovery_rpc_latency_ms

discovery_db_latency_ms
```

---

# Rekber Recommended Metrics

```text
rekber_checkpoint_block

rekber_latest_observed_block

rekber_lag_blocks

rekber_checkpoint_age_seconds

rekber_sync_errors_total

rekber_events_indexed_total{event}

rekber_rpc_latency_ms
```

---

# Certificate Recommended Metrics

```text
certificate_checkpoint_block

certificate_latest_observed_block

certificate_lag_blocks

certificate_checkpoint_age_seconds

certificate_sync_errors_total

certificate_events_indexed_total
```

---

# HTTP Recommended Metrics

Current global logger does not provide these automatically.

Recommended:

```text
http_requests_total{route,method,status}

http_request_duration_ms{route,method}

http_request_size_bytes{route}

http_response_size_bytes{route}
```

---

# Route Label Rule

Use normalized route labels:

```text
/royalty/:address
/attachments/:id
```

instead of raw:

```text
/royalty/0x123...
/attachments/uuid...
```

to reduce high-cardinality metadata leakage.

---

# High Cardinality Warning

Never use the following as metric labels:

```text
transactionHash

actionLocator

custodyCommitment

wallet address

attachment ID

eventId

certificate tokenId
```

unless there is a highly specific operational need.

---

# Why

Metrics backends often retain labels for long periods and are optimized for cross-query correlation.

That can become a metadata warehouse.

---

# Logs vs Metrics

Logs are useful for:

```text
individual failure events
```

Metrics are useful for:

```text
rates

latencies

trends

alerts
```

---

# Neither Should Store Private Payloads

This is the core observability rule.

---

# Recommended Structured Log Schema

Future safe structured logs could use:

```json
{
  "event": "indexer_sync_failed",
  "scope": "offer",
  "network": "mainnet",
  "errorClass": "RpcError"
}
```

---

# Exclude

```json
{
  "roomSecret": "...",
  "message": "...",
  "providerError": "... raw ..."
}
```

---

# Request Correlation IDs

Current backend does not generate them.

---

# Future Benefit

A random request ID could connect:

```text
API request

DB lookup

provider attempt

route response
```

without storing user content.

---

# Request ID Requirements

Use:

```text
random opaque ID
```

not:

```text
wallet address

action locator

room ID
```

---

# Trace Context

Current source does not implement OpenTelemetry.

---

# Future Trace Safety

If tracing is added:

```text
disable automatic body capture

disable sensitive header capture

sanitize SQL bind values

avoid provider prompt spans
```

---

# SQL Observability

Current application does not log SQL statements.

---

# Why This Is Safer

Bind parameters can include:

```text
feedback comment

attachment ID

public metadata

ciphertext arrays
```

---

# Recommended DB Metrics Instead

Prefer:

```text
query duration

query class

connection pool utilization

error count
```

without bind values.

---

# Attachment DB Metrics

Useful:

```text
attachment_put_total

attachment_get_total

attachment_get_404_total

attachment_storage_error_total

attachment_bytes_stored_total
```

---

# Do Not Label by Attachment ID

Keep identifiers out of metric dimensions.

---

# Feedback Metrics

Useful:

```text
feedback_created_total{outcome,rating}

feedback_storage_error_total

feedback_email_success_total

feedback_email_failure_total
```

---

# Rating Privacy

A rating alone is low-sensitivity product telemetry.

But combining:

```text
rating + wallet + custody + comment
```

would create more sensitive user-level profiling.

Avoid user-level labels.

---

# Royalty Metrics

Useful:

```text
royalty_lookup_total{status}

royalty_lookup_error_total
```

---

# Do Not Log Full Royalty Address by Default

Public does not mean necessary.

---

# Activity Metrics

Useful:

```text
activity_lookup_total{status}

activity_kind_total{kind}
```

---

# `rekber_resolved` Drift

If observability counts explicit Activity filters, remember the current route allowlist does not accept:

```text
rekber_resolved
```

even though unfiltered activity can contain it.

---

# OpenAPI Observability Gap

Swagger/OpenAPI does not currently enumerate every runtime route.

Therefore:

```text
OpenAPI route count
```

is not a reliable runtime availability metric.

---

# Runtime Router Is Authority

Use:

```text
actual request smoke checks
```

for critical routes.

---

# External Platform Observability

Railway or another host may provide:

```text
CPU

memory

restart count

deployment events

network errors

request logs
```

---

# Important Distinction

These metrics are:

```text
platform-provided
```

not:

```text
VINSS backend source implementation
```

---

# Documentation Rule

Do not write:

```text
VINSS emits memory/CPU metrics
```

unless a backend instrumentation library or endpoint actually does so.

---

# Correct Wording

Use:

```text
Production should monitor memory/CPU through the hosting platform.
```

---

# Runtime Resource Signals

Recommended external monitoring:

```text
RSS memory

heap memory

CPU utilization

event-loop lag

open handles

restart count

uptime

DB connection usage
```

---

# No Event-Loop Metric in Current Source

Node event-loop lag is not measured by the application today.

---

# No Uptime Endpoint

`/health` does not currently return:

```text
process.uptime()
```

---

# Deployment Version

Current backend does not expose:

```text
Git SHA
build ID
deployment ID
```

through `/health`.

---

# Operational Limitation

An operator must obtain deployment version from:

```text
hosting platform

Git metadata

release process
```

---

# Recommended Future Build Metadata

Safe:

```text
commit SHA

build timestamp

release version
```

---

# Why Useful

It allows:

```text
health response
```

to be correlated with a known release without exposing secrets.

---

# Startup Version Log

Current listen log does not include commit SHA.

---

# Recommended Future Listen Log

Example:

```text
VINSS backend listening network=mainnet version=<sha>
```

---

# Do Not Include

```text
database URL

RPC URL with token

secret values
```

---

# RPC Observability

Current logs show:

```text
latest block failure

sync failure
```

but not:

```text
RPC latency

HTTP status

provider rate-limit headers

request count
```

---

# Recommended RPC Metrics

```text
rpc_requests_total{operation}

rpc_errors_total{operation,errorClass}

rpc_latency_ms{operation}
```

---

# Avoid Raw RPC URL Label

If RPC endpoint includes credential:

```text
never label metrics with full URL
```

---

# Safe RPC Provider Label

Use a configured logical name such as:

```text
primary
```

or sanitized provider ID.

---

# Indexer Range Metrics

Useful:

```text
fromBlock

toBlock
```

for short-lived debug logs.

---

# Persistent Metrics Alternative

Use:

```text
block span count
```

rather than storing every historical range as high-cardinality labels.

---

# Ciphertext Chunk Metrics

Safe aggregate:

```text
chunk count histogram
```

Potentially sensitive:

```text
per-transaction chunk count logs
```

because payload size can correlate with behavior.

---

# Privacy Position

Aggregate histograms are generally safer than per-action detailed logs.

---

# Public Metadata Still Needs Minimization

Even if:

```text
block number

transaction hash

custody commitment
```

are public, do not persist them in multiple observability systems without need.

---

# Logging Transaction Hashes

Current generic indexer logs do not include transaction hashes.

---

# Resolver Transaction Hash

If AutoResolve monitoring is added, logging transaction hash can be justified because:

```text
privileged write auditing
```

has strong operational value.

---

# Incident Evidence Rule

For incidents, transaction hash is preferred over:

```text
copying raw dispute evidence
```

---

# Alerting

Current backend source does not send alerts.

---

# Recommended Critical Alerts

```text
backend restart loop

startup database failure

health 503

checkpoint age above threshold

lag above threshold

repeated latest-block failures

repeated sync failures

database connection failure

Agent provider failure burst

unexpected resolver authorization
```

---

# Recommended Warning Alerts

```text
high 429 rate

attachment storage errors

Feedback email failures

Royalty lookup failures

Activity DB errors

increased provider fallback frequency
```

---

# Alert Payload Rule

Alert payloads should contain:

```text
service

environment

network

route/scope

error class

timestamp

release version
```

not private bodies.

---

# SLO Candidates

Not currently implemented.

Possible future service objectives:

```text
HTTP API availability

Discovery freshness

Rekber freshness

Certificate freshness

Agent availability

resolver execution success when enabled
```

---

# Discovery Freshness SLO Example

Example only:

```text
99% of time:
Discovery checkpoint is within N blocks / M seconds of chain head
```

---

# Rekber Freshness Priority

Rekber lifecycle data may deserve stricter alerting because it feeds:

```text
settlement activity

user state display

Dispute verification context
```

---

# Certificate Freshness Priority

Certificate lag impacts:

```text
certificate activity

Royalty points
```

but does not change on-chain ownership.

---

# Agent SLO Separation

Agent outage should not page as:

```text
core settlement unavailable
```

unless the product explicitly makes Agent critical.

---

# Feature-Aware Monitoring

When:

```text
AGENT_ENABLED=false
```

do not alert because:

```text
/agent/providers = 404
```

---

# Likewise Loyalty

When:

```text
LOYALTY_ENABLED=false
```

absence of:

```text
/loyalty/*
```

is expected.

---

# AutoResolve Monitoring

When:

```text
DISPUTE_AUTO_RESOLVE_ENABLED=false
```

do not expect resolver transactions.

---

# Unexpected Resolver Tx

Any backend resolver transaction while policy/config says AutoResolve is disabled should be treated as severe incident evidence.

---

# Privacy-Safe Error Classes

Recommended future taxonomy:

```text
ValidationError

DatabaseError

RpcError

IndexerError

ProviderError

ContractCompatibilityError

ResolverError

RateLimitError
```

---

# Avoid Raw Error Message as Metric Label

Raw messages can contain:

```text
URLs

payload values

provider response text
```

---

# Current Error Name Strategy

Indexer and Royalty already demonstrate a safer pattern:

```text
Error.name
```

---

# Route Error Strings

Public route responses may contain bounded validation messages.

These are client output, not necessarily intended telemetry labels.

---

# Dispute Error Exposure Caveat

Current Dispute `publicError()` returns:

```text
error.message
```

to the client.

---

# Observability Difference

Even though the server does not log it, a client/APM/browser could capture the returned message.

---

# Future Security Review

Dispute structured public error codes would improve:

```text
diagnostics

privacy consistency

status classification
```

---

# Logging Level Model

Current code uses:

```text
console.log

console.error
```

only.

---

# No Formal Levels

There is no:

```text
debug

info

warn

error

fatal
```

logger abstraction.

---

# Consequence

Filtering/retention by severity depends on parsing log text or platform heuristics.

---

# Future Structured Logger

Potential:

```text
pino

winston

custom minimal JSON logger
```

with redaction rules.

---

# Required Redaction Rules

```text
Authorization

x-vinss-attachment-token

database URL

RPC credential

provider keys

resolver private key

request body

Agent message/context

Dispute evidence/signatures
```

---

# Log Retention

Current source does not define log retention.

---

# External Responsibility

Retention is controlled by:

```text
hosting platform

APM

log sink
```

---

# Privacy Requirement

Use the shortest retention compatible with:

```text
operational debugging

security incident response

legal requirements
```

---

# Development Logging

Do not relax privacy rules simply because environment is:

```text
Sepolia
```

Testnet payloads can still contain real user/private data during development.

---

# Debug Logging Rule

Never temporarily add:

```ts
console.log(req.body)
```

to debug a production privacy issue.

---

# Better Debug Strategy

Use:

```text
validation branch

field presence booleans

safe IDs

error classes

checkpoint state

public transaction hashes
```

---

# Example Safe Debug Event

```json
{
  "event": "discover_request_rejected",
  "reason": "forbidden_field",
  "field": "channelKeyHex"
}
```

---

# Is Field Name Safe?

Usually yes for:

```text
channelKeyHex
```

because it reveals schema misuse, not the key value.

---

# Never Include Value

Unsafe:

```json
{
  "channelKeyHex": "0x..."
}
```

---

# Discovery Privacy Monitoring

Recommended counter:

```text
discover_forbidden_field_total{field}
```

---

# Benefit

Can detect clients attempting:

```text
roomSecret

channelKey

plaintext
```

without collecting secret values.

---

# Authentication Monitoring

Core public read routes are unauthenticated.

---

# Therefore

Observability should focus on:

```text
rate

error

latency

abuse patterns
```

rather than user identity.

---

# IP Address Logging

Current app logger does not print IP.

---

# Rate Limiter Uses IP Internally

It derives identity from:

```text
req.ip
or
socket.remoteAddress
```

---

# Do Not Automatically Persist IP

Using IP for rate limiting does not require writing IP into application logs.

---

# Mainnet Proxy

On mainnet:

```text
trust proxy = 1
```

---

# Observability Implication

If rate limits behave unexpectedly, inspect:

```text
proxy topology

req.ip interpretation
```

---

# But Avoid Routine IP Logging

Only add IP diagnostics under a reviewed incident/debug policy.

---

# Status Code Logging

Global logger currently does not include response status.

---

# This Is a Current Gap

To answer:

```text
What percentage of /discover requests are 500?
```

the application currently depends on platform HTTP metrics/logs rather than its own middleware.

---

# Safe Future Middleware

Could register:

```text
route
method
status
duration
```

on response finish.

---

# Do Not Use Raw Path

Normalize parameterized routes.

---

# Latency Logging

Current source does not measure per-request latency.

---

# Recommended Metrics, Not Logs

Latency is better represented as histograms than high-volume per-request log lines.

---

# Indexer Latency

Current source does not measure:

```text
scan time

getter time

DB insert time

cycle time
```

---

# Useful Future Timers

```text
getLatestBlockNumber

getEvents page

ciphertext hydration

DB insert batch

checkpoint update
```

---

# Indexer Throughput

No current counters for:

```text
events found

actions skipped as existing

actions hydrated

chunks fetched
```

---

# Why Useful

These would help distinguish:

```text
RPC outage

empty chain period

DB bottleneck

large catch-up
```

---

# Ciphertext Privacy

A counter such as:

```text
actions_hydrated_total
```

is safe.

---

# Per-Action Details

Avoid emitting one metric series per:

```text
actionLocator
```

---

# Database Query Observability

Useful future query classes:

```text
discovery_lookup

activity_lookup

rekber_lookup

certificate_stats

attachment_read

attachment_write

feedback_insert
```

---

# Do Not Log SQL Bind Values

Especially:

```text
feedback comment

ciphertext array

capability token hash
```

---

# Error Sampling

If future logging volume grows, sample repetitive low-value errors.

---

# Never Sample Critical Resolver Incidents Away

Privileged transaction errors should remain auditable.

---

# Agent Cost Observability

Current source has no token/cost accounting.

---

# Safe Future Cost Fields

```text
provider

model

inputTokens

outputTokens

estimatedCost
```

provided the provider returns them.

---

# Do Not Store Prompt Alongside Cost by Default

That would defeat privacy minimization.

---

# Provider Fallback Metric

Useful:

```text
agent_provider_attempt_position
```

or:

```text
fallback_depth
```

---

# Why

A rising fallback count can indicate:

```text
provider outage

credential problem

rate limit
```

before all Agent calls fail.

---

# Feedback Email Metrics

Remember:

```text
emailQueued = true
```

does not prove delivery.

---

# Better Signals

If Resend response succeeds:

```text
provider accepted
```

Still not equivalent to inbox delivery.

---

# Attachment Error Interpretation

Wrong/missing capability intentionally maps to:

```text
404
```

after valid token format.

---

# Observability Rule

Do not create logs that distinguish:

```text
object exists but token wrong
```

from:

```text
object absent
```

for unauthorized callers.

---

# Current GET Log Caveat

The current final status log can show:

```text
404
```

but does not state why.

That is good for capability privacy.

---

# Database Backups Are Not Observability

Do not use backup snapshots as a routine debugging data source for private content.

---

# Incident Investigation Hierarchy

Prefer:

```text
health/checkpoints

public transaction state

safe logs

deployment metadata

provider status
```

before inspecting persistent user data.

---

# Public Starknet State as Observability

For Rekber incidents, chain state can answer:

```text
was funded?

was released?

was refunded?

was resolved?

which transaction?
```

---

# Backend Index Is Secondary

If chain and backend disagree:

```text
chain is authority
```

---

# Certificate Observability

Public chain event:

```text
SettlementCertificateIssued
```

can be compared against:

```text
CertificateIndexer checkpoint

/activity

/royalty
```

---

# Royalty Staleness

Royalty can be stale if CertificateIndexer is stale.

---

# Monitor Upstream First

If Royalty seems wrong:

```text
check certificate checkpoint
```

before treating Royalty formula as broken.

---

# Activity Staleness

Activity merges:

```text
Discovery

Rekber

Certificate
```

---

# Consequence

One stale source can create a partially stale global feed.

---

# No Activity Health Breakdown

`/activity` response does not include source freshness metadata.

---

# Future Improvement

Include optional:

```text
sourceFreshness
```

or rely on a separate freshness endpoint.

---

# Monitoring Query Cost

Do not monitor `/discover` by repeatedly requesting:

```text
fromBlock=0
toBlock=latest
```

---

# Why

That can become an expensive unpaginated DB read.

---

# Better Smoke

Use:

```text
bounded recent range
```

where possible.

---

# Health Polling Frequency

Avoid excessive health polling that itself adds DB pressure.

---

# Health Does 3 Status Reads

Conceptually:

```text
Discovery checkpoints

Rekber checkpoint

Certificate checkpoint
```

---

# Reasonable Polling

Use hosting/platform standard intervals rather than sub-second polling.

---

# Current No Cache on Health

The endpoint reads status each request.

---

# Mainnet Alert Matrix

| Signal | Severity suggestion |
|---|---|
| Resolver key exposure | Critical |
| Unexpected resolver transaction | Critical |
| Wrong network/contract identity | Critical |
| Rekber checkpoint stale/error | High |
| Discovery stale | High |
| Certificate stale | Medium/High |
| DB initialization failure | High |
| Repeated RPC latest-block failure | High |
| Agent provider failure burst | Medium if Agent optional |
| Attachment storage failure | Medium |
| Feedback email failure | Low |
| Presence reset | Low |

---

# Signal Classification

Severity should reflect:

```text
privacy

financial authority

canonical state

user impact
```

not only HTTP availability.

---

# Log Examples That Are Safe Today

```text
VINSS backend listening on :4000 (mainnet)

GET /health

[indexer] mainnet:message:0xabc sync failed: Error

[rekber-indexer] latest block query failed: RpcError

[certificate-indexer] mainnet:certificate:0xdef sync failed: Error

[VINSS AGENT PROVIDER FAILED] groq

[database] unexpected idle client error

[feedback] storage failed

[shutdown] SIGTERM
```

---

# Log Examples That Should Never Exist

```text
roomSecret=...

channelKey=...

privateKey=...

resolverPrivateKey=...

Agent prompt: <full text>

Dispute evidence: <full evidence>

Offer terms: <private terms>

DATABASE_URL=postgresql://user:password@...

RPC_URL=https://provider/<secret>

Attachment token=<capability>
```

---

# Current Logging Matrix

| Area | Current log detail |
|---|---|
| Global HTTP | method + path |
| Startup success | port + network |
| Startup DB failure | fixed category |
| Fatal startup | fixed category |
| Shutdown | signal |
| Database pool | fixed category |
| Discovery indexer | identity + error name |
| Rekber indexer | identity + error name |
| Certificate indexer | identity + error name |
| Discovery route | fixed failure category |
| Rekber route | fixed failure category |
| Activity route | fixed failure category |
| Royalty route | failure + error name |
| Agent provider | provider ID only |
| Dispute catch | intentionally no sensitive log |
| Attachment GET | attachment ID + status |
| Attachment failures | fixed category |
| Feedback | storage/email status |

---

# Current Missing Fields Matrix

| Desired signal | Built in today? |
|---|---:|
| HTTP status metrics | No |
| HTTP latency | No |
| Request ID | No |
| Trace ID | No |
| CPU | No |
| memory | No |
| event-loop lag | No |
| RPC latency | No |
| DB query latency | No |
| provider latency | No |
| LLM tokens/cost | No |
| indexer lag alert | No |
| metrics endpoint | No |
| structured logs | No |
| automated alerting | No |

---

# Current Durable Observability Matrix

| Signal | Durable? |
|---|---:|
| Console logs | Depends on platform retention |
| Discovery checkpoints | Yes, PostgreSQL |
| Rekber checkpoint | Yes, PostgreSQL |
| Certificate checkpoint | Yes, PostgreSQL |
| Public chain events | Yes, chain |
| Rate-limit buckets | No |
| Presence events | No |
| Legacy Loyalty | No |

---

# Observability and Replicas

Multiple replicas create ambiguity.

---

# Logs

Each replica has its own process logs.

---

# Rate Limits

Each replica has its own in-memory buckets.

---

# Presence

Each replica has its own in-memory map.

---

# Indexers

Each replica starts its own three indexer loops.

---

# Monitoring Requirement

If horizontally scaling, telemetry must include a:

```text
replica/instance identifier
```

to diagnose:

```text
duplicate indexer work

Presence split

rate-limit variance
```

---

# Current App Does Not Add Instance ID

Hosting platform may add one externally.

---

# Future Safe Instance Label

Use:

```text
ephemeral instance ID
```

not user information.

---

# Deployment Correlation

Important signals:

```text
deployment ID

Git SHA

start time
```

---

# Current Source Gap

Backend does not expose Git SHA.

---

# Release Process Should Record It

Incident runbook should map:

```text
deployment
↔
commit
↔
env
```

---

# Observability Data Retention Classes

## Low sensitivity

```text
service version

network

error class

route template

HTTP status

latency
```

---

# Medium sensitivity metadata

```text
contract address

block number

transaction hash

custody commitment

wallet address

attachment ID
```

---

# High sensitivity

```text
private text

keys

signatures

capability tokens

credentials

dispute evidence
```

---

# Retention Policy

Longer retention is easier to justify for:

```text
low-sensitivity aggregate metrics
```

than for:

```text
user-level metadata
```

---

# Log Access Control

Production logs should be accessible only to operators who require them.

---

# Provider Console

Likewise LLM provider dashboards can contain request metadata and should be access-controlled.

---

# Database Monitoring Access

DB metrics need not imply DB row access.

Prefer separation of:

```text
operational metrics permission

data query permission
```

where infrastructure supports it.

---

# Privacy Regression Monitoring

Useful automated checks:

```text
grep logs for forbidden env variable names

test /discover rejects key fields

test Agent sanitizer

test provider error logging format

test request logger excludes body
```

---

# Avoid Secret Scanning Against Raw User Text

A production scanner can itself retain flagged text.

Use carefully configured security tooling.

---

# Test Environment

Observability changes should be tested in:

```text
local

Sepolia

staging
```

before mainnet.

---

# Observability Test Checklist

```text
[ ] request logger emits method/path only

[ ] query strings not copied into global log

[ ] body not logged

[ ] provider failure logs provider ID only

[ ] indexer failure logs identity + error class

[ ] DB error does not print URL

[ ] attachment token not logged

[ ] dispute evidence not logged

[ ] resolver key not logged

[ ] /health returns correct checkpoint identities

[ ] 503 occurs for persisted error checkpoint

[ ] latest-block failure freshness blind spot understood
```

---

# Mainnet Dashboard Recommendation

A minimal production dashboard should show:

```text
deployment version

process uptime/restarts

HTTP 2xx/4xx/5xx rates

DB availability

RPC availability

Message checkpoint block/age

Offer checkpoint block/age

Private Escrow checkpoint block/age

Rekber checkpoint block/age

Certificate checkpoint block/age

Agent failures by provider if enabled

resolver execution status if enabled
```

---

# Discovery Dashboard

```mermaid
flowchart LR
    HEAD["Current Starknet head"]

    MSG["Message checkpoint"]
    OFF["Offer checkpoint"]
    ESC["Private Escrow checkpoint"]

    L1["Message lag"]
    L2["Offer lag"]
    L3["Escrow lag"]

    HEAD --> L1
    MSG --> L1

    HEAD --> L2
    OFF --> L2

    HEAD --> L3
    ESC --> L3
```

---

# Rekber / Certificate Dashboard

```mermaid
flowchart LR
    HEAD["Current Starknet head"]

    REK["Rekber checkpoint"]
    CERT["Certificate checkpoint"]

    RLAG["Rekber lag"]
    CLAG["Certificate lag"]

    HEAD --> RLAG
    REK --> RLAG

    HEAD --> CLAG
    CERT --> CLAG
```

---

# Alert Flow

```mermaid
flowchart TD
    SIGNAL["Telemetry signal"]

    PRIV{"Privacy / resolver risk?"}
    STALE{"Indexer stale?"}
    API{"HTTP failure?"}
    AUX{"Auxiliary only?"}

    CRIT["Critical incident"]
    HIGH["High-priority incident"]
    ROUTE["Route/service triage"]
    WARN["Warning / low severity"]

    SIGNAL --> PRIV

    PRIV -->|Yes| CRIT
    PRIV -->|No| STALE

    STALE -->|Yes| HIGH
    STALE -->|No| API

    API -->|Yes| ROUTE
    API -->|No| AUX

    AUX -->|Yes| WARN
```

---

# Health Flow

```mermaid
sequenceDiagram
    participant M as Monitor
    participant API as /health
    participant D as DiscoveryIndexer
    participant R as RekberIndexer
    participant C as CertificateIndexer
    participant DB as PostgreSQL

    M->>API: GET /health

    par Discovery status
        API->>D: getStatus()
        D->>DB: read checkpoints
        DB-->>D: message/offer/escrow status
    and Rekber status
        API->>R: getStatus()
        R->>DB: read checkpoint
        DB-->>R: Rekber status
    and Certificate status
        API->>C: getStatus()
        C->>DB: read checkpoint
        DB-->>C: Certificate status
    end

    API-->>M: 200 ok or 503 degraded
```

---

# Health Flow Limitation

The health request does not itself call:

```text
RPC getBlockNumber
```

---

# Therefore

It reports:

```text
stored checkpoint state
```

not an active chain probe.

---

# Future Active Readiness Probe

Could query:

```text
starknet_chainId

getBlockNumber

selected contract getter
```

with strict timeouts.

---

# Avoid Heavy Health Probes

Do not make every health request execute expensive chain scans.

---

# Active vs Passive Signals

Passive:

```text
checkpoint age

stored status

logs
```

Active:

```text
RPC head probe

DB SELECT 1

contract getter
```

A robust readiness model can combine both.

---

# Circuit-Breaker Monitoring

Current source has no circuit breaker.

---

# Future RPC Failure Monitoring

Track consecutive failure streaks.

---

# Future Provider Failure Monitoring

Track:

```text
provider attempt failures

fallback activation
```

without raw response content.

---

# Future DB Monitoring

Track:

```text
pool acquisition timeout

query failure count

pool saturation
```

---

# Observability and Error Responses

Client-visible error responses are another signal.

---

# But Do Not Treat Client Errors as Server Logs

Clients may:

```text
screenshot

send analytics

report to external crash tools
```

---

# Sensitive Error Message Rule

Public error messages should avoid embedding:

```text
secret values

raw provider bodies

full SQL errors
```

---

# Current Generic Routes

Discovery/Rekber/Activity/Agent use generic failure messages for internal errors.

---

# Dispute Is More Detailed

Current Dispute returns `error.message`.

That is useful for debugging but deserves continued privacy review.

---

# Client Analytics

If frontend analytics are added later, apply the same rules.

---

# Never Send to Analytics

```text
Message plaintext

Offer terms

room secret

channel key

attachment token

Dispute evidence
```

---

# Safe Frontend Analytics

Possible:

```text
screen name

action category

generic error code

network

latency bucket
```

---

# No Analytics Requirement in Backend

This document concerns backend observability only.

---

# Operational Smoke Checks

Useful:

```bash
curl -i -s \
  https://<backend-domain>/health
```

---

# Core Read Checks

```bash
curl -i -s \
  'https://<backend-domain>/rekber/events?limit=1'

curl -i -s \
  'https://<backend-domain>/activity?limit=1'
```

---

# Agent Feature-Aware Check

Only if enabled:

```bash
curl -i -s \
  https://<backend-domain>/agent/providers
```

---

# Do Not Use Agent Request as Basic Health Probe

A real Agent request:

```text
costs provider capacity

transmits explicit user prompt
```

---

# Do Not Use Dispute Evaluate as Basic Health Probe

It can trigger privileged execution when eligible and AutoResolve is enabled.

---

# Safe Discovery Negative Check

```bash
curl -i -s \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"kind":"message","channelKeyHex":"0x123"}' \
  https://<backend-domain>/discover
```

Expected:

```text
400
```

---

# What This Check Proves

It proves one important privacy validation path remains active.

---

# What It Does Not Prove

It does not prove:

```text
Message index freshness

frontend decrypt correctness

chain event presence
```

---

# Mainnet Startup Observation

Immediately after deploy:

```text
check listen log

check /health identities

check checkpoint age

observe several polling cycles

check for indexer error logs
```

---

# Mainnet Steady-State Observation

Periodically:

```text
compare head vs checkpoints

watch 5xx rate

watch 429 rate

watch DB errors

watch RPC errors
```

---

# Mainnet AutoResolve Observation

If disabled:

```text
verify no resolver tx expected
```

If enabled:

```text
alert on every resolver transaction
```

---

# AutoResolve Status Is Not Currently a Metric

It appears in Dispute API response only.

---

# Future Journal

A minimal privacy-safe journal could persist:

```text
network

custody commitment

policy status

execution status

transaction hash

createdAt
```

---

# Careful With Custody Commitment

It is public but can correlate a private product session with a public settlement.

Retention should be justified.

---

# Log Cardinality

Avoid logging one unique unbounded key per action unless needed for incident diagnosis.

---

# Example Bad Structured Label

```text
actionLocator=<unique per request>
```

in metrics.

---

# Example Better

```text
kind=offer
status=500
```

---

# Metrics Cardinality Rule

Dimensions should come from bounded enums:

```text
route

method

status class

network

kind

provider

event kind

execution status
```

---

# Timestamp

Logging platforms normally timestamp each console line externally.

Current app does not manually prepend timestamps.

---

# Documentation Precision

Do not claim application logs include:

```text
timestamp
```

unless referring to the hosting log system.

---

# Current Application Log Text

The source itself emits no explicit timestamp prefix.

---

# Status Code

Likewise global request log does not include status.

---

# Latency

Likewise no current request duration.

---

# Provider ID

Agent failure log does include provider ID.

---

# Network

Startup log includes network.

Indexer identity includes network.

Global request log does not.

---

# Commit Version

Not currently logged by application.

---

# Safe Operational Telemetry: Current vs Recommended

## Current

```text
method

path

startup network/port

shutdown signal

indexer identity

error class

provider ID on failure

attachment ID/status

Feedback email status

checkpoint state
```

---

# Recommended

```text
timestamp via platform

normalized route

status code

latency

commit SHA

instance ID

RPC latency

DB latency

lag

checkpoint age

provider latency

provider attempt count

resolver transaction status
```

---

# Never Recommended

```text
request body

decrypted content

keys

private credentials

raw provider errors

raw SQL bind values

dispute evidence
```

---

# Known Observability Limitations

```text
no metrics endpoint

no structured logs

no request IDs

no tracing

no automatic alerts

no active RPC readiness probe

no checkpoint-age threshold in health

latest-block failure may not flip health to degraded

no provider latency/cost counters

no DB pool metrics

no resolver journal

no per-route latency/status middleware
```

---

# Observability Priority Map

```mermaid
flowchart TD
    NEXT["Observability hardening"]

    P0["P0 security/correctness"]
    P1["P1 reliability"]
    P2["P2 performance"]

    NEXT --> P0
    NEXT --> P1
    NEXT --> P2

    P0 --> A["Resolver tx alerting"]
    P0 --> B["Privacy-safe structured errors"]
    P0 --> C["Deployment version visibility"]

    P1 --> D["Checkpoint age/lag alerts"]
    P1 --> E["RPC active readiness"]
    P1 --> F["DB health metrics"]
    P1 --> G["Request status/latency"]

    P2 --> H["Indexer throughput"]
    P2 --> I["Chunk getter metrics"]
    P2 --> J["Provider cost/token metrics"]
```

---

# Recommended Minimal Next Step

Without adding a large observability stack, the highest-value incremental improvements are:

```text
1. Add request ID.

2. Add normalized route + status + duration metric/log.

3. Expose commit SHA.

4. Add checkpoint lag/age monitoring externally.

5. Add active RPC chain-ID readiness check.

6. Alert on every resolver authorization when AutoResolve is enabled.
```

---

# Preserve Privacy While Adding Them

None requires:

```text
request body

Deal Room key

Message plaintext

Offer terms
```

---

# Source-of-Truth Order

For current observability behavior:

```text
1. backend/src/app.ts

2. backend/src/index.ts

3. backend/src/indexer/service.ts

4. backend/src/indexer/rekber.ts

5. backend/src/indexer/certificate.ts

6. backend/src/routes/health.ts

7. route-specific catch/log behavior

8. backend/src/agent/index.ts

9. backend/src/dispute/executor.ts

10. hosting/platform logs

11. prose documentation
```

---

# Review Checklist

When adding telemetry:

```text
Does it contain user plaintext?

Does it contain a secret?

Does it contain a high-cardinality public identifier?

Is the field actually needed?

What is its retention?

Who can access it?

Will it go to a third-party APM?

Can an upstream raw error echo prompt data?

Can a query string contain user-controlled metadata?

Does a route parameter expose an address/ID?

Can the metric be aggregated instead?
```

---

# Privacy Checklist

```text
[ ] no request body logging

[ ] no keys

[ ] no wallet private key

[ ] no resolver private key

[ ] no provider API key

[ ] no raw provider errors

[ ] no dispute evidence

[ ] no attachment token

[ ] no plaintext attachment

[ ] no Feedback comment in logs
```

---

# Indexer Checklist

```text
[ ] monitor status

[ ] monitor updatedAt

[ ] monitor lastIndexedBlock

[ ] monitor latestObservedBlock

[ ] compare against independent head

[ ] alert on repeated latest-block failures

[ ] alert on sync error

[ ] identify network/kind/contract
```

---

# API Checklist

```text
[ ] HTTP status rates

[ ] latency

[ ] 429 rate

[ ] 5xx rate

[ ] feature-aware probes

[ ] normalized route labels

[ ] no raw path identifiers in metrics
```

---

# Agent Checklist

```text
[ ] provider availability

[ ] provider failure count

[ ] fallback count

[ ] latency

[ ] cost only without prompt retention

[ ] raw error not logged
```

---

# Dispute Checklist

```text
[ ] AutoResolve state known

[ ] resolver transaction alert

[ ] execution status metric

[ ] no evidence logging

[ ] no signature logging

[ ] no key logging
```

---

# Deployment Checklist

```text
[ ] commit SHA recorded externally

[ ] network verified

[ ] contract identities verified

[ ] health identities verified

[ ] checkpoints advance

[ ] logs contain no unexpected secrets

[ ] platform request-body logging disabled/reviewed
```

---

# Accurate Current Statements

Accurate:

> VINSS logs HTTP method and path but intentionally excludes request bodies.

Accurate:

> `/health` reads persistent Discovery, Rekber, and Certificate checkpoint status and returns 503 when a tracked checkpoint is in error.

Accurate:

> Indexer sync failures log identity and error class rather than raw payload/error bodies.

Accurate:

> Agent provider failures log provider identity only because raw provider errors can echo user prompts.

Accurate:

> Current backend source does not include built-in Prometheus/OpenTelemetry metrics or request tracing.

Accurate:

> A latest-block RPC failure may temporarily leave previously stored checkpoint status unchanged, so checkpoint age and logs matter in addition to `/health`.

---

# Inaccurate Current Statements

Avoid:

```text
/health proves RPC is currently reachable.

/health verifies actual chain ID.

VINSS currently exports CPU/memory metrics.

VINSS has request latency metrics.

Every route logs status code.

Agent logs provider errors for debugging.

Dispute evidence is written to error logs.

All observability metadata is harmless because chain data is public.

A health 200 proves the index is fresh.

VINSS has distributed tracing.

VINSS exposes a Prometheus /metrics endpoint.
```

---

# Observability Success Criteria

A good production setup should allow an operator to determine:

```text
which release is running

which network is active

whether DB is healthy

whether RPC is healthy

whether each index is fresh

which route is failing

whether rate limiting is active

whether Agent provider is failing

whether privileged resolver execution occurred
```

without being able to retrieve private Deal Room content from telemetry.

---

# Final Diagram

```mermaid
flowchart TD
    OBS["VINSS Observability"]

    CUR["Current built-in"]
    FUT["Recommended future"]

    CUR --> LOGS["Minimal console logs"]
    CUR --> HEALTH["Checkpoint /health"]
    CUR --> CP["Persistent checkpoint state"]
    CUR --> RL["Rate-limit headers"]
    CUR --> CHAIN["Public chain audit"]

    FUT --> METRICS["Metrics"]
    FUT --> TRACE["Request IDs / tracing"]
    FUT --> ALERT["Alerts"]
    FUT --> READY["Active readiness"]
    FUT --> VERSION["Release metadata"]

    GUARD["Privacy guardrail"]

    LOGS --> GUARD
    HEALTH --> GUARD
    CP --> GUARD
    METRICS --> GUARD
    TRACE --> GUARD
    ALERT --> GUARD
```

---

# Bottom Line

The current VINSS backend observability model is intentionally minimal.

Its strongest built-in operational signal is:

> persistent indexer checkpoint state surfaced through `GET /health`.

Its strongest logging privacy invariant is:

> global request logging records method and path only, while request bodies remain excluded.

Its main health limitation is:

> `/health` reads stored checkpoint state rather than actively probing Starknet RPC, so latest-block failures can temporarily coexist with a non-error checkpoint status.

Its main telemetry limitation is:

> the backend does not currently implement structured logs, request IDs, latency/status metrics, Prometheus/OpenTelemetry, automated alerting, or active dependency readiness checks.

Its main Agent privacy rule is:

> log provider identity on failure, never the raw provider error that may echo private prompt content.

Its main Dispute rule is:

> do not log evidence, signatures, or resolver credentials; privileged execution should instead be audited through safe execution status and public transaction evidence.

And its main production hardening direction is:

> add low-cardinality privacy-safe metrics for HTTP status/latency, checkpoint lag/age, RPC/DB health, provider reliability, and resolver execution without turning telemetry into a user-level metadata or plaintext archive.
