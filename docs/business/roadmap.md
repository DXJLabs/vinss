# VINSS Roadmap

> **VINSS should advance when evidence removes the next largest product, technical, market, or economic risk — not simply when another feature can be added.**

**Status:** Business and product execution roadmap baseline  
**Scope:** VINSS  
**Evidence date:** 2026-08-29  
**Purpose:** Define the sequence from current implementation through production hardening, settlement-model maturity, customer validation, repeatable go-to-market, loyalty, partner distribution, and any future VINSS token phase.

---

## 1. Roadmap Thesis

VINSS already contains substantial product and protocol functionality.

The roadmap should therefore not be:

```text
build more features
        ↓
build more features
        ↓
launch token
        ↓
hope users arrive
```

It should be:

```text
establish current evidence
        ↓
remove production risk
        ↓
close important settlement-model gaps
        ↓
run real deals
        ↓
measure willingness to pay
        ↓
find a beachhead
        ↓
prove retention and contribution economics
        ↓
strengthen loyalty / reputation
        ↓
expand distribution
        ↓
consider token and ecosystem layers only when justified
```

The core principle is:

> **The next roadmap item should address the highest unresolved risk to successful repeated paid deals.**

---

## 2. Evidence Before Roadmap Status

VINSS should preserve separate engineering evidence labels:

```text
Implemented in source

Source / logic tested

Cross-layer regression tested

Browser E2E tested

Sepolia on-chain verified

Mainnet deployed

Mainnet source verified

Mainnet product E2E verified
```

These are not interchangeable.

For example:

```text
contract function exists
≠
wallet flow works

wallet flow works on Sepolia
≠
mainnet production proof

mainnet contract is deployed
≠
complete two-party mainnet deal is verified
```

Roadmap completion must therefore be evidence-based.

---

## 3. Current Product Baseline

As of the current audited `main` source, VINSS already includes a substantial direct-deal workflow.

Current frontend responsibilities include:

```text
room access;
Invite flows;
direct private messaging;
Group messaging;
direct attachments;
structured Offer lifecycle;
private Rekber coordination;
Rekber custody interactions;
Fulfillment / review / revision / dispute flows;
Settlement Certificate claim;
FeePolicy quoting;
encrypted recovery / local state;
optional Agent workflows.
```

A representative direct flow is currently:

```text
Create / join room
        ↓
private Message
        ↓
structured Offer
        ↓
Counter / Accept / Reject
        ↓
Accepted Offer snapshot
        ↓
private Rekber coordination
        ↓
public Rekber funding
        ↓
Fulfillment / confirmation / revision / dispute
        ↓
Release / Refund / Resolution claim
        ↓
optional Settlement Certificate
```

This is an implementation baseline.

It does not mean every path has equal production evidence.

---

## 4. Current Contract Baseline

Current smart-contract documentation identifies:

```text
VinssFeePolicy
VinssInvite
VinssMessageHelper
VinssOfferHelper
VinssPrivateEscrowHelper
VinssEscrowRekber
VinssSettlementCertificate
```

Current `VinssEscrowRekber` source is responsible for:

```text
STRK / USDC custody;
Fulfillment;
Review;
Revision;
Refund;
Dispute;
Resolution;
Settlement.
```

The current contract architecture also includes concepts for:

```text
dedicated dispute resolver;
optional objective verifier;
state-dependent settlement paths;
split dispute resolution;
Settlement Certificate eligibility.
```

This means the roadmap should not describe Fulfillment or dispute as concepts that have not begun implementation.

The remaining question is:

> **Does the current implementation fully satisfy the final product rules across real wallet, privacy, frontend, backend, and mainnet behavior?**

That requires separate evidence.

---

## 5. Current Economic Baseline

VINSS currently plans around transaction-based revenue.

Public pricing baseline:

| Action | Public baseline |
| --- | ---: |
| Private Room activation | $0.25 |
| Message | $0.15 |
| Fulfillment | $0.15 |
| Review / Approve | $0.15 |
| Offer / Counter / Accept | $0.25 |
| Rekber | max($0.75, 2% of deal value) |
| Release | Included |
| Claim payment | Included |
| Settlement SBT | Free from VINSS; claimant pays gas |

The production economics must remain protected by:

```text
dynamic cost floor
```

