# VINSS Product Innovation

VINSS did not begin from the idea of building another escrow application.

It began from a simpler privacy question:

> **If a privacy pool can protect the movement of value, can the same privacy foundation also protect the communication and coordination that happen before value moves?**

That direction first appeared as encrypted on-chain messaging: private application communication built around the privacy pool rather than a trusted plaintext messaging server.

VINSS extends that idea much further.

Messaging becomes negotiation.

Negotiation becomes explicit agreement.

Agreement becomes protected settlement.

Settlement becomes verifiable evidence.

The innovation is therefore not one feature.

It is the **deal lifecycle created by connecting these layers while preserving privacy boundaries and adapting verification to the nature of each deal.**

---

## 1. From Private Transfer to Private Coordination

Privacy infrastructure is often discussed only in terms of transfers:

```text
hide sender
hide receiver
hide amount
```

But a real deal begins before the transfer.

Two parties must first:

```text
find each other;
discuss terms;
clarify obligations;
change proposals;
agree on a final version;
decide how settlement should happen.
```

If the payment is private but the negotiation is public or scattered across unrelated systems, much of the sensitive deal context can still leak.

VINSS explores a broader product direction:

> **Use privacy infrastructure not only to move value privately, but to coordinate the economic relationship around that value.**

This is the first innovation layer.

---

## 2. Encrypted Messaging Is the Substrate, Not the Product

The original encrypted-messaging direction demonstrated that a privacy-enabled execution environment could support application coordination in addition to private transfers.

That creates possibilities such as:

```text
private messages;
payment context;
private negotiation;
deal coordination.
```

VINSS does not stop there.

A private messenger alone still leaves users with the same fundamental problem:

```text
conversation
does not automatically become
agreement.
```

VINSS therefore treats encrypted messaging as the **substrate**.

The product is the **deal lifecycle built on top of it**.

---

## 3. Private Communication Becomes Private Economic Coordination

The transition is:

```text
Encrypted Message
        ↓
Private Negotiation
        ↓
Structured Offer
        ↓
Accepted Agreement
        ↓
Protected Settlement
        ↓
Evidence
```

Each stage answers a different question.

### Message

> What are we discussing?

### Offer

> What exactly is being proposed?

### Accepted Agreement

> Which terms did both parties agree to?

### Rekber

> How is value protected while the obligation is being fulfilled?

### Settlement

> What was the final financial outcome?

### Evidence

> What can be proven afterward?

This continuity is more important than any individual feature.

---

## 4. Conversation Becomes Structured Agreement

Normal chat is intentionally flexible.

That flexibility is useful for negotiation but dangerous when users need to determine the authoritative agreement.

A conversation can contain:

```text
initial price;
revised price;
new deadline;
counterproposal;
clarification;
informal approval;
later correction.
```

VINSS introduces a boundary between:

```text
DISCUSSION
and
AGREEMENT
```

A structured Offer lets the parties turn informal negotiation into explicit deal state.

The innovation is not simply that VINSS has an Offer form.

The important change is:

> **The result of negotiation becomes an explicit state that the settlement workflow can reference.**

---

## 5. Agreement and Settlement Stay Connected

Many products treat negotiation and escrow as unrelated systems.

Users may agree in one application and create an escrow transaction somewhere else.

VINSS treats that gap as a product problem.

The intended continuity is:

```text
Accepted Offer
        ↓
Rekber
        ↓
Fulfillment
        ↓
Verification
        ↓
Settlement
```

The settlement should remain connected to the agreement that created it.

This means the user should be able to understand:

```text
which agreement is being settled;
who is expected to perform;
what value is protected;
what must happen before release;
and what final outcome occurred.
```

The Rekber is therefore not an isolated financial object.

It is part of the deal.

---

## 6. One Deal Lifecycle, Multiple Verification Models

This is one of the most important product ideas in VINSS.

Different deals have different kinds of truth.

A rule that works for an NFT transfer may be unsafe for freelance work.

A rule that works for a digital artifact may be meaningless for physical delivery.

Therefore VINSS should not use a universal rule such as:

```text
fulfillment submitted
→ automatic release
```

Instead, VINSS keeps one understandable lifecycle while adapting the verification method:

```text
ACCEPTED AGREEMENT
        ↓
FUNDED
        ↓
FULFILLMENT
        ↓
VERIFICATION POLICY
        ↓
SETTLEMENT
```

