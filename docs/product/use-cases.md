# VINSS Product Use Cases

VINSS is designed for direct deals where two parties need more structure than chat, but do not necessarily want to expose the full commercial context publicly.

This document does not define a single target market.

It shows how the same Deal Room model can apply to different transaction types while preserving three product principles:

```text
1. agreement must be explicit;
2. settlement roles must follow the deal;
3. verification must match the kind of truth the deal can actually prove.
```

The examples below are product scenarios.

They are not claims that each segment has already been validated commercially.

---

## 1. Use Case Model

Each VINSS use case can be described through the same questions:

```text
Who are the parties?

What is being exchanged?

Who funds?

Who fulfills?

What must be delivered?

What is the deadline?

How is fulfillment verified?

What happens if nobody performs?

What happens if fulfillment is disputed?

What evidence remains after settlement?
```

This gives VINSS one coherent product structure without pretending every deal is identical.

---

## 2. Universal Deal Structure

A use case usually follows:

```text
PRIVATE CONVERSATION
        ↓
STRUCTURED OFFER
        ↓
ACCEPTED AGREEMENT
        ↓
REKBER
        ↓
FUNDING
        ↓
FULFILLMENT
        ↓
VERIFICATION
        ↓
RELEASE / REFUND / DISPUTE
        ↓
SETTLEMENT EVIDENCE
```

The main variation is in:

```text
FULFILLMENT
and
VERIFICATION.
```

---

# FREELANCE / SERVICE

## 3. Use Case — Website Development

### Parties

```text
Alice = client
Bob   = freelancer
```

### Agreement

```text
Deliverable:
landing-page website

Price:
500 USDC

Deadline:
30 August

Review period:
48 hours

Verification:
submission + party review
```

### Economic roles

```text
Funder:
Alice

Beneficiary:
Bob

Fulfiller:
Bob
```

### Happy path

```text
Alice and Bob negotiate
        ↓
Alice creates Offer
        ↓
Bob counters deadline
        ↓
Alice accepts
        ↓
Alice funds Rekber
        ↓
Bob builds website
        ↓
Bob submits work
        ↓
Alice reviews
        ↓
Alice approves
        ↓
500 USDC released to Bob
```

### What VINSS helps preserve

```text
accepted scope;
price;
deadline;
submission event;
review state;
settlement result.
```

---

## 4. Website Development — Freelancer Mangkir

Bob accepts the deal but does nothing.

```text
FUNDED
    ↓
deadline passes
    ↓
no valid submission
    ↓
Alice becomes eligible for recovery
```

This is a non-performance case.

No dispute about work quality is required because no fulfillment entered verification.

---

## 5. Website Development — False Fulfillment

Bob submits:

```text
"done"
```

but does not provide the agreed website.

VINSS should not treat the existence of a submission action as proof that the work is valid.

The flow becomes:

```text
submission
→ review
→ disagreement
→ dispute
```

---

## 6. Website Development — Client Acts Dishonestly

Bob delivers working source code.

Alice downloads it and later attempts:

```text
reject
→ full refund
```

The product should not treat this as if no fulfillment occurred.

Once valid fulfillment entered review:

```text
unilateral full-refund authority is restricted
```

and disagreement moves to:

```text
dispute.
```

---

## 7. Use Case — Design Work

### Agreement

```text
Deliverable:
brand identity package

Price:
800 USDC

Required:
logo files
brand guide
source files

Verification:
digital submission + human review
```

VINSS can preserve proof that the files were submitted.

It cannot automatically determine whether:

```text
the design is beautiful;
the brand direction is commercially effective;
the client subjectively likes it.
```

This makes design work a clear example of:

```text
digitally provable delivery
+
subjective quality.
```

---

## 8. Use Case — Consulting Session

### Agreement

```text
Service:
2-hour technical consulting session

Price:
300 USDC

Completion:
session occurs

Evidence:
agreed meeting confirmation / notes / other agreed proof
```

This use case is more off-chain than file delivery.

VINSS can preserve the agreement and settlement state.

It may still require party confirmation or dispute if the parties disagree about whether the session occurred as agreed.