because blockchain, privacy, STRK, and sponsorship costs can change.

The current business-planning variable-cost assumption is approximately:

```text
5 STRK per relevant sponsored action
```

but this must eventually be replaced by measured production data.

---

# ROADMAP PHASE 0

## 6. Phase 0 — Establish the Production Truth

**Objective:**

> Know exactly what is implemented, what is tested, what is deployed, and what is actually proven in a real two-party production flow.

This phase prevents documentation and product strategy from outrunning reality.

### Work

```text
audit current frontend source;
audit current Cairo source;
audit backend/indexer;
audit production configuration;
audit current contract addresses;
audit FeePolicy configuration;
audit wallet / STRK20 request paths;
audit certificate configuration;
audit privacy boundaries.
```

### Output

Maintain a capability matrix:

| Capability | Source | Tests | Sepolia | Mainnet deployment | Mainnet E2E |
| --- | --- | --- | --- | --- | --- |
| Invite | status | status | status | status | status |
| Message | status | status | status | status | status |
| Offer | status | status | status | status | status |
| Rekber Fund | status | status | status | status | status |
| Fulfillment | status | status | status | status | status |
| Review / Revision | status | status | status | status | status |
| Refund | status | status | status | status | status |
| Dispute | status | status | status | status | status |
| Resolution | status | status | status | status | status |
| Release / Claim | status | status | status | status | status |
| Settlement Certificate | status | status | status | status | status |

### Exit criteria

VINSS can answer, without ambiguity:

```text
What works in source?

What has automated tests?

What has real-wallet evidence?

What is deployed?

What has completed mainnet E2E?
```

---

## 7. Why Phase 0 Matters

A privacy and settlement application carries economic risk.

The product cannot rely on phrases such as:

```text
basically ready;
should work;
contract exists;
test passed.
```

A product-level claim requires product-level evidence.

This phase is especially important for:

```text
wallet interruptions;
STRK20 proving;
fee quoting;
paymaster behavior;
indexer synchronization;
two-wallet state;
refund;
dispute;
claims.
```

---

# ROADMAP PHASE 1

## 8. Phase 1 — Mainnet Reliability and Safety

**Objective:**

> Make the current supported direct-deal lifecycle reliable enough for real low-risk customer transactions.

Priority is reliability, not feature expansion.

### Technical priorities

```text
mainnet configuration hardening;
remove unintended Sepolia fallbacks from production behavior;
verify canonical addresses;
FeePolicy quote correctness;
measure real transaction cost;
wallet interruption recovery;
STRK20 proof reliability;
indexer reconciliation;
transaction pending / failed / confirmed state;
duplicate-action protection;
certificate claim reliability;
monitoring and operational alerts.
```

### Privacy priorities

Review:

```text
room / Group access material storage;
decrypted-data logging;
browser persistence;
Agent disclosure boundaries;
Dispute disclosure boundaries;
attachment handling;
recovery flows.
```

Privacy documentation must match current implementation.

### Exit criteria

A real two-party mainnet deal can repeatedly complete:

```text
Invite
→ Message
→ Offer
→ Accept
→ Rekber
→ Fulfillment
→ Review
→ Release / Claim
→ eligible Certificate
```

without manual database intervention or hidden developer repair.

---

## 9. Production Cost Measurement

Before scaling usage, VINSS should measure actual cost per action.

Record:

```text
action type;
STRK price;
privacy / pool cost;
sponsorship / paymaster cost;
Starknet execution cost;
failed transaction cost;
retries;
total operator cost.
```

Then compare:

```text
effective fee
vs
actual variable cost.
```

This validates or rejects the working:

```text
5 STRK / relevant sponsored action
```

assumption.

### Exit criteria

VINSS can produce a measured table such as:

```text
Message
Offer
Fulfillment
Review
Rekber funding
Refund
Dispute
Release
Claim
```

with actual mean / median cost.

---

## 10. Dynamic Pricing Production Validation

Current pricing logic should be validated against real cost movement.

Required behavior:

```text
public USD baseline
        ↓
current cost input
        ↓
dynamic floor
        ↓
final quote
        ↓
user sees charge before action
        ↓
contract / action validates quote
```

Test:

```text
STRK price changes;
stale quote;
oracle failure;
fee spike;
sponsor-cost spike;
quote mismatch;
user rejection.
```