The lifecycle remains consistent.

The verification policy follows the nature of the obligation.

---

## 7. Three Classes of Deal Truth

VINSS can reason about verification through three broad classes.

### A. Objectively Verifiable

Examples:

```text
NFT ownership transfer;
on-chain token transfer;
deterministic blockchain state.
```

If the accepted agreement defines the expected condition precisely, the system can verify whether that condition occurred.

Example:

```text
expected NFT contract
+
expected token ID
+
expected recipient
+
current ownership
```

When the relevant truth is objective, human discretion should be minimized.

---

### B. Digitally Provable, but Quality Is Subjective

Examples:

```text
freelance work;
digital goods;
bounty submissions.
```

VINSS may be able to preserve evidence that:

```text
a file was delivered;
a submission existed;
a result was uploaded;
an artifact was associated with the deal;
a delivery happened at a particular time.
```

But this does not automatically prove:

```text
quality;
correctness;
completeness;
fitness for purpose;
or satisfaction of every subjective expectation.
```

These deals require:

```text
delivery / submission proof
+
review
+
dispute when necessary
```

---

### C. Off-Chain or Physical

Examples:

```text
physical goods;
bank or fiat payment;
real-world services;
some custom agreements.
```

Important facts exist outside the blockchain.

A smart contract does not automatically know:

```text
whether a laptop arrived;
whether it arrived damaged;
whether a bank account received fiat;
whether a physical service was performed correctly.
```

These deals may require:

```text
external evidence;
counterparty confirmation;
inspection;
oracle data;
manual review;
or dispute resolution.
```

VINSS should not pretend that automation can observe facts it cannot actually know.

---

## 8. Verification Should Follow the Nature of Truth

This leads to a foundational VINSS principle:

> **The more objectively a fulfillment condition can be verified, the less discretion humans or Agents should have over settlement. The more subjective or off-chain the deal is, the more important evidence, review, and dispute become.**

This avoids two opposite failures.

### Too much human discretion

```text
objective fact exists
but
a party can still arbitrarily block settlement
```

### False automation

```text
truth is subjective or off-chain
but
the system pretends that one button or one proof establishes completion
```

VINSS should do neither.

---

## 9. Verification Policy Comes From the Deal Type

Different Deal Types can provide different verification experiences while using the same underlying deal lifecycle.

Conceptually:

| Deal type | Verification direction |
| --- | --- |
| Freelance | Submission + party review |
| Physical Goods | Delivery evidence + inspection |
| Digital Goods | Delivery proof + party review |
| Bounty | Submission + agreed criteria + review |
| NFT Deal | Objective on-chain verification |
| Token Trade with fiat leg | Counterparty / rail-specific confirmation |
| Custom | Explicitly agreed verification policy |

The innovation is not the existence of seven templates.

The innovation is:

> **The Deal Type helps define how truth should be established before settlement.**

---

## 10. Two-Sided Protection

A settlement product is incomplete if it assumes only one party can behave dishonestly.

VINSS has to protect against both sides.

### The fulfiller can misbehave

For example:

```text
never perform;
miss the deadline;
submit fake fulfillment;
send the wrong asset;
provide misleading evidence;
claim completion without satisfying the agreement.
```

### The funder can misbehave

For example:

```text
receive useful work and refuse payment;
receive a digital artifact and deny receipt;
receive a physical item and claim non-delivery;
receive the correct NFT and still block settlement;
attempt a full refund after already obtaining the benefit.
```

The protection model therefore cannot simply be:

> funder always controls the money until release.

Nor can it be:

> any submitted fulfillment automatically pays the counterparty.

Both are exploitable.

---

## 11. Non-Performance and Disputed Performance Are Different

VINSS distinguishes two fundamentally different cases.

### No fulfillment

```text
FUNDED
    ↓
deadline expires
    ↓
no valid fulfillment
    ↓
funder recovery
```

This protects against the party who disappears or never performs.

### Fulfillment has begun

```text
FULFILLMENT
    ↓
VERIFICATION
```

Once meaningful fulfillment exists, the deal enters a different state.

The funder should not necessarily retain an unrestricted unilateral full-refund path.

From here, outcomes may include:

```text
verified success
→ RELEASE

mutual cancellation
→ REFUND / AGREED SPLIT

disagreement
→ DISPUTE

objective proof
→ DETERMINISTIC SETTLEMENT
```