---

# DIGITAL GOODS

## 9. Use Case — Source Code Package

### Parties

```text
Alice = buyer
Bob   = seller
```

### Agreement

```text
Product:
private source-code package

Price:
1,200 USDC

Delivery:
encrypted digital artifact

Verification:
delivery proof + buyer review
```

### Happy path

```text
Offer accepted
→ Alice funds
→ Bob delivers encrypted artifact
→ delivery evidence exists
→ Alice reviews
→ Alice approves
→ Bob receives payment
```

The file itself does not need to become public for the delivery event to be evidenced.

---

## 10. Source Code — Seller Never Delivers

```text
funded
→ no delivery
→ deadline passes
→ buyer recovery
```

---

## 11. Source Code — Broken Package

Bob delivers an artifact.

But the buyer claims:

```text
archive is corrupted;
repository is incomplete;
required module is missing.
```

VINSS may prove:

```text
an artifact was delivered.
```

It may not prove:

```text
the artifact satisfies every functional promise.
```

Therefore:

```text
delivery proof
→ review
→ dispute if necessary.
```

---

## 12. Source Code — Buyer Denies Delivery

Alice receives the package and later claims:

> Nothing was ever sent.

VINSS can preserve evidence that a delivery action tied to the deal occurred.

That does not automatically prove quality.

It does make denial of the delivery event itself harder to sustain.

---

## 13. Use Case — Software License

### Agreement

```text
Product:
software license / access key

Price:
250 USDC

Fulfillment:
seller provides valid license

Verification:
delivery evidence + buyer review
```

Potential dispute:

```text
license delivered
but
license is invalid or already revoked.
```

VINSS can preserve delivery.

Validity may require an external verification source or party review.

---

## 14. Use Case — Private Dataset

### Agreement

```text
Dataset:
private market dataset

Price:
3,000 USDC

Delivery:
encrypted file

Conditions:
specific date range
specific fields
specific format
```

VINSS can help preserve:

```text
what was promised;
what artifact was delivered;
when it was delivered.
```

It cannot automatically know whether every row is accurate unless the verification rule includes an objective external source.

---

# BOUNTY

## 15. Use Case — Bug Fix Bounty

### Parties

```text
Alice = bounty creator
Bob   = contributor
```

### Agreement

```text
Task:
fix issue #482

Reward:
400 USDC

Success criteria:
specified tests pass

Deadline:
7 days
```

### Verification class

```text
digitally provable
+
partly objective criteria.
```

### Happy path

```text
Alice funds
→ Bob submits PR / commit
→ agreed tests pass
→ result reviewed
→ release
```

---

## 16. Bug Fix — No Submission

```text
deadline passes
+
no result
→ Alice recovery.
```

---

## 17. Bug Fix — Submission Does Not Solve Problem

Bob submits a PR.

But the tests still fail.

The existence of a PR is not enough.

The product should compare the result against the agreed success criteria.

---

## 18. Bug Fix — Funder Uses Result but Refuses Payment

Alice merges the valid fix and still refuses settlement.

Useful evidence may include:

```text
accepted task;
submission reference;
commit/hash;
test evidence;
integration evidence.
```

If the relevant truth cannot be determined automatically, dispute remains necessary.

---

## 19. Use Case — Research Bounty

### Agreement

```text
Task:
produce research report

Reward:
1,000 USDC

Criteria:
minimum sources
specified scope
specific deliverables
```

The result can be submitted digitally.

But quality remains partly subjective.

Therefore:

```text
submission
→ review
→ approval / dispute.
```

---

# PHYSICAL GOODS

## 20. Use Case — Laptop Sale

### Parties

```text
Alice = buyer
Bob   = seller
```

### Agreement

```text
Item:
specific laptop

Price:
1,000 USDC

Condition:
used, grade A

Shipping deadline:
30 August

Inspection:
48 hours after delivery
```

### Roles

```text
Funder:
Alice

Beneficiary:
Bob

Fulfiller:
Bob
```

### Happy path