### Exit criteria

VINSS does not silently execute economically negative sponsored actions under expected production conditions.

---

# ROADMAP PHASE 2

## 11. Phase 2 — Finalize the Universal Settlement Model

**Objective:**

> Align the implemented Rekber engine with the final product semantics across every supported Deal Type.

The product baseline requires three universal economic roles:

```text
Funder
Fulfiller
Beneficiary
```

The critical rule remains:

> **Offer creator must not automatically determine who funds settlement.**

### Work

Audit the current implementation against:

```text
agreement-derived roles;
settlement asset;
settlement amount;
Fulfillment obligation;
Fulfillment deadline;
Verification Policy;
review window;
refund rules;
dispute entry;
resolution;
Certificate eligibility.
```

Where current contract terminology remains:

```text
payer / payee
```

determine whether it can correctly represent:

```text
Funder / Fulfiller / Beneficiary
```

for all intended Deal Types.

Do not change contract architecture merely for naming.

Change it only where the economic model cannot be represented safely.

---

## 12. Accepted Offer → Settlement Snapshot

The Accepted Offer should produce a canonical settlement snapshot conceptually containing:

```text
dealType

settlementAsset
settlementAmount

funder
fulfiller
beneficiary

fulfillmentType
fulfillmentDeadline

verificationPolicy
reviewWindow

completionCriteria
```

Private commercial terms do not all need to become public.

Use:

```text
encrypted coordination;
commitments;
minimal public state.
```

### Exit criteria

Every supported Rekber can answer before funding:

```text
Who funds?

Who must fulfill?

Who receives?

What must happen?

By when?

How is it verified?

What happens after valid Fulfillment?
```

---

## 13. Universal Fulfillment

Internal settlement logic should use:

```text
FULFILLMENT
```

rather than treating freelance-style:

```text
Submit Work
```

as the universal concept.

Deal-Type UI can translate it.

Examples:

| Deal Type | User-facing Fulfillment |
| --- | --- |
| Freelance | Submit Work |
| Physical Goods | Ship / Deliver |
| Digital Goods | Deliver Item |
| Bounty | Submit Result |
| NFT Deal | Transfer NFT |
| Token Trade | Confirm Transfer / Payment |
| Custom | Submit Completion |

### Exit criteria

The state machine is not structurally biased toward freelance.

---

## 14. Verification Policy

Each Deal Type should map to a verification policy.

### Objective

```text
ONCHAIN_VERIFY
```

Examples:

```text
NFT ownership;
on-chain token transfer;
deterministic contract state.
```

### Digital + review

```text
DELIVERY_PROOF
+
PARTY_REVIEW
```

Examples:

```text
freelance;
digital goods;
bounty.
```

### Off-chain / physical

```text
DELIVERY_CONFIRMATION
or
COUNTERPARTY_CONFIRMATION
or
AGREED_CUSTOM_POLICY
```

Examples:

```text
physical goods;
fiat settlement;
custom real-world deals.
```

### Exit criteria

The settlement engine does not apply one blind success rule to every Deal Type.

---

## 15. Refund Rules

The desired universal rule is:

```text
FUNDED
        ↓
no valid Fulfillment by deadline
        ↓
Funder recovery
```

After valid Fulfillment enters verification:

```text
unilateral full refund
```

should not remain the default path.

Instead:

```text
Approve
→ Release

Disagree
→ Dispute

Mutual cancellation
→ Agreed refund / split

Objective success
→ deterministic settlement
```

### Exit criteria

Both sides receive meaningful protection.

---

## 16. Dispute Model

The current system already includes dispute and resolution concepts.

The roadmap is to make the **product-level dispute system** mature.

Required work:

```text
clear dispute entry condition;
structured dispute packet;
evidence commitments;
relevant message selection;
Accepted Offer snapshot;
Fulfillment evidence;
review / rejection history;
timestamps;
authorized resolver path;
full release;
full refund;
partial split;
mutual cancellation where appropriate.
```

Agent role:

```text
chronology;
term comparison;
evidence analysis;
inconsistency detection;
recommendation.
```

Agent must not become an unconstrained unilateral fund-moving authority.

### Exit criteria

Dispute behavior is explainable, testable, auditable, and economically sustainable.

---

