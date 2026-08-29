# Smart Contract Testing

## Canonical CI workflow

The repository workflow:

```text
.github/workflows/contracts-test.yml
name: VINSS Contracts Test
```

is manually dispatchable and runs on Ubuntu with the repository-pinned contract toolchain.

It executes:

```text
scarb build
snforge test
```

and fails the workflow when either build or tests fail.

A green workflow proves the current Cairo package builds and its Starknet Foundry tests pass. It does not prove wallet or network E2E behavior.

## Trigger through GitHub CLI

REST dispatch is useful when `gh workflow run` GraphQL calls are unreliable:

```bash
gh api \
  --method POST \
  repos/DXJLabs/vinss/actions/workflows/contracts-test.yml/dispatches \
  -f ref=main
```

Then query recent runs:

```bash
gh api \
  'repos/DXJLabs/vinss/actions/workflows/contracts-test.yml/runs?branch=main&event=workflow_dispatch&per_page=5' \
  --jq '.workflow_runs[] | [.id, .head_sha[0:7], .status, (.conclusion // "-")] | @tsv'
```

## Test modules

```text
test_vinss_fee_policy.cairo
test_vinss_message_helper.cairo
test_vinss_invite.cairo
test_vinss_offer_helper.cairo
test_vinss_escrow_rekber.cairo
test_vinss_settlement_certificate.cairo
test_vinss_private_escrow_helper.cairo
```

## FeePolicy coverage

Current tests cover behavior including:

```text
USD floor conversion
sponsor-cost floor winning when higher
pricing-admin sponsor-cost update
unauthorized update rejection
stale oracle failure
Rekber public floor vs sponsor reserve
Rekber reserve growth when sponsor cost/STRK pricing requires it
```

## Message / Offer helpers

Tests cover:

```text
constructor configuration
Privacy-Pool-only invocation
V2 envelope validation
Poseidon commitment binding
locator uniqueness
payload-commitment uniqueness
ciphertext storage/read bounds
routing event fields
fee-bearing OpenNoteDeposit output
```

Test fixtures may use fixed mock fee values. That does not make those values immutable production fees; production helpers consult FeePolicy.

## Private Escrow helper

Tests cover encrypted coordination storage, routing tags, ciphertext retrieval, caller restriction, commitment validation, replay guards, and empty token output.

## Invite

Tests cover create/consume state, expiry, duplicate/replay rejection, caller restriction, and fee/output behavior.

## Rekber

The Rekber suite covers contract-level invariants across:

```text
funding and reserve accounting
token/fee validation
oracle-backed fee quote
supported-token restrictions
fulfillment policies
payer confirmation
revision rounds/deadlines
dispute opening
resolver authorization
exact resolution split
payer/payee resolution claims
clean release
auto-release
no-fulfillment refund
mutual refund
replay/consumption guards
allowance/accounting safety
```

## Settlement Certificate

Certificate tests cover:

```text
clean payer/payee claims
refund rejection
dispute-resolution rejection
recipient/caller binding
claim replay rejection
transfer_from rejection
safe_transfer_from rejection
```

The two transfer tests are the regression proof for the current soulbound invariant.

## Cross-layer checks

Frontend tests and privacy-boundary scripts remain separate from Cairo tests.

They are needed to catch mismatches such as:

```text
frontend commitment domain != Cairo domain
frontend action layout != Cairo calldata
state decoder != Cairo struct
Ready X output note ordering != contract expectation
legacy behavior reintroduced in UI
```

## Verification boundary

`snforge test` does not by itself prove:

```text
Ready X wallet API request shape
STRK20 proof generation
deployed Privacy Pool execution
browser encryption/decryption
backend discovery/indexing
resolver backend transaction execution
two-user E2E
Voyager source verification
mainnet deployment
```

Record those as separate evidence.