```text
Alice funds
→ Bob ships
→ delivery evidence appears
→ item delivered
→ inspection window
→ Alice approves
→ Bob receives payment
```

---

## 21. Laptop Sale — Seller Never Ships

```text
funded
→ shipping deadline passes
→ no valid shipment
→ buyer recovery.
```

---

## 22. Laptop Sale — Fake Tracking

Bob enters a tracking number.

That should not automatically mean:

```text
delivery started successfully.
```

The product should distinguish:

```text
tracking submitted
from
credible delivery evidence.
```

---

## 23. Laptop Sale — Wrong Item

A package arrives.

But it contains:

```text
different model;
different specification;
damaged item;
empty box.
```

Blockchain state cannot directly determine this.

The case requires:

```text
inspection;
evidence;
dispute.
```

---

## 24. Laptop Sale — Buyer Denies Receipt

Delivery evidence shows the package reached Alice.

Alice claims:

> I never received it.

The evidence should remain attached to the deal.

The disagreement moves into dispute rather than resetting the transaction to “not shipped.”

---

## 25. Use Case — Collectible Sale

Examples:

```text
trading card;
watch;
rare physical collectible.
```

Challenges include:

```text
authenticity;
condition;
delivery;
inspection.
```

VINSS can structure the deal and preserve evidence.

It cannot automatically authenticate a physical object without an external authority or agreed verification source.

---

# NFT DEAL

## 26. Use Case — Direct NFT Sale

### Parties

```text
Alice = buyer
Bob   = seller
```

### Agreement

```text
NFT contract:
X

Token ID:
482

Price:
1,000 USDC

Recipient:
Alice
```

### Verification class

```text
objectively verifiable.
```

### Happy path

```text
Alice funds
→ Bob transfers exact NFT
→ ownership condition verified
→ settlement proceeds
```

---

## 27. NFT Sale — Wrong Token

Bob transfers:

```text
token #483
```

instead of:

```text
token #482.
```

The objective condition fails.

No subjective review is required to determine that the agreed NFT was not transferred.

---

## 28. NFT Sale — Wrong Contract

Bob transfers a token with the same token ID from a different collection.

The agreement requires:

```text
contract
+
token ID
```

not only a number.

Objective verification prevents this substitution.

---

## 29. NFT Sale — Buyer Refuses to Confirm

Alice already owns the exact agreed NFT.

If the system can verify:

```text
expected contract;
expected token;
expected owner;
```

human confirmation should not be able to override that objective state unnecessarily.

---

## 30. Use Case — Private NFT Price Negotiation

The buyer and seller may want:

```text
private price discussion;
private counteroffers;
direct settlement;
publicly verifiable ownership transfer.
```

VINSS can preserve private negotiation while using objective asset state for fulfillment.

This is a strong example of:

```text
private context
+
verifiable outcome.
```

---

# TOKEN TRADE

## 31. Use Case — STRK for IDR

### Parties

```text
Alice = buyer of STRK
Bob   = seller of STRK
```

### Agreement

```text
Asset:
1,000 STRK

Fiat:
agreed IDR amount

Crypto provider:
Bob

Fiat payer:
Alice
```

The important product point is:

```text
Alice created the Offer
does not automatically mean
Alice is the crypto funder.
```

Roles come from the agreement.

---

## 32. STRK for IDR — Happy Path

```text
Bob provides / protects STRK side
→ Alice sends IDR
→ Alice submits payment evidence
→ Bob confirms receipt
→ STRK released to Alice
```

The fiat leg remains off-chain.

---

## 33. STRK for IDR — Fake Bank Screenshot

Alice uploads a screenshot.

Bob never receives money.

The product must not treat:

```text
screenshot submitted
=
payment objectively verified.
```

The flow requires:

```text
counterparty confirmation
or
external verification
or
dispute.
```

---

## 34. STRK for IDR — Seller Denies Real Payment

Alice sends the bank transfer.

Bob receives it but refuses to confirm.

Without trusted bank data, VINSS cannot independently know the account balance truth.

Evidence and dispute become necessary.

This is a real boundary of the product.

---