## 17. Objective Verification

For Deal Types with deterministic facts:

```text
objective verifier
```

can reduce human discretion.

Example NFT:

```text
expected contract = X
expected tokenId = 482
expected recipient = Alice

chain owner = Alice
        ↓
objective Fulfillment success
```

### Exit criteria

When objective evidence was explicitly agreed in advance, silence or strategic denial cannot indefinitely block settlement.

---

# ROADMAP PHASE 3

## 18. Phase 3 — Customer and Business Validation

**Objective:**

> Prove that real independent users choose VINSS for real deals and will pay enough to support the product.

Do not scale acquisition yet.

### Initial validation target

Run:

```text
10–25 real eligible deals
```

with independent counterparties.

Prioritize digitally native bilateral deals:

```text
crypto-native freelance;
digital goods;
selected bounty;
crypto-native vendor work.
```

This is a learning target.

It is not PMF.

---

## 19. Customer Evidence Required

For each real deal record:

```text
segment;
where counterparties met;
current alternative;
deal value;
Deal Type;
reason VINSS was chosen;
fees quoted;
fees paid;
Fulfillment behavior;
settlement outcome;
refund / dispute;
user confusion;
whether either party would use VINSS again.
```

Post-deal interviews should happen separately with each participant where possible.

---

## 20. Pricing Validation

Test actual willingness to pay for:

```text
Room activation;
Message;
Offer;
Fulfillment;
Review;
Rekber.
```

Important questions:

```text
Are paid Messages accepted?

Is 2% Rekber tolerated?

Does tolerance change at $50 / $100 / $500 / $5,000 deal size?

Does the dynamic floor create surprise?

Which actions feel worth paying for?

Which actions feel like unnecessary micro-fees?
```

Do not optimize pricing solely from internal cost.

Price must survive both:

```text
unit economics
and
customer willingness to pay.
```

---

## 21. Validate the Revenue Mix

The current simulation assumes Messages are a major revenue contributor.

Real usage may show:

```text
users minimize Messages;
users negotiate elsewhere;
users only bring final Offer into VINSS;
Rekber dominates revenue;
different segments use different mixes.
```

The roadmap should allow revenue design to change.

### Exit criteria

VINSS has real production data for:

```text
ARPA / revenue per active user;
revenue per completed deal;
GMV;
variable cost;
contribution margin;
refund cost;
dispute cost.
```

---

## 22. Beachhead Discovery

Compare candidate segments using:

```text
pain;
frequency;
deal value;
trust gap;
privacy need;
verification fit;
wallet readiness;
willingness to pay;
reachability;
retention;
support burden.
```

A beachhead should not be chosen because:

```text
the workflow is elegant
```

or:

```text
the TAM headline is large.
```

### Exit criteria

One coherent segment demonstrates stronger:

```text
paid usage;
repeat usage;
referral;
unit economics;
acquisition repeatability.
```

---

# ROADMAP PHASE 4

## 23. Phase 4 — Repeatable GTM

**Objective:**

> Move from founder-led individual deals to a repeatable acquisition loop inside the validated beachhead.

The target loop:

```text
user has real deal
        ↓
VINSS acquires / is referred
        ↓
counterparty joins
        ↓
deal settles
        ↓
participant reuses VINSS
        ↓
participant invites next counterparty
```

### Channels to test

```text
community partnerships;
segment-specific content;
referrals;
founder outbound;
ecosystem partners;
wallet referrals;
marketplace / platform relationships.
```

### Exit criteria

A meaningful percentage of new paid deals come from repeatable channels rather than direct founder intervention.

---

## 24. Referral Loop

Invite is naturally part of the product.

Measure:

```text
Invite created
        ↓
counterparty joins
        ↓
first meaningful action
        ↓
first completed Rekber
        ↓
invited participant later creates new room
```

The strongest referral event is:

> **A previously invited participant becomes the initiator of another real deal.**

---

## 25. Case Studies and Trust

Build proof using:

```text
successful mainnet deals;
repeat users;
customer stories;
privacy architecture;
open-source contracts;
verified addresses;
clear fees;
clear current-vs-target claims;
security work.
```

Case studies must preserve user privacy and consent.

### Exit criteria

VINSS has customer-facing evidence that explains:

```text
why users chose it;
what happened;
why they returned.
```

