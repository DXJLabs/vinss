# VINSS Product Documentation

> **Private deals. Clear agreements. Protected settlement. Verifiable completion.**

VINSS is a **Private Deal Room on Starknet** for two parties who need to move from private conversation to explicit agreement, protected settlement, and verifiable evidence without unnecessarily exposing the commercial context of the deal.

VINSS is not designed as a general messenger.

It is designed around a transaction.

```text
Private Conversation
        ↓
Structured Offer
        ↓
Accepted Agreement
        ↓
Rekber
        ↓
Fulfillment
        ↓
Verification
        ↓
Settlement
        ↓
Optional Settlement Certificate
```

The product thesis is simple:

> **A deal should move from conversation → agreement → settlement → evidence without forcing its private context into public view.**

---

## The Problem

Many direct digital deals are still completed across disconnected tools:

```text
Telegram / Discord / DM
        ↓
terms buried in conversation
        ↓
wallet address exchange
        ↓
direct payment / middleman / escrow
        ↓
screenshots + transaction hashes
```

This creates several problems at once:

- the final agreement can become ambiguous;
- payment becomes separated from the context that created it;
- either party can disappear or act opportunistically;
- evidence becomes fragmented;
- public blockchain activity can expose financial relationships;
- different kinds of deals require different ways to determine whether fulfillment actually happened.

VINSS does not claim that these problems automatically prove demand for VINSS.

Public evidence supports the broader problem space.

Customer demand, willingness to switch workflows, willingness to pay, and the best initial segment still require direct validation.

See [`problem.md`](problem.md).

---

## The Solution

VINSS turns a private conversation into a structured deal lifecycle.

The product separates:

```text
discussion
from
agreement
```

and:

```text
agreement
from
payment
```

An accepted Offer establishes the deal.

Rekber protects the settlement.

Fulfillment moves the deal into verification.

Verification determines the legitimate settlement path.

The final result remains connected to the original agreement.

See [`solution.md`](solution.md).

---

## The Core Innovation

VINSS did not begin from the idea of adding escrow to chat.

It began from encrypted application coordination built around privacy infrastructure.

The product evolves that direction into:

```text
Encrypted Messaging
        ↓
Private Negotiation
        ↓
Structured Agreement
        ↓
Role-Aware Rekber
        ↓
Fulfillment
        ↓
Adaptive Verification
        ↓
Two-Sided Settlement
        ↓
Verifiable Evidence
```

The important product innovation is not one feature.

It is the continuity between these stages.

> **Messaging is the substrate. The product is the deal lifecycle.**

See [`innovation.md`](innovation.md).

---

## One Deal Lifecycle, Different Verification Models

Not every deal has the same kind of truth.

VINSS therefore should not use one blind settlement rule for every Deal Type.

### Objectively verifiable

Examples:

```text
NFT ownership
on-chain asset transfer
deterministic blockchain state
```

These can support more deterministic settlement.

### Digitally provable, but quality is subjective

Examples:

```text
freelance
digital goods
bounty
```

VINSS may be able to prove delivery or submission, while quality still requires review.

### Off-chain or physical

Examples:

```text
physical goods
fiat payment
real-world custom deals
```

These require evidence, confirmation, external data, or dispute.

The product principle is:

> **The more objectively fulfillment can be verified, the less discretion humans or Agents should have over settlement. The more subjective or off-chain the deal is, the more important evidence, review, and dispute become.**

---

## Two-Sided Protection

VINSS must protect both sides of the deal.

The fulfiller can:

```text
disappear;
miss the deadline;
submit fake fulfillment;
send the wrong item;
claim completion without satisfying the agreement.
```

The funder can also:

```text
receive useful work and refuse payment;
receive a digital artifact and deny receipt;
receive a physical item and deny delivery;
receive the correct NFT and still attempt to block settlement.
```

The universal logic is therefore not:

```text
anything submitted
→ automatic release
```

and not:

```text
funder can always refund
until the end.
```

Instead:

```text
NO VALID FULFILLMENT BY DEADLINE
→ funder recovery

VALID FULFILLMENT ENTERS VERIFICATION
→ unilateral full refund becomes restricted

VERIFIED SUCCESS
→ release

MUTUAL CANCELLATION
→ refund / agreed split

DISAGREEMENT
→ dispute

OBJECTIVE PROOF
→ deterministic settlement
```

---

## Economic Roles Come From the Agreement

VINSS should not assume:

```text
Offer creator = funder
```

because the person who proposes a deal first is not always the person who provides the settlement asset.

Example:

```text
Seller:
"I sell this laptop for 500 USDC."
```

The seller created the Offer.

The buyer may still be the party who funds the 500 USDC.

The accepted agreement should make clear:

- who funds;
- who receives;
- who fulfills;
- what must be fulfilled;
- the deadline;
- the verification method;
- the review period.

---

## Deal Types

VINSS can apply the same deal lifecycle to different transaction types.

Examples include:

| Deal type | Fulfillment | Verification direction |
| --- | --- | --- |
| Freelance | Work submission | Submission + review |
| Physical Goods | Shipment / delivery | Delivery evidence + inspection |
| Digital Goods | Artifact delivery | Delivery proof + review |
| Bounty | Result submission | Criteria + review |
| NFT Deal | NFT transfer | Objective on-chain verification |
| Token Trade | Asset / payment side | Rail-specific verification |
| Custom | Agreed obligation | Explicit agreed verification policy |

The important idea is not the number of templates.