## 35. Use Case — STRK for USDC

If both sides are on-chain:

```text
STRK ↔ USDC
```

the product should evaluate whether a more deterministic or atomic settlement is preferable.

Human confirmation should not be required merely because it is convenient to reuse an off-chain workflow.

---

# CUSTOM DEAL

## 36. Use Case — Custom Consulting Deliverable

### Agreement

```text
Alice pays Bob 2,000 USDC

Bob must:
perform analysis
+
deliver report
+
present findings

Deadline:
14 days

Verification:
report delivery + presentation confirmation + review
```

VINSS can structure several conditions in one agreement.

The more complex the custom condition becomes, the more important it is to define verification before funding.

---

## 37. Use Case — Custom Asset Sale

Example:

```text
private sale of a domain,
account,
license,
or specialized digital right.
```

The verification rule depends on the asset.

Some rights may have:

```text
objective registry state.
```

Others may require:

```text
manual confirmation.
```

Custom Deal should not pretend the same verification works for both.

---

## 38. Subjective Custom Deal

Example term:

> Deal is complete when Alice is satisfied.

This is weak.

VINSS should warn that the condition is subjective.

A better agreement would define:

```text
specific deliverable;
minimum acceptance criteria;
deadline;
review period.
```

---

# CRYPTO-NATIVE TEAM

## 39. Use Case — Contractor Payment

A crypto team hires a contractor directly.

### Current fragmented workflow

```text
Telegram
+
Notion
+
wallet
+
manual tx hash
```

### VINSS flow

```text
private room
→ structured agreement
→ Rekber
→ work submission
→ approval
→ settlement evidence
```

The team gains clearer deal continuity.

---

## 40. Use Case — Private Vendor Purchase

A team purchases:

```text
security review;
design work;
infrastructure service;
private dataset;
research.
```

The commercial terms may be sensitive.

VINSS can preserve the private negotiation while allowing settlement evidence to remain verifiable.

---

## 41. Use Case — Grant Milestone

A grant provider funds a specific milestone.

### Agreement

```text
milestone;
amount;
deadline;
success criteria;
review.
```

The use case resembles a bounty or service agreement.

The relevant question is whether:

```text
completion can be objectively verified
or
requires human review.
```

---

# DIRECT P2P DEALS

## 42. Use Case — Community-to-Community Deal

Two users meet through:

```text
Telegram;
Discord;
X;
forum;
referral.
```

They do not want the social platform to become the source of truth for settlement.

VINSS begins when:

```text
the conversation becomes economically serious.
```

---

## 43. Use Case — High-Value Pseudonymous Deal

The parties may know each other only by:

```text
wallet;
handle;
community reputation.
```

The need for:

```text
clear terms;
privacy;
escrow;
evidence
```

can become stronger because offline enforcement is weaker.

---

## 44. Use Case — Repeat Counterparty

Alice and Bob have completed several deals.

They may no longer need Rekber every time.

VINSS may still provide value through:

```text
private agreement;
structured Offer;
deal history;
evidence.
```

This illustrates that:

```text
Deal Room value
≠
Rekber value only.
```

---

# FAILURE-MODE USE CASES

## 45. Use Case — Party Disappears Before Funding

If the agreement is accepted but nobody funds:

```text
no protected value exists.
```

The room may simply remain inactive or expire according to product policy.

This is not the same as a funded Rekber failure.

---

## 46. Use Case — Party Disappears After Funding

This is more serious.

If the fulfiller disappears:

```text
deadline
→ non-performance
→ recovery path.
```

If the funder disappears after valid fulfillment:

```text
verification policy
determines the fallback.
```

These are different timeout problems.

---

## 47. Use Case — Wrong Role Configuration

Example:

```text
seller creates Offer
but system assumes seller must fund buyer payment.
```

This is a product-model failure.

VINSS should prevent it before funding by making roles explicit.

---

## 48. Use Case — Ambiguous Completion Criteria

Example:

```text
"deliver good result"
```

This is not sufficiently precise for deterministic settlement.

The product should encourage:

```text
observable criteria;
specific deliverables;
review period.
```