---

# ROADMAP PHASE 5

## 26. Phase 5 — Loyalty and Reputation

**Objective:**

> Improve retention and reward genuine successful deal behavior without corrupting product metrics.

VINSS loyalty has three separate layers:

```text
Points
Referral
Settlement SBT Multiplier
```

Points remain:

```text
loyalty accounting
```

not:

```text
token;
cash;
revenue.
```

---

## 27. Loyalty Points Baseline

Planning baseline:

| Activity | Points |
| --- | ---: |
| Referral joins through Invite | +25 inviter |
| Referral first meaningful activity | +25 inviter |
| Referral first completed Rekber | +100 inviter |
| Message | +1, capped |
| Create Offer | +5 |
| Counter | +5 |
| Accept | +10 |
| Fulfillment | +10 |
| Review / Approve / Revision | +10 |
| Successful Rekber | +100 base |
| Refund | 0 |
| Claim Settlement SBT | 0 |

The exact point schedule should remain configurable.

---

## 28. Settlement SBT Multiplier

Planning tiers:

| Successful SBT count | Rekber reward multiplier |
| --- | ---: |
| 0 | 1.00× |
| 1–2 | 1.10× |
| 3–5 | 1.20× |
| 6–10 | 1.35× |
| 11–25 | 1.50× |
| 26–50 | 1.75× |
| 51+ | 2.00× |

Multiplier applies only to future successful Rekber rewards.

It should not multiply:

```text
Message;
Referral;
Offer;
Fulfillment;
Review.
```

It must not retroactively inflate old points.

---

## 29. Loyalty Anti-Farming

Loyalty productionization requires:

```text
event-verifiable rewards;
idempotent unique reward keys;
points ledger;
chain-derived certificate count;
daily Message caps;
anti-self-dealing rules;
organic / campaign cohort separation.
```

Examples:

```text
message: actionLocator
offer: actionLocator
fulfillment: actionLocator
rekber_complete: custodyCommitment + wallet
certificate: tokenId + wallet
referral: inviteId + invitedWallet
```

### Exit criteria

Refreshing, resyncing, replaying, or farming cannot trivially duplicate rewards.

---

## 30. Loyalty Should Follow Product Retention Evidence

Do not use Points to hide weak retention.

First ask:

```text
Would the user return without rewards?
```

Then ask:

```text
Can loyalty strengthen an already useful workflow?
```

If all repeat behavior disappears when rewards stop, VINSS has an incentive problem rather than a product moat.

---

# ROADMAP PHASE 6

## 31. Phase 6 — Partner and Infrastructure Expansion

**Objective:**

> Extend a proven Deal Room workflow through environments where users already transact.

Potential partners:

```text
wallets;
marketplaces;
crypto teams;
bounty platforms;
digital-goods platforms;
communities;
payment applications.
```

Partner value proposition:

> **Add private deal negotiation, structured agreement, Rekber, Fulfillment state, verification, and evidence without building the full lifecycle independently.**

---

## 32. Build Integration Surface From Real Partner Needs

Do not build a large speculative API platform.

Sequence:

```text
partner conversation
        ↓
specific integration requirement
        ↓
one working integration
        ↓
identify repeated primitives
        ↓
SDK / API stabilization
        ↓
repeat partner sales.
```

Possible future primitives:

```text
Create Deal Room;
Invite;
Offer lifecycle;
Rekber quote;
settlement status;
Certificate verification;
partner webhook / index feed.
```

---

## 33. Wallet Integration

Wallet distribution can reduce transaction friction.

Prerequisites:

```text
stable mainnet flow;
correct transaction prompts;
clear fee display;
privacy disclosure;
wallet interruption recovery;
verified official addresses.
```

Partner integration should follow reliability.

It should not be used to compensate for a broken direct product.

---

# ROADMAP PHASE 7

## 34. Phase 7 — VINSS Token Decision

**Objective:**

> Decide whether a VINSS token improves an already functioning product economy.

Token launch is **not** required for VINSS to operate.

Before token production work, require evidence for:

```text
real users;
repeat settlements;
stable loyalty ledger;
anti-farming system;
product utility;
sustainable fees;
legal / compliance review;
distribution rationale.
```

If those conditions are weak:

```text
delay token.
```

---

## 35. Future Token Planning Baseline