> **A Deal Type should change how the obligation is understood and verified, not merely change the label in the interface.**

See [`use-cases.md`](use-cases.md).

---

## Product Experience

A successful VINSS experience should allow both parties to answer:

```text
What did we agree?

Who funds?

Who fulfills?

What must happen next?

What is the deadline?

How is fulfillment verified?

Can funds be refunded?

When does dispute become necessary?

What is the final settlement state?

What evidence remains?
```

The product should surface state before buttons.

Users should not have to understand protocol internals to know what action is legitimate.

See [`product-experience.md`](product-experience.md).

---

## Privacy Principle

VINSS does not define privacy as:

```text
hide everything
```

The product principle is:

> **Hide what does not need to be public. Verify what needs to be proven.**

Private deal context may include:

- messages;
- commercial terms;
- attachments;
- negotiated price;
- counterparty relationship;
- sensitive dispute evidence.

Verifiable outcomes may include:

- settlement state;
- transaction evidence;
- eligible final-state proof;
- optional Settlement Certificate.

VINSS does not claim:

- perfect anonymity;
- zero metadata;
- that nothing is publicly observable;
- that off-chain truth can always be automatically verified.

---

## Settlement Evidence

A successful deal should not end with only:

```text
Completed
```

The Deal Room should preserve understandable evidence of what happened.

The evidence layer connects:

```text
agreement
→ Rekber
→ fulfillment
→ verification
→ settlement result
```

without requiring the full private negotiation to become public.

---

## Settlement Certificate

An eligible completed settlement may produce an optional **Settlement Certificate**.

Its role is:

> **portable, verifiable evidence that the represented settlement reached a valid completed state.**

It is not intended to prove:

- quality of every deliverable;
- authenticity of every physical good;
- truth of every statement made in the deal;
- absence of every possible off-chain dispute.

It proves the settlement fact represented by VINSS.

---

## Who VINSS May Serve

VINSS is exploring users who conduct direct, sensitive, peer-to-peer digital deals where:

```text
agreement clarity matters;
settlement risk exists;
privacy matters;
evidence matters;
the counterparty is not fully trusted.
```

Candidate segments include:

- crypto-native freelancers and service providers;
- digital-goods sellers;
- OTC participants;
- direct NFT or on-chain asset traders;
- crypto-native teams;
- bounty creators and contributors;
- wallet or marketplace partners.

These remain candidate segments.

VINSS has not yet established a proven beachhead or product-market fit.

See [`target-users.md`](target-users.md).

---

## What Makes a Good Early User

A strong early user likely:

- completes direct deals repeatedly;
- negotiates before payment;
- sometimes works with new or pseudonymous counterparties;
- uses chat plus wallets plus manual evidence today;
- has enough value at risk to care about protection;
- wants some commercial context to remain private;
- has a workflow that VINSS can verify meaningfully;
- is willing to change behavior and pay if the outcome is better.

The best early user should be discovered through behavior, not selected by intuition alone.

---

## Validation Discipline

VINSS separates five kinds of evidence:

```text
Problem Evidence
Technical Evidence
Usability Evidence
Customer Evidence
Business Evidence
```

These are not interchangeable.

For example:

```text
contract test passes
≠
users understand the workflow

users understand the workflow
≠
users will pay

one paid transaction
≠
product-market fit
```

See [`validation.md`](validation.md).

---

## Current Product Hypotheses

VINSS is currently testing assumptions such as:

- users prefer one continuous Deal Room over fragmented tools;
- structured Offers reduce agreement ambiguity;
- deal-linked Rekber improves trust;
- role-aware settlement reduces mistakes;
- adaptive verification improves settlement clarity;
- two-sided protection increases confidence for both parties;
- privacy of deal context influences product choice;
- settlement evidence has value after the transaction;
- users are willing to pay enough to support sustainable operation.

These should remain hypotheses until real usage supports them.

---

## What VINSS Can Responsibly Claim

VINSS can say:

> **VINSS is building a private Deal Room that connects communication, structured agreement, Rekber, fulfillment, verification, settlement, and evidence.**

VINSS can also say:

> **The product is designed to use different verification approaches for different kinds of deals.**

VINSS should not claim, without sufficient evidence:

```text
VINSS prevents all scams.

VINSS eliminates counterparty risk.

VINSS has zero metadata.

VINSS automatically knows every off-chain truth.

VINSS has proven willingness to pay.

VINSS has a validated beachhead.

VINSS has product-market fit.
```

---

## Product Documentation

Read the product documentation in this order:

1. [`problem.md`](problem.md)
   The underlying problem, evidence, and hypothesis boundaries.

2. [`solution.md`](solution.md)
   How VINSS proposes to solve the problem.

3. [`innovation.md`](innovation.md)
   What is differentiated about the product approach.

4. [`product-experience.md`](product-experience.md)
   The complete user journey from room creation to settlement.

5. [`target-users.md`](target-users.md)
   Candidate customer segments, ICP hypotheses, and beachhead logic.

6. [`use-cases.md`](use-cases.md)
   Concrete scenarios across different Deal Types.

7. [`validation.md`](validation.md)
   What is supported, tested, observed, unknown, or still hypothetical.

---

## Product Thesis

VINSS started from encrypted messaging.

But encrypted messaging is not the destination.

> **VINSS turns private communication into private economic coordination — and turns settlement into evidence.**

The product succeeds only if real users choose that workflow for real deals, return to use it again, and value it enough to support a sustainable business.