---

## 49. Use Case — Objective Evidence Contradicts a Party

Example:

```text
buyer says NFT never arrived
but
objective ownership state shows exact NFT is owned by buyer.
```

Objective evidence should take priority over unnecessary manual confirmation.

---

## 50. Use Case — Evidence Exists but Quality Is Disputed

Example:

```text
digital file was delivered
but
buyer says file is unusable.
```

The product must distinguish:

```text
delivery truth
from
quality truth.
```

---

## 51. Use Case — Both Parties Agree to Cancel

Neither party is necessarily dishonest.

Circumstances change.

```text
funded
→ mutual cancellation
→ refund / agreed split
→ settlement closed.
```

---

## 52. Use Case — Partial Performance

A custom or service deal may be partially completed.

Example:

```text
3 of 5 milestones delivered.
```

A future product policy may support:

```text
agreed split;
partial release;
partial refund.
```

This should be explicitly agreed.

It should not be guessed by the system.

---

# PRIVACY USE CASES

## 53. Use Case — Private Price Negotiation

Alice and Bob do not want their negotiated price exposed publicly.

The deal can keep:

```text
discussion;
counteroffers;
commercial rationale
```

inside the private context while settlement remains verifiable.

---

## 54. Use Case — Private Client Relationship

A freelancer or vendor may not want observers to learn:

```text
which client they serve;
what service is being purchased;
what price was negotiated.
```

The value of privacy is the protected business relationship, not only the hidden transfer amount.

---

## 55. Use Case — Private OTC Relationship

An OTC participant may not want competitors to infer:

```text
counterparty;
trade size;
timing;
treasury movement strategy.
```

VINSS aims to reduce unnecessary exposure while remaining honest that some protocol metadata can still exist.

---

## 56. Use Case — Private Digital Delivery

A seller may want to prove that a private artifact was delivered without publishing the artifact.

This is especially relevant for:

```text
source code;
research;
license;
private dataset.
```

---

# EVIDENCE USE CASES

## 57. Use Case — Reopen a Completed Deal

Months later, Alice reopens the Deal Room.

She should be able to understand:

```text
what was accepted;
what happened;
how settlement ended;
what evidence remains.
```

without searching old chats and wallet history.

---

## 58. Use Case — Show Settlement to a Partner

Alice may want to prove:

> This settlement completed.

She should not necessarily need to reveal:

```text
every message;
every Offer revision;
every attachment.
```

This is the purpose of selective evidence.

---

## 59. Use Case — Settlement Certificate

An eligible completed deal may produce an optional Settlement Certificate.

The certificate can support:

```text
portable deal history;
business proof;
reputation experiments;
partner verification.
```

It does not prove every real-world fact about the deal.

---

## 60. Use Case — No Public Certificate

Some users may want:

```text
private settlement
without
public certificate.
```

The certificate should remain optional.

Privacy should not be weakened simply to create a visible achievement artifact.

---

# AGENT USE CASES

## 61. Use Case — Agent Summarizes Current Deal State

The user asks:

> What am I waiting for?

The Agent may summarize:

```text
Offer accepted;
Rekber funded;
Bob must submit by Friday;
no fulfillment yet.
```

The Agent assists understanding.

It does not become settlement authority.

---

## 62. Use Case — Agent Helps Draft an Offer

The Agent may help turn conversation into:

```text
deliverable;
price;
deadline;
verification method;
review period.
```

The user still reviews and authorizes the actual Offer.

---

## 63. Use Case — Agent Helps Explain a Dispute

The Agent may organize:

```text
accepted terms;
submitted evidence;
timeline;
points of disagreement.
```

But if objective verification already determines the relevant fact, Agent opinion should not override it.

---

## 64. Use Case — Agent Cannot Know Off-Chain Truth

If a user asks:

> Did Bob really receive my bank transfer?

the Agent cannot know merely from chat or screenshots.

The product should not generate false certainty.

---

# TEMPLATE-SPECIFIC SUMMARY

## 65. Freelance