Current planning concept:

```text
fixed supply
```

Example:

```text
1,000,000,000 VINSS
```

Potential allocation:

| Allocation | Share |
| --- | ---: |
| Community / User Rewards | 50% |
| Presale / Public Distribution | 30% |
| Team | 10% |
| Strategic Investor / VINSS Treasury | 10% |

If there is no investor:

```text
10% → VINSS Treasury
```

rather than automatically increasing public distribution.

This remains future design.

---

## 36. Points → VINSS

Do not convert Points in real time.

Target mechanism:

```text
verified product activity
        ↓
Points
        ↓
SBT multiplier
        ↓
Season
        ↓
snapshot
        ↓
anti-farming review
        ↓
proportional VINSS allocation
```

Never promise:

```text
1 Point = fixed VINSS amount.
```

A Season determines allocation from a defined pool.

---

## 37. Token Utility Requirement

A future VINSS token must do more than distribute rewards.

Potential utility:

```text
fee discounts;
Rekber benefits;
premium feature access;
higher limits;
priority access;
locking / staking benefits;
product governance where genuinely useful.
```

Discounts must not destroy the core fee economics.

---

## 38. VINSS → DXJ Boundary

Any future VINSS → DXJ conversion must remain:

```text
optional;
epoch-based;
hard-capped;
variable ratio;
limited DXJ pool;
never unlimited redemption.
```

Concept:

```text
VINSS submitted
        ↓
share of capped DXJ epoch pool
        ↓
successful VINSS conversion
        ↓
VINSS burned
```

Never promise:

```text
1 VINSS = X DXJ forever.
```

### Exit criteria before implementation

```text
DXJ pool policy;
epoch policy;
legal review;
burn semantics;
treasury impact;
user communication;
economic stress test.
```

---

# ROADMAP PHASE 8

## 39. Phase 8 — Broader Market Expansion

Only after a beachhead is credible should VINSS systematically expand to more difficult Deal Types.

Possible progression:

```text
digital bilateral deals
        ↓
objective on-chain deals
        ↓
hybrid / OTC
        ↓
physical / off-chain transactions
        ↓
organization / partner workflows.
```

Expansion order should follow evidence.

It can change.

---

## 40. Physical Goods Expansion Requirements

Before aggressively serving physical goods:

```text
delivery evidence;
inspection windows;
courier / external integrations;
false tracking behavior;
condition disputes;
refund timing;
support burden
```

must be understood.

A physical-goods product cannot rely only on:

```text
seller clicked Shipped.
```

---

## 41. Fiat / Hybrid Trade Expansion Requirements

Before scaling crypto ↔ fiat:

```text
payment confirmation model;
evidence rules;
receipt disputes;
fraud patterns;
regional payment rails;
resolver process;
legal constraints.
```

must be defined.

Screenshot alone should not become deterministic truth.

---

# CROSS-CUTTING WORK

## 42. Security Roadmap

Security is continuous.

Priorities include:

```text
contract audit / review;
invariant testing;
fuzz / property testing;
wallet compatibility;
secret handling;
frontend privacy review;
backend authorization;
dispute resolver security;
oracle / FeePolicy failure modes;
operational incident plan.
```

Any system that can move settlement principal requires stronger evidence than an ordinary social application.

---

## 43. Privacy Roadmap

Continuously ask:

```text
What must remain private?

What must be public for enforcement?

What metadata leaks?

Who can decrypt?

What does the backend learn?

What does the Agent learn?

What does the resolver learn?
```

Target rule:

> **Private evidence should not be made public merely to simplify settlement design.**

Use minimal public:

```text
commitments;
timestamps;
state;
objective references;
authorized resolution.
```

---

## 44. Agent Roadmap

Agent should evolve as assistance, not authority.

Normal Agent:

```text
privacy-reduced context;
user-directed help;
Offer / workflow proposals.
```

Dispute Agent:

```text
explicit disclosure;
chronology;
agreement analysis;
evidence comparison;
recommendation.
```

Do not automatically grant Agent:

```text
unilateral custody control;
unlimited resolver authority.
```

---

## 45. Infrastructure Roadmap

Scale infrastructure from measured demand.

Near-term:

```text
reliable indexer;
database durability;
RPC fallback;
monitoring;
error visibility;
backup / recovery;
cost measurement.
```

