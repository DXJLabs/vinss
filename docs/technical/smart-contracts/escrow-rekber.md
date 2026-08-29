# VinssEscrowRekber

## Source

```text
contracts/src/escrow_rekber/
├── commitments.cairo
├── errors.cairo
├── events.cairo
├── interfaces.cairo
├── types.cairo
└── vinss_escrow_rekber.cairo
```

## Purpose

`VinssEscrowRekber` is the public custody state machine behind VINSS Rekber.

It holds supported ERC-20 principal, charges the funding service fee, enforces fulfillment/review/revision/refund/dispute rules, and returns settlement outputs through the configured Privacy Pool.

## Constructor

Exact constructor order:

```text
privacy_pool: ContractAddress
pragma_oracle: ContractAddress
revenue_fee_policy: ContractAddress
dispute_resolver: ContractAddress
external_verifier: ContractAddress
strk_token: ContractAddress
usdc_token: ContractAddress
strk_usd_pair: felt252
usdc_usd_pair: felt252
minimum_fee_usd_micros: u128
max_oracle_age: u64
min_oracle_sources: u32
```

All fields except `external_verifier` must be non-zero. STRK and USDC addresses must differ.

The configuration is intentionally immutable after deployment.

## Supported assets

The current contract supports only:

```text
STRK -> 18 decimals
USDC -> 6 decimals
```

Any other token passed to `quote_rekber_fee` or funding is rejected.

## Verification policies

| Value | Policy | Review starts |
|---:|---|---|
| `1` | `POLICY_SUBMISSION_REVIEW` | Immediately when payee submits fulfillment |
| `2` | `POLICY_COUNTERPARTY_CONFIRM` | When payer confirms the exact submitted evidence commitment |
| `3` | `POLICY_EXTERNAL_VERIFY` | When configured external verifier confirms the exact submitted evidence commitment |

Policy `3` requires a non-zero external verifier.

## Funding fee

The contract first computes:

```text
percentage_fee = principal / 50
               = 2% of principal
```

Then:

```text
dynamic_floor_usd =
    FeePolicy.quote_fee_usd_micros(FEE_ACTION_REKBER)

effective_floor_usd =
    max(
      dynamic_floor_usd,
      minimum_fee_usd_micros
    )

minimum_fee_in_token =
    ceil(effective_floor_usd / current token USD price)

required_fee =
    max(
      percentage_fee,
      minimum_fee_in_token
    )
```

Pragma validation requires a non-zero price, supported decimals, non-future timestamp, freshness within `max_oracle_age`, enough sources, and a non-expired response.

Funding requires the wallet-provided `quoted_fee` to equal `required_fee` exactly. A changed oracle quote therefore fails atomically instead of silently charging a different amount.

The service fee is paid once at funding and is non-refundable.

## Action selectors

```text
1  DEPOSIT_ACTION
2  RELEASE_ACTION
3  REFUND_ACTION
4  SUBMIT_FULFILLMENT_ACTION
5  CONFIRM_FULFILLMENT_ACTION
6  OPEN_DISPUTE_ACTION
7  REQUEST_REVISION_ACTION
8  AUTO_RELEASE_ACTION
9  MUTUAL_REFUND_ACTION
10 CLAIM_RESOLUTION_ACTION
```

All ten participant actions enter through `privacy_invoke` and therefore require the configured Privacy Pool caller.

## Action `1` — fund custody

Exact calldata:

```text
[1,
 custody_commitment,
 release_authorization_commitment,
 payee_claim_commitment,
 refund_commitment,
 payer_confirmation_commitment,
 payer_dispute_commitment,
 payee_dispute_commitment,
 payee_refund_consent_commitment,
 fulfillment_chain_head,
 revision_chain_head,
 payer_certificate_commitment,
 payee_certificate_commitment,
 fulfillment_deadline,
 review_window,
 verification_policy,
 fulfillment_rounds,
 revision_rounds,
 token,
 principal,
 quoted_fee,
 revenue_open_note_id]
```

Key constraints:

```text
custody is unique
principal > 0
fulfillment_deadline is future and <= 180 days away
review_window is 60 seconds .. 30 days
fulfillment_rounds is 1..8
revision_rounds is 0..7
revision_rounds < fulfillment_rounds
revision_chain_head may be zero only when revision_rounds == 0
quoted_fee == live required fee
```

The contract requires enough token balance for:

```text
existing reserved principal
+ new principal
+ required fee
```

Only principal is added to `reserved_by_token`.

Funding emits `EscrowRekberCustodyFunded` and returns one fee `OpenNoteDeposit`.

## Action `4` — submit fulfillment

```text
[4,
 custody_commitment,
 fulfillment_chain_secret,
 evidence_commitment]
```

The secret must advance the one-way fulfillment chain.

On success:

```text
fulfillment_evidence_commitment = evidence_commitment
fulfillment_submitted = true
fulfillment rounds decrease
```

For policy `1`, review starts immediately. Policies `2` and `3` wait for confirmation.

## Action `5` — payer confirms fulfillment

```text
[5,
 custody_commitment,
 payer_confirmation_secret,
 evidence_commitment]
```

Valid only for policy `2`.

The supplied evidence commitment must equal the current fulfillment evidence commitment. Successful confirmation sets `fulfillment_confirmed = true` and starts the review deadline.