```text
Truth type:
digital + subjective

Fulfillment:
work submission

Verification:
review

Main failure:
non-performance / poor work / unfair rejection
```

---

## 66. Physical Goods

```text
Truth type:
off-chain / physical

Fulfillment:
shipment + delivery

Verification:
delivery evidence + inspection

Main failure:
no shipment / wrong goods / false non-delivery claim
```

---

## 67. Digital Goods

```text
Truth type:
digitally provable + subjective quality

Fulfillment:
artifact delivery

Verification:
delivery proof + review

Main failure:
no delivery / broken file / false denial of receipt
```

---

## 68. Bounty

```text
Truth type:
digital + partly objective

Fulfillment:
result submission

Verification:
criteria + review

Main failure:
no submission / criteria failure / unfair rejection
```

---

## 69. NFT Deal

```text
Truth type:
objective on-chain

Fulfillment:
exact NFT transfer

Verification:
contract + token ID + ownership

Main failure:
wrong asset / no transfer / unnecessary refusal to acknowledge
```

---

## 70. Token Trade

```text
Truth type:
depends on rails

On-chain leg:
objective

Fiat leg:
off-chain

Verification:
rail-specific

Main failure:
fake payment evidence / denial of real receipt
```

---

## 71. Custom

```text
Truth type:
variable

Fulfillment:
defined by agreement

Verification:
must be defined before funding

Main failure:
ambiguous completion condition
```

---

# WHERE VINSS FITS BEST

## 72. Strong Use Case Characteristics

VINSS is likely most useful when:

```text
two parties negotiate materially;
the deal has meaningful value;
the counterparty is not fully trusted;
privacy matters;
there is a clear fulfillment obligation;
settlement risk exists;
evidence matters afterward.
```

---

## 73. Weak Use Case Characteristics

VINSS may be unnecessary when:

```text
transaction value is tiny;
counterparty is fully trusted;
no negotiation exists;
payment is immediate;
no evidence is needed;
privacy does not matter;
current payment flow already solves the problem.
```

---

## 74. Not Every Deal Needs Rekber

A repeated trusted relationship may use:

```text
private conversation
+
structured Offer
+
direct settlement
```

without Rekber.

Rekber should solve risk.

It should not be forced into every deal for feature usage.

---

## 75. Not Every Deal Needs a Certificate

Certificate value depends on whether the user needs portable public evidence.

A private transaction may be complete without one.

---

# BUSINESS LEARNING FROM USE CASES

## 76. Use Cases Are Pricing Experiments

Different use cases may value different stages.

For example:

```text
Freelance:
values payment protection.

NFT:
values deterministic settlement.

OTC:
values privacy + sequencing.

Digital goods:
values delivery proof.

Crypto team:
values repeatable workflow + evidence.
```

This suggests pricing should be validated by use case, not only by technical transaction cost.

---

## 77. Use Cases Reveal Beachhead Candidates

A strong beachhead will show:

```text
repeated same use case;
similar pain;
similar willingness to pay;
similar verification model;
similar acquisition channel.
```

If every user needs a completely custom workflow, the market may still be too broad.

---

## 78. Use Cases Reveal Product Scope Risk

Physical goods may pull VINSS toward:

```text
logistics integrations.
```

Fiat OTC may pull toward:

```text
bank verification.
```

Enterprise use may pull toward:

```text
roles and compliance.
```

Marketplace use may pull toward:

```text
discovery and anti-spam.
```

The product should identify these expansion pressures before accepting them into core scope.

---

# VALIDATING USE CASES

## 79. Real Deal Test

For each candidate use case, ask users to complete a real transaction.

Measure:

```text
Did they create the room?

Did the counterparty join?

Did they use the Offer?

Did they understand roles?

Did they use Rekber?

Did they complete fulfillment?

Did they understand verification?

Did they settle?

Did they return?
```

---

## 80. Compare Against Existing Workflow

After the deal, ask:

```text
What was easier?

What was harder?

What would you remove?

What would make you go back to your old workflow?

Which part was worth paying for?
```

---

## 81. Watch for External Workarounds

If users still need:

```text
Telegram for agreement;
Google Docs for final terms;
screenshots for proof;
manual spreadsheets for state;
```

then VINSS has not fully solved the workflow.

---

## 82. Watch for Unused Features

If users never use:

```text
Rekber;
Certificate;
Agent;
Offer countering;
```

that is useful evidence.

Do not force product narratives around features that users ignore.

---

## 83. Watch for Repeated Dispute Patterns

If multiple deals generate the same dispute:

```text
same missing evidence;
same ambiguous criteria;
same role confusion;
```

that may justify:

```text
new template behavior;
better agreement fields;
better verification policy.
```

---

# USE-CASE DECISION RULES

## 84. Promote a Use Case When

```text
users repeat it;
pain is clear;
flow is understandable;
settlement completes;
users pay;
support burden is manageable.
```

---

## 85. Keep Testing When

```text
users like the idea
but
real usage is sparse.
```

---

## 86. Deprioritize When

```text
verification is too external;
support cost is too high;
fees overwhelm value;
users prefer existing incumbents;
distribution is unclear.
```

---

## 87. Kill a Use Case Hypothesis When

Evidence repeatedly shows:

```text
no meaningful pain;
no switching behavior;
no willingness to pay;
no repeat use.
```

Removing a weak use case is product progress.

---

# PUBLIC USE-CASE NARRATIVES

## 88. Freelance Narrative

> A client and freelancer negotiate privately, turn the final scope into an explicit Offer, protect payment with Rekber, submit and review the work, then settle with evidence that remains connected to the original agreement.

---

## 89. Digital Goods Narrative

> A buyer funds a private digital purchase, the seller delivers an encrypted artifact with delivery evidence, the buyer reviews it, and settlement completes without publishing the private file or commercial terms.

---

## 90. Physical Goods Narrative

> A buyer and seller agree on a private sale, the buyer funds Rekber, the seller ships, delivery and inspection determine the next step, and disputes remain tied to the accepted terms and delivery evidence.

---

## 91. NFT Narrative

> A buyer and seller negotiate a private NFT deal, define the exact contract and token, protect the payment, and use objective on-chain ownership to verify fulfillment instead of relying on manual acknowledgment.

---

## 92. OTC Narrative

> Two parties negotiate a private asset trade, define which side provides which asset, protect the on-chain value, and use the appropriate verification path for each settlement rail.

---

## 93. Bounty Narrative

> A bounty creator defines the reward and success criteria, funds the deal, receives a result, verifies it against the accepted criteria, and releases or disputes the reward through the same Deal Room.

---

## 94. Custom Deal Narrative

> Two parties define their own obligation, funding role, deadline, and verification method before settlement begins, allowing VINSS to support unusual deals without pretending subjective conditions are objectively provable.

---

# THE USE-CASE THESIS

## 95. One Product, Different Truth Models

The common VINSS product is not:

```text
seven unrelated escrow systems.
```

It is:

```text
one deal lifecycle
+
different fulfillment semantics
+
different verification policies.
```

---

## 96. The Key Product Rule

> **A Deal Type should change how the obligation is understood and verified, not merely change the label shown in the interface.**

---

## 97. The Key Settlement Rule

> **No fulfillment by the agreed deadline may justify funder recovery. Once meaningful fulfillment enters verification, neither side should have unilateral power to rewrite the deal outcome.**

---

## 98. The Key Verification Rule

> **Use deterministic settlement when the relevant truth is objectively verifiable. Use evidence, review, and dispute when it is not.**

---

## 99. The Key Privacy Rule

> **Keep private deal context private where possible, while preserving enough evidence to verify the settlement outcome.**

---

## 100. Relationship to Other Product Documentation

```text
problem.md
    Why the problem exists.

solution.md
    How VINSS proposes to solve it.

innovation.md
    What is differentiated in the approach.

product-experience.md
    How the complete journey feels.

target-users.md
    Who is most likely to need the product.

use-cases.md
    How VINSS applies to concrete transaction scenarios.

validation.md
    What evidence exists and what still needs to be tested.

README.md
    Concise product overview.
```