Later:

```text
higher availability;
partner APIs;
analytics;
operational dashboards;
regional considerations.
```

Do not prematurely build enterprise infrastructure before usage requires it.

---

## 46. Documentation Roadmap

Documentation should remain separated by domain.

```text
docs/product/
docs/business/
docs/technical/
```

Product documents answer:

```text
what;
why;
for whom;
experience.
```

Business documents answer:

```text
who pays;
market;
positioning;
competition;
GTM;
roadmap.
```

Technical documents answer:

```text
how it actually works;
boundaries;
contracts;
frontend;
backend;
testing.
```

Never use business documentation to override current source truth.

---

## 47. Business Documentation Sequence

Current business documentation sequence:

```text
business-model.md
positioning.md
market.md
competitive-landscape.md
go-to-market.md
roadmap.md
README.md
```

After `roadmap.md`, create:

```text
docs/business/README.md
```

as the navigation and high-level business-strategy summary.

---

# DECISION GATES

## 48. Gate A — Production Gate

Do not scale customer acquisition until:

```text
supported mainnet flow is repeatable;
fees are understandable;
monitoring exists;
failure recovery exists;
privacy claims are accurate.
```

---

## 49. Gate B — Business Gate

Do not call the business model validated until:

```text
real users pay;
actual variable cost is measured;
contribution is positive or intentionally subsidized;
pricing resistance is known.
```

---

## 50. Gate C — Beachhead Gate

Do not declare a target market validated until:

```text
one coherent segment;
same repeated pain;
repeat paid usage;
organic referral;
repeatable acquisition channel.
```

---

## 51. Gate D — Loyalty Gate

Do not aggressively reward activity until:

```text
base product retention is measurable;
reward ledger is idempotent;
anti-farming exists;
SBT eligibility is reliable.
```

---

## 52. Gate E — Token Gate

Do not launch VINSS token merely because:

```text
the product is on mainnet;
Points exist;
community asks;
market conditions are good.
```

Require:

```text
real product usage;
loyalty evidence;
utility;
anti-farming;
tokenomics stress test;
legal / compliance review;
operational readiness.
```

---

## 53. Gate F — Partner Scale Gate

Do not promise enterprise-grade integrations until:

```text
end-user value is proven;
API surface is stable enough;
support capacity exists;
security evidence supports partner review.
```

---

# PRIORITY MODEL

## 54. How to Choose the Next Task

Score a candidate roadmap item by:

```text
risk reduced;
customer evidence gained;
revenue impact;
safety impact;
learning speed;
implementation cost.
```

A useful task tends to:

```text
remove a major blocker
or
create meaningful evidence.
```

A less useful task often:

```text
adds visual complexity;
serves a hypothetical future segment;
creates token mechanics before users;
builds infrastructure no customer requested.
```

---

## 55. What Should Usually Win Priority

Higher priority:

```text
broken mainnet settlement;
incorrect role assignment;
unsafe refund path;
privacy leak;
fee model losing money;
wallet E2E failure;
real customer friction;
high-frequency abandonment.
```

Lower priority:

```text
new cosmetic feature;
new Deal Type with no user;
large loyalty campaign;
new token mechanic;
enterprise dashboard without customer.
```

---

# MILESTONE VIEW

## 56. Milestone 1 — Product Truth

Success:

```text
complete current capability matrix;
mainnet evidence separated from source/test evidence;
production config audited.
```

---

## 57. Milestone 2 — Reliable Mainnet Deal

Success:

```text
multiple real two-party mainnet deals
complete the supported lifecycle
without developer repair.
```

---

## 58. Milestone 3 — Sustainable Fee Evidence

Success:

```text
actual sponsor / privacy cost measured;
dynamic floor validated;
real paid user pricing observed;
contribution model updated from actual data.
```

---

## 59. Milestone 4 — Final Settlement Semantics

Success:

```text
Accepted Agreement roles correct;
universal Fulfillment model;
Verification Policies clear;
refund / dispute / objective settlement rules aligned;
all critical invariants tested.
```

---

## 60. Milestone 5 — First Real Customer Cohort

Success:

```text
10–25 real eligible deals;
real fees;
post-deal interviews;
clear funnel data.
```

---

## 61. Milestone 6 — Beachhead Signal