This is what creates two-sided protection.

---

## 12. Economic Roles Come From the Agreement

Another important VINSS design principle is:

> **Who created the Offer is not automatically the party who should fund settlement.**

Example:

```text
Bob:
"I sell this laptop for 500 USDC."
```

Bob created the Offer.

But the buyer may be the party who should fund the 500 USDC.

Another example:

```text
Alice:
"I want to buy 1,000 STRK for IDR."
```

Alice created the Offer.

But the STRK seller may be the party providing the on-chain asset being protected.

Therefore the accepted agreement should explicitly establish:

```text
who provides the settlement asset;
who receives it;
who has the fulfillment obligation;
what must be fulfilled;
the deadline;
the verification method;
the review period.
```

This makes the economic model follow the deal itself rather than the order of UI actions.

---

## 13. A Universal Deal Model Without Forcing Every Deal to Be the Same

VINSS aims for a useful middle ground.

It should not create a completely unrelated state machine for every possible Deal Type.

But it also should not force every deal into a freelance-like workflow.

The universal model is:

```text
AGREEMENT
    ↓
PROTECTION
    ↓
FULFILLMENT
    ↓
VERIFICATION
    ↓
SETTLEMENT
```

The flexible layer is:

```text
what counts as fulfillment?
how is fulfillment verified?
who may approve?
what happens on timeout?
when is dispute required?
can objective evidence determine the result?
```

This lets VINSS remain understandable while respecting the reality that different economic activities have different verification requirements.

---

## 14. Deal Templates Are Behavioral Models, Not Cosmetic Categories

A template should do more than change labels.

For example:

### Freelance

```text
Submit Work
→ Review
→ Approve / Dispute
```

### Physical Goods

```text
Shipment
→ Delivery
→ Inspection
→ Approve / Dispute
```

### Digital Goods

```text
Deliver Artifact
→ Delivery Proof
→ Review
→ Approve / Dispute
```

### NFT Deal

```text
Expected NFT Transfer
→ Objective Verification
→ Settlement
```

### Token Trade with Fiat

```text
Payment Evidence
→ Counterparty Confirmation
→ Release / Dispute
```

The template therefore helps define **behavior and verification**, not merely the wording of a form.

---

## 15. Private Context, Verifiable Outcome

VINSS combines two goals that are often treated as opposites:

```text
privacy
and
verification
```

The product does not need to publish an entire deal just to prove that settlement happened.

Conceptually, VINSS separates:

```text
PRIVATE DEAL CONTEXT
    negotiation
    terms
    attachments
    commercial discussion
    sensitive evidence

from

VERIFIABLE OUTCOME
    settlement state
    transaction result
    eligible completion evidence
```

The product principle is:

> **Keep the context private where possible. Make the outcome verifiable where useful.**

---

## 16. Privacy Without the “No Metadata” Myth

The original encrypted-messaging direction used ambitious language around sender anonymity and metadata resistance.

The mature VINSS privacy position is more precise.

Privacy does not mean:

```text
nothing is visible;
no transaction happened;
no timing exists;
no protocol metadata exists;
perfect anonymity is guaranteed.
```

VINSS instead follows:

> **Hide what does not need to be public. Verify what needs to be proven.**

This distinction is important because honest privacy boundaries create more trust than absolute marketing claims.

---

## 17. Privacy Is Applied Across the Deal Lifecycle

A private transfer alone does not protect the entire deal.

If users negotiate sensitive terms in public or expose their commercial context elsewhere, the private transfer protects only one stage.

VINSS applies privacy to the broader coordination process:

```text
private communication
        ↓
private negotiation
        ↓
private structured agreement
        ↓
privacy-aware settlement
        ↓
controlled evidence
```

The product innovation is therefore broader than a private-payment feature.

---

## 18. Settlement Becomes Evidence

Most transaction products end when the transfer succeeds.

VINSS treats settlement as the beginning of an evidence layer.

A completed deal can produce:

```text
settlement state;
transaction evidence;
proof of the relevant final action;
optional Settlement Certificate.
```

The evidence should remain connected to the deal without requiring the private negotiation to become public.

This creates the transition:

```text
private economic coordination
        ↓
verifiable settlement
        ↓
portable evidence
```

---

## 19. Settlement Certificate as a Portable Evidence Layer