## External verification

Public entrypoint:

```text
confirm_external_fulfillment(
  custody_commitment,
  evidence_commitment
)
```

Only the immutable `external_verifier` may call it.

It is valid only for policy `3`, and the evidence commitment must exactly match the submitted fulfillment commitment.

This function changes fulfillment state only. It cannot move principal.

## Action `7` — request revision

```text
[7,
 custody_commitment,
 revision_chain_secret,
 reason_commitment]
```

Revision is valid only for policy `1`, before the current review deadline, with remaining revision and fulfillment rounds.

The revision secret advances a separate one-way chain. A revision clears the current confirmation and creates `revision_deadline = now + review_window`.

The payee must resubmit fulfillment before the revision deadline.

## Action `6` — open dispute

```text
[6,
 custody_commitment,
 role,
 dispute_secret,
 evidence_commitment]
```

Roles:

```text
1 = payer
2 = payee
```

Either side uses its own precommitted dispute capability.

A dispute requires prior fulfillment submission. If review has started, dispute must be opened strictly before the review deadline.

The contract stores only `dispute_evidence_commitment`, not plaintext dispute evidence.

## Resolver authorization

Public entrypoint:

```text
authorize_dispute_resolution(
  custody_commitment,
  resolution_commitment,
  payer_amount,
  payee_amount
)
```

Only the immutable `dispute_resolver` may call it.

Required invariant:

```text
payer_amount + payee_amount == custody principal
```

The resolver cannot provide arbitrary recipients and does not receive funds.

Zero allocations are marked already claimed. Non-zero shares remain in custody until the corresponding participant claims.

## Action `10` — claim dispute resolution

```text
[10,
 custody_commitment,
 role,
 party_secret,
 output_note_id]
```

Payer uses the original refund capability.

Payee uses the original payee-claim capability.

Each side can receive only its authorized amount. When all non-zero allocations have been claimed, the custody is marked consumed and `EscrowRekberCustodyResolved` is emitted.

## Action `2` — mutual clean release

```text
[2,
 custody_commitment,
 payer_release_secret,
 payee_claim_secret,
 output_note_id]
```

Requires confirmed fulfillment with no pending revision.

Both precommitted capabilities must match. Full principal is returned to the payee output note.

This path can still be used after a disagreement only before resolver authorization/partial resolution claims, because both parties explicitly consent.

## Action `8` — auto-release

```text
[8,
 custody_commitment,
 payee_claim_secret,
 output_note_id]
```

Payee protection against payer silence.

Requires:

```text
no dispute
confirmed fulfillment
no pending revision
review deadline exists
now >= review deadline
valid payee claim capability
```

Full principal is returned to the payee output note.

## Action `3` — no-fulfillment timeout refund

```text
[3,
 custody_commitment,
 payer_refund_secret,
 output_note_id]
```

Valid only when no fulfillment was submitted and the fulfillment deadline has been reached.

Full principal is returned to the payer output note.

## Action `9` — mutual refund

```text
[9,
 custody_commitment,
 payer_refund_secret,
 payee_refund_consent_secret,
 output_note_id]
```

This is the safe full-refund path after fulfillment because both sides explicitly consent.

It is blocked once resolver authorization or a partial dispute payout has begun.

## Custody state

The public `EscrowRekberCustody` record includes:

```text
custody commitment

release/payee/refund capabilities
payer confirmation capability
payer/payee dispute capabilities
payee refund-consent capability
fulfillment/revision chain heads
payer/payee certificate commitments

token
principal amount
fee amount

fulfillment deadline
review window/deadline
revision deadline

verification policy
fulfillment rounds remaining
revision rounds remaining

fulfillment evidence commitment
dispute evidence commitment

resolution commitment
resolution payer amount
resolution payee amount

fulfillment submitted/confirmed
revision pending
disputed
resolution authorized
resolution payer/payee claimed

consumed
refunded

created_at
fulfilled_at
settled_at
```

## Accounting and ERC-20 safety

The contract uses `ReentrancyGuardComponent`.

`reserved_by_token` tracks principal owed to users.

Before exposing any settlement allowance, the contract:

```text
checks reserve >= output
checks contract balance >= reserved
decrements reserve
requires existing Privacy Pool allowance == 0
approves exactly the output amount
checks resulting allowance == output amount
```

This prevents stale allowance from silently surviving an earlier action.

## Events

The current lifecycle emits:

```text
EscrowRekberCustodyFunded
EscrowRekberFulfillmentSubmitted
EscrowRekberFulfillmentConfirmed
EscrowRekberRevisionRequested
EscrowRekberDisputeOpened
EscrowRekberDisputeResolutionAuthorized
EscrowRekberResolutionClaimed
EscrowRekberCustodyReleased
EscrowRekberCustodyRefunded
EscrowRekberCustodyResolved
```

See [Envelopes, Commitments & Events](./envelopes-events.md) for field-level summaries.

## Application workflow fee boundary

Some frontend Rekber actions are bundled with an additional VINSS STRK charge before the contract invoke.

That charge is not checked by `VinssEscrowRekber`. The contract-level economic invariant is the funding service fee described above.

Do not confuse a frontend product price with an immutable Cairo settlement rule.