Success:

```text
one segment shows stronger repeat paid use,
referrals,
and manageable economics.
```

---

## 62. Milestone 7 — Repeatable Acquisition

Success:

```text
meaningful paid deal flow arrives
without one-to-one founder recruitment for every deal.
```

---

## 63. Milestone 8 — Loyalty Productionization

Success:

```text
event-backed Points;
referral ledger;
valid SBT multiplier;
anti-farming;
organic retention still visible.
```

---

## 64. Milestone 9 — Partner Distribution

Success:

```text
at least one integration produces measurable
incremental qualified deal activity.
```

---

## 65. Milestone 10 — Token Decision

Success is not necessarily:

```text
token launched.
```

Success can be:

```text
evidence says token is not needed yet
→ token postponed.
```

A valid product decision is better than an unnecessary token.

---

# WHAT VINSS SHOULD NOT DO

## 66. Avoid Roadmap Inflation

Do not add features merely to make the roadmap look ambitious.

Avoid prematurely committing to:

```text
full marketplace discovery;
global fiat rails;
all courier integrations;
enterprise procurement;
DAO governance;
cross-chain everything;
complex token staking;
large Agent autonomy.
```

These may become valid later.

They are not automatically priorities now.

---

## 67. Avoid Calendar Theater

Do not force every phase into arbitrary dates such as:

```text
Q1
Q2
Q3
Q4
```

if the prerequisite evidence is unknown.

VINSS should use:

```text
evidence gates
```

for strategic sequencing.

Calendar targets can exist operationally.

They should not override safety or validation.

---

## 68. Avoid Mainnet = Finished

Mainnet means:

```text
real execution environment.
```

It does not mean:

```text
product validated;
business validated;
safe at scale;
PMF.
```

Mainnet is the beginning of a stronger evidence phase.

---

## 69. Avoid Token = Growth

Token incentives can accelerate visible activity.

They can also hide:

```text
poor retention;
weak willingness to pay;
fake referrals;
wash settlement;
farm behavior.
```

VINSS should earn product pull before using token economics as a scale mechanism.

---

# ROADMAP METRICS

## 70. Technical Metrics

```text
transaction success rate;
wallet failure rate;
proof failure rate;
indexer lag;
quote failure rate;
recovery success;
mainnet E2E pass rate.
```

---

## 71. Product Metrics

```text
room → Invite;
Invite → Join;
Join → Offer;
Offer → Accept;
Accept → Fund;
Fund → Fulfill;
Fulfill → Settle.
```

---

## 72. Business Metrics

```text
GMV;
gross revenue;
revenue per active user;
revenue per completed Rekber;
variable cost;
contribution margin;
refund cost;
dispute cost.
```

---

## 73. Market Metrics

```text
qualified deals;
first paid deals;
repeat deals;
organic referrals;
segment concentration;
channel conversion.
```

---

## 74. Loyalty Metrics

```text
Points issued;
Points by source;
successful Rekber count;
valid certificate count;
referral quality;
reward abuse;
retention with vs without incentives.
```

---

# FINAL ROADMAP

## 75. Execution Order

The recommended VINSS sequence is:

```text
1. Establish current production truth
        ↓
2. Harden current mainnet lifecycle
        ↓
3. Measure real transaction economics
        ↓
4. Finalize universal settlement semantics
        ↓
5. Run real customer deals
        ↓
6. Validate pricing and business economics
        ↓
7. Identify beachhead
        ↓
8. Build repeatable GTM
        ↓
9. Productionize loyalty / reputation
        ↓
10. Expand through partners
        ↓
11. Decide whether VINSS token is justified
        ↓
12. Expand Deal Types / markets based on evidence
```

The ordering matters.

---

## 76. Roadmap Principle

VINSS already has enough technical scope to learn from real economic behavior.

The greatest risk is therefore no longer simply:

```text
Can more features be built?
```

The increasingly important questions are:

```text
Can the whole lifecycle be trusted?

Can users understand it?

Will real users choose it?

Will they pay?

Will they return?

Can VINSS operate it sustainably?

Which segment pulls hardest?

Which parts should become infrastructure?
```

The roadmap should keep answering those questions in order.

> **Build only what removes the next meaningful barrier between a real deal and a repeated successful paid settlement.**