The optional Settlement Certificate is not designed primarily as a collectible or speculative NFT.

Its product role is:

> **a portable, independently verifiable record that an eligible settlement reached a valid completed state.**

The certificate should not expose:

```text
private messages;
full Offer terms;
private attachments;
private keys;
hidden Rekber coordination details.
```

And it should not claim to prove:

```text
quality of a physical good;
quality of freelance work;
truth of every statement made in the deal;
or absence of all disputes outside the represented settlement state.
```

It proves the settlement fact represented by VINSS.

---

## 20. Selective Evidence Is More Useful Than Radical Transparency

Traditional blockchain design often assumes:

> more public information = more verification.

For private commercial relationships, that is not always desirable.

A business may need to prove:

```text
a settlement occurred;
a transaction was completed;
a counterparty completed an eligible deal.
```

without revealing:

```text
the full negotiation;
pricing strategy;
private attachments;
internal discussion;
or unrelated wallet activity.
```

VINSS therefore favors:

> **minimum necessary disclosure for the intended proof.**

---

## 21. The Agent Should Follow the Same Verification Principle

VINSS Agent can help users understand and prepare actions.

But an Agent should not become an unnecessary source of settlement authority.

The same product principle applies:

```text
if the truth is objectively verifiable
→ prefer deterministic verification

if the truth requires judgment
→ Agent may assist analysis

if the truth is subjective or disputed
→ preserve human approval / dispute process
```

An Agent can help interpret evidence.

It should not override stronger objective evidence merely because it can generate an opinion.

---

## 22. The Product Does Not Confuse Automation With Truth

Blockchain systems are good at enforcing rules over facts they can actually observe.

They are not automatically good at determining:

```text
whether a design is beautiful;
whether a laptop was damaged before delivery;
whether freelance work meets a subjective expectation;
whether a person lied about an off-chain event.
```

VINSS should automate only where the truth source is strong enough.

That produces a better rule:

> **Automate enforcement where verification is objective. Structure evidence and dispute where it is not.**

---

## 23. The Product Does Not Confuse Privacy With Trust

Privacy protects information.

It does not automatically make a counterparty honest.

A private conversation can still contain a lie.

An encrypted attachment can still contain the wrong file.

A hidden payment can still be part of a bad agreement.

VINSS therefore combines privacy with:

```text
structured agreement;
explicit obligations;
verification policy;
settlement state;
evidence;
dispute paths.
```

Privacy is one layer of the product.

It is not a substitute for deal structure.

---

## 24. The Product Does Not Confuse Escrow With Agreement

Escrow can protect assets.

It does not automatically tell the parties:

```text
what was promised;
which version of the terms is current;
who must perform;
what completion means.
```

VINSS puts structured agreement before protected settlement.

That ordering is intentional.

```text
NEGOTIATE
→ AGREE
→ PROTECT
→ FULFILL
→ VERIFY
→ SETTLE
```

---

## 25. The Product Does Not Confuse a Transaction Hash With Evidence Context

A transaction hash can prove that a transaction exists.

But users may still ask:

```text
What did this transaction represent?

Which agreement did it belong to?

Was it funding, release, refund, or resolution?

Which obligation was being settled?
```

VINSS tries to preserve semantic continuity between:

```text
deal
and
transaction evidence.
```

The innovation is not creating more hashes.

It is making the evidence understandable as part of the deal lifecycle.

---

## 26. The Innovation Stack

VINSS can be understood as a stack of product innovations:

```text
PRIVACY FOUNDATION
Private execution and private application context
        ↓
PRIVATE COORDINATION
Encrypted communication around the deal
        ↓
STRUCTURED AGREEMENT
Conversation becomes explicit Offer state
        ↓
ROLE-AWARE PROTECTION
Economic roles follow the agreement
        ↓
FULFILLMENT
The obligated party performs
        ↓
ADAPTIVE VERIFICATION
Verification follows the nature of the deal
        ↓
TWO-SIDED SETTLEMENT
Both funder and fulfiller receive protection
        ↓
VERIFIABLE OUTCOME
Settlement can be independently evidenced
        ↓
PORTABLE EVIDENCE
Optional Settlement Certificate
```

No single layer represents the whole product.

The innovation is how the layers work together.

---

## 27. What Is Actually New in the Product Thesis

VINSS should not describe its innovation merely as:

```text
encrypted chat;
escrow;
NFT certificate;
Starknet;
privacy pool.
```

Each of those ideas can exist independently.

The stronger thesis is:

> **VINSS turns private communication into a structured economic relationship, carries the accepted agreement into protected settlement, adapts verification to the kind of truth each deal produces, protects both sides of the transaction, and preserves a verifiable outcome without unnecessarily publishing the private deal context.**

That is the product-level innovation.

---

## 28. Why This Is More Than “Chat + Escrow”

Simply placing chat and escrow in the same interface does not create deal continuity.

VINSS requires semantic relationships between the stages:

```text
the Offer represents negotiated terms;

the accepted Offer establishes the agreement;

the agreement defines settlement roles;

the Deal Type informs verification;

fulfillment moves the deal into verification;

verification determines the legitimate settlement path;

settlement creates contextual evidence.
```

That relationship between states is what makes the system a **Deal Room** rather than a bundle of unrelated features.

---

## 29. Why This Is More Than “Private Escrow”

Private escrow protects financial state.

VINSS also addresses what happens before and after escrow:

```text
before:
communication
negotiation
agreement

during:
funding
fulfillment
verification
settlement

after:
evidence
certificate
```

The value proposition is the continuity of the transaction process.

---

## 30. Why This Is More Than “On-Chain Messaging”

On-chain or privacy-enabled messaging answers:

> Can two users communicate privately through this infrastructure?

VINSS asks the next question:

> **Can that communication become an enforceable and understandable deal workflow without exposing the private relationship unnecessarily?**

The product therefore moves from:

```text
message transport
```

to:

```text
economic coordination.
```

---

## 31. Why This Is More Than “Templates”

Templates by themselves are not innovation.

The important role of Deal Types is that they can encode different expectations about:

```text
who performs;
what fulfillment means;
what evidence exists;
which party reviews;
whether objective verification is possible;
when dispute is required.
```

A useful template changes the settlement behavior.

It does not only change the label.

---

## 32. Why This Is More Than an Agent Workflow

An AI Agent can help users:

```text
understand terms;
prepare an Offer;
summarize state;
explain next actions;
review evidence.
```

But VINSS does not depend on an Agent inventing transaction truth.

The stronger design is:

```text
objective truth
→ deterministic verification

structured evidence
→ assisted analysis

subjective disagreement
→ dispute
```

The Agent remains assistive.

The deal model remains authoritative.

---

## 33. Innovation Through Constraint

Some of the strongest VINSS product decisions come from what the system deliberately does **not** do.

VINSS does not need to:

```text
become a general messenger;
become a public marketplace first;
publish every deal term;
automate every subjective dispute;
turn every completion into an NFT;
let an Agent control funds autonomously;
pretend off-chain facts are automatically knowable.
```

These constraints keep the product centered on its core function:

> **help two parties complete a sensitive deal with clearer agreement, appropriate protection, and verifiable settlement.**

---

## 34. Innovation Should Be Measured by User Outcomes

Technical sophistication alone does not prove product innovation.

The innovation matters only if users experience meaningful improvements.

VINSS should eventually demonstrate that users can achieve outcomes such as:

```text
less ambiguity over accepted terms;
less manual reconstruction of transaction history;
fewer mistakes about who must act next;
better protection against non-performance;
better protection against opportunistic funders;
more appropriate verification for each deal type;
less unnecessary exposure of private commercial context;
more useful settlement evidence.
```

These are hypotheses until validated with actual users.

---

## 35. What Public Evidence Does Not Prove

Public fraud, impersonation, privacy, and crypto-loss statistics establish that the problem space exists.

They do not prove that the VINSS innovation is already commercially successful.

They do not prove:

```text
users prefer VINSS;
users will leave Telegram or WhatsApp for VINSS;
users will pay the proposed fees;
a specific template is the best beachhead;
Rekber reduces fraud in practice;
adaptive verification improves conversion;
VINSS has product-market fit.
```

Those are product and business hypotheses requiring customer evidence.

---

## 36. What Technical Evidence Does Not Prove

A successful technical implementation can prove that:

```text
a primitive executes;
an encrypted action can be created;
a settlement state can transition;
a certificate can be claimed.
```

It cannot by itself prove:

```text
the user understands the workflow;
the verification policy is fair;
the pricing is acceptable;
the product solves repeated pain;
the business is sustainable.
```

VINSS should continue to separate:

```text
technical truth
from
product truth
from
business truth.
```

---

## 37. Current Innovation Hypotheses

The following should remain explicit hypotheses until validated:

- Users value one continuous Deal Room more than separate chat, wallet, and escrow tools.
- Structured Offers materially reduce agreement ambiguity.
- Deal-linked Rekber is easier to understand than standalone escrow.
- Two-sided protection increases trust for both funders and fulfillers.
- Verification policies based on Deal Type reduce settlement mistakes.
- Users accept deterministic settlement for objectively verifiable obligations.
- Users accept review and dispute for subjective obligations.
- Users understand the difference between delivery proof and quality verification.
- Privacy of deal context is valuable enough to influence product choice.
- Settlement evidence has value after the transaction.
- Optional certificates can become useful portable deal credentials.
- These benefits justify sustainable fees.

---

## 38. Innovation Validation Questions

### Deal continuity

```text
Can users explain how Message, Offer, Rekber,
and Settlement relate to one another?

Do they still need external notes or screenshots?
```

### Agreement

```text
Can both parties identify the same accepted terms?

Does a structured Offer reduce disagreement about the current deal?
```

### Verification

```text
Do users understand why an NFT can be verified differently
from freelance work?

Do they understand what VINSS can prove
and what still requires judgment?
```

### Two-sided protection

```text
Does the fulfiller feel protected after valid fulfillment?

Does the funder still feel protected against fake fulfillment?
```

### Privacy

```text
Can users correctly explain what remains private?

Do they understand that privacy does not eliminate all metadata?
```

### Evidence

```text
Does settlement evidence remain useful after the deal?

Would users intentionally share a Settlement Certificate?
```

---

## 39. Product Doctrine

The VINSS product can be summarized through several doctrines.

### Deal before feature

> Build around the lifecycle of a real transaction, not around available blockchain primitives.

### Conversation is not agreement

> Negotiation should remain flexible, but settlement should reference explicit accepted terms.

### Agreement defines economic roles

> Who funds, receives, and fulfills should follow the deal itself.

### Verification follows truth

> Use objective verification where possible and evidence/review where necessary.

### Protect both sides

> A fulfiller should not receive funds for fake fulfillment, and a funder should not receive the benefit and then reclaim everything unilaterally.

### Privacy is selective

> Hide what does not need to be public. Verify what needs to be proven.

### Evidence should retain context

> A transaction result is more useful when the user can understand what deal action it represents.

### Automation must earn authority

> The system should automate only when the relevant truth can actually be verified.

---

## 40. The Innovation in One Sentence

> **VINSS turns private communication into a structured deal lifecycle where agreement, protection, fulfillment, verification, settlement, and evidence remain connected, while the verification method adapts to the kind of truth each deal can actually prove.**

---

## 41. Short Innovation Statement

> **One private deal lifecycle. Different verification models. Two-sided settlement protection. Verifiable outcomes.**

---

## 42. Public-Facing Innovation Statement

> **VINSS moves a deal from private conversation to explicit agreement, protected settlement, and verifiable completion without forcing every type of transaction into the same verification rule or exposing more private context than necessary.**

---

## 43. The Evolution of VINSS

The product evolution can be summarized as:

```text
Encrypted On-Chain Messaging
        ↓
Private Application Coordination
        ↓
Private Negotiation
        ↓
Structured Agreement
        ↓
Deal-Linked Rekber
        ↓
Fulfillment
        ↓
Adaptive Verification
        ↓
Two-Sided Settlement
        ↓
Verifiable Evidence
        ↓
Portable Settlement Certificate
```

VINSS started from encrypted messaging.

Encrypted messaging remains important.

But it is no longer the destination.

> **Messaging is the substrate. The product is the deal lifecycle.**

---

## 44. Relationship to the Other Product Documents

```text
problem.md
    Why this product problem exists.

solution.md
    How VINSS proposes to solve it.

innovation.md
    What is differentiated about the product approach.

product-experience.md
    What the complete experience feels like for both parties.

target-users.md
    Who is most likely to have the problem intensely enough.

use-cases.md
    How the model applies to concrete transaction scenarios.

validation.md
    Which product assumptions are proven, unproven, or rejected.

README.md
    Concise public product overview.
```

The root repository README should remain shorter than these documents.

Its role is to explain VINSS quickly and direct readers into the deeper Product, Business, and Technical documentation.
