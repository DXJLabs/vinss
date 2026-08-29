# The Problem VINSS Is Built Around

VINSS starts from a workflow problem, not from a blockchain feature.

People making sensitive peer-to-peer deals often negotiate in one place, verify identity somewhere else, move money through a wallet, preserve evidence manually, and use a separate escrow service when trust is not sufficient.

That fragmentation creates room for impersonation, misunderstood terms, irreversible payment mistakes, weak transaction context, and unnecessary exposure of financial relationships.

The problem VINSS is investigating is:

> **How can two parties negotiate, agree, and settle a sensitive digital deal without splitting the deal across disconnected communication, payment, evidence, and escrow tools?**

This document explains the evidence behind that problem, what the evidence does **not** prove, and which assumptions VINSS still needs to validate with real users.

---

## 1. The Core Problem

A typical peer-to-peer digital deal can look like this:

```text
conversation
    ↓
identity / reputation check
    ↓
terms negotiated in chat
    ↓
wallet address copied manually
    ↓
payment sent separately
    ↓
screenshots / transaction hash shared
    ↓
disagreement or delivery
    ↓
manual dispute / escrow / refund process
```

Each individual tool may work correctly.

The weakness is the **gap between them**.

The conversation does not necessarily prove what was finally agreed.

The wallet transaction does not necessarily preserve the private business context behind the transfer.

A screenshot is not a reliable source of transaction authority.

An escrow transaction may be separate from the negotiation that created the obligation.

A user can therefore know that *something happened* without having one coherent place that answers:

```text
Who am I dealing with?

What exactly did we agree to?

Which version of the offer was accepted?

What payment belongs to this agreement?

What has already happened?

What still requires approval?

What evidence is authoritative?

What information should remain private?
```

That is the product problem VINSS is designed to investigate.

---

## 2. Evidence: Fraud and Impersonation Are Material Problems

Fraud and impersonation are not hypothetical edge cases.

The U.S. Federal Trade Commission reported that consumers lost more than **US$12.5 billion** to fraud in 2024, an increase of 25% from the previous year.

Within that total:

- investment scams produced about **US$5.7 billion** in reported losses;
- imposter scams produced about **US$2.95 billion** in reported losses;
- consumers reported greater combined losses through bank transfers and cryptocurrency than through all other payment methods combined.

In 2025, FTC data reported **US$3.5 billion** in losses from imposter scams, and nearly one in three fraud reports concerned impersonation.

### What this supports

It supports the claim that:

```text
identity ambiguity,
impersonation,
and transaction-context confusion
```

are economically meaningful problems.

### What this does not support

It does **not** prove that:

```text
VINSS prevents fraud,
VINSS would have prevented those losses,
fraud victims are automatically VINSS customers,
or the fraud-loss total represents VINSS's addressable market.
```

VINSS should never use broad fraud statistics as a market-size shortcut.

---

## 3. Evidence: Digital Communication Is a Major Scam Entry Point

The transaction often begins before money moves.

It begins with communication.

FTC analysis of cryptocurrency scams reported that almost half of people who reported losing crypto to a scam said the scam began with an advertisement, post, or message on social media.

Platforms cited in those reports included Instagram, Facebook, WhatsApp, and Telegram.

More recent FTC data for 2025 found that nearly **30%** of people who reported losing money to a scam said it started on social media, with reported losses reaching **US$2.1 billion**.

### Why this matters to the product problem

A payment system can verify a transaction while still leaving the surrounding negotiation vulnerable to:

```text
fake profiles,
copied wallet addresses,
changed terms,
out-of-context payment requests,
social engineering,
and inconsistent evidence.
```

The problem is therefore broader than payment execution alone.

The communication layer and transaction layer affect each other.

### What remains unproven

Public fraud data does not prove that moving a negotiation into a Deal Room will reduce fraud.

That is a **VINSS product hypothesis** and must be tested.

---

## 4. Evidence: Cryptocurrency Payments Can Be Difficult to Reverse

The FTC reported that more than 46,000 people said they lost more than **US$1 billion** in cryptocurrency to scams from the beginning of 2021 through March 2022.

The FTC highlighted an important property of crypto transfers:

```text
there may be no centralized institution
that can stop a suspicious payment,
and a completed crypto transfer may not be reversible.
```

This makes the quality of the workflow **before settlement** especially important.

Users need clarity before authorizing value movement.

### Product implication

For sensitive deals, the important question is not only:

> Can the blockchain execute this transfer?

It is also:

> Is this transfer connected to the agreement I actually intended to settle?

---

## 5. Evidence: Public Blockchains Create a Privacy Trade-Off

Public blockchains are valuable partly because transactions can be independently verified.

That same property can expose information that participants may not want to make broadly visible.

Depending on the transaction design, observers may be able to analyze:

```text
addresses,
balances,
transaction timing,
asset movement,
contract interactions,
and relationship patterns.
```

Starknet's own explanation of STRK20 private transfers makes the distinction explicit.

In a private STRK20 transfer, public observers can still see encrypted notes and protocol metadata required by the system, while the sender, receiver, amount, and private balances used in the transfer are not revealed.

### What this supports

It supports two simultaneous conclusions:

1. privacy for financial activity is a real product requirement;
2. privacy should never be described as making all metadata disappear.

### Product implication

A private deal product must explain:

```text
what stays private,
what becomes public,
what can be selectively disclosed,
and what remains observable as protocol metadata.
```

Privacy claims must be specific rather than absolute.

---

## 6. Supporting Industry Signal: Crypto Scams Continue to Evolve

Chainalysis estimated that at least **US$14 billion** flowed to identified scam addresses in 2025 and projected that the figure could exceed **US$17 billion** as additional illicit addresses are identified.

Its 2026 analysis also highlighted growth in impersonation tactics and the use of AI, phishing infrastructure, and more professionalized scam operations.

This is useful as an industry signal.

It should be treated differently from official government statistics.

### Interpretation rule

```text
FTC data
    = official reported consumer data

Chainalysis data
    = industry estimate based on on-chain attribution
```

Neither should be presented as the number of people who need VINSS.

---

## 7. The Underlying Workflow Failure

The public evidence establishes that:

```text
fraud is economically significant;

impersonation is common;

many scams begin in digital communication;

crypto transfers can be difficult to reverse;

public blockchain activity creates privacy trade-offs.
```

VINSS adds a product hypothesis on top of those facts:

> Part of the user risk and friction comes from the fact that negotiation, agreement, payment, evidence, and escrow are often handled as separate activities across separate tools.

That hypothesis is plausible.

It is **not yet proven by the external statistics above**.

It needs direct customer evidence.

---

## 8. A Second Problem: Both Parties Can Behave Adversarially

A protected deal cannot assume that only one side may act dishonestly.

The party providing the good, service, asset, or result can:

```text
disappear after funding;
miss the deadline;
claim completion without actually fulfilling;
submit the wrong item;
submit unusable or misleading evidence;
or manipulate an ambiguous completion condition.
```

The party funding the deal can also behave opportunistically:

```text
receive a useful result and refuse to pay;
receive a delivered item and deny receipt;
obtain a digital artifact and claim it was never delivered;
accept an on-chain asset and still attempt to block settlement;
or try to recover all funds after the counterparty has already performed.
```

This means the protection problem is **two-sided**.

VINSS should not be designed around:

> “Protect the buyer from the seller.”

The more accurate problem is:

> **How can a deal protect both parties from non-performance, false fulfillment, and opportunistic refusal to settle?**

---

## 9. A Third Problem: Different Deals Have Different Truth Conditions

Not every deal can answer “Was the obligation fulfilled?” in the same way.

That matters because a settlement rule that is safe for one deal type can be dangerous for another.

For example:

```text
NFT transfer
    can often be checked against an objective on-chain state.

Digital file delivery
    can prove that an artifact was delivered,
    but not necessarily that its quality satisfies the agreement.

Freelance work
    can prove that a submission exists,
    but quality and completeness may still require review.

Physical goods
    depend on shipping, delivery, condition, and real-world evidence.

Fiat payment
    cannot normally be verified by a blockchain without an external data source.

Custom agreements
    may use criteria that range from objective to highly subjective.
```

Therefore:

> **“Fulfillment submitted” cannot universally mean “release the money.”**

The product needs to distinguish between proof that an action happened and proof that the deal was successfully completed.

---

## 10. Three Classes of Deal Verification

VINSS can reason about deal verification through three broad classes.

### A. Objectively verifiable

Examples:

```text
NFT ownership transfer
on-chain token transfer
deterministic blockchain state
```

The relevant condition can be checked directly against an objective state.

These deals can support more deterministic settlement.

### B. Digitally provable, but quality is subjective

Examples:

```text
freelance work
digital goods
bounty submissions
```

The product may be able to prove that:

```text
a file,
artifact,
submission,
commit,
or result
```

was delivered at a particular time.

But that does not automatically prove:

```text
quality,
correctness,
fitness for purpose,
or compliance with every agreed requirement.
```

These deals need evidence plus review and dispute.

### C. Off-chain or physical

Examples:

```text
physical goods
bank / fiat payment
real-world services
some custom agreements
```

Important facts exist outside the blockchain.

These cases may require:

```text
delivery evidence,
counterparty confirmation,
external data,
an oracle,
manual review,
or dispute resolution.
```

No product should pretend that a smart contract automatically knows every real-world fact.

---

## 11. A Fourth Problem: Economic Roles Are Not the Same as Offer-Creation Order

Who proposes a deal first is not necessarily the party who should fund settlement.

Examples:

```text
A seller proposes:
"Sell laptop for 500 USDC."

The seller created the Offer,
but the buyer is normally the party funding the 500 USDC.
```

Or:

```text
A buyer proposes:
"I want to buy 1,000 STRK for IDR."

The buyer created the Offer,
but the crypto seller is the party providing the STRK side.
```

Therefore a universal rule such as:

```text
Offer creator = settlement funder
```

can misrepresent the economics of the deal.

The agreement needs to make explicit:

```text
who provides the settlement asset;
who receives it;
who has the fulfillment obligation;
what must happen before settlement;
when it must happen;
and how completion will be verified.
```

This is a product-model problem, not merely an interface detail.

---

## 12. Non-Performance and False Fulfillment Are Different Problems

VINSS should distinguish between:

### Non-performance

The obligated party does nothing until the agreed deadline.

Examples:

```text
freelancer never submits;
seller never ships;
digital-goods seller never delivers;
bounty participant never submits;
NFT seller never transfers;
fiat payer never provides payment evidence.
```

This creates a relatively simple question:

> Has any valid fulfillment process started before the deadline?

If not, the funder needs a safe path to recover funds.

### False or disputed fulfillment

The obligated party claims performance, but the other party disagrees.

Examples:

```text
empty or broken file;
wrong NFT;
fake tracking number;
incomplete work;
submission that does not satisfy bounty criteria;
fake bank-transfer screenshot.
```

This is not the same as non-performance.

A binary rule such as:

```text
something submitted
→ automatic release
```

would create an obvious attack surface.

---

## 13. The Funder Can Also Become the Adversarial Party

Protection becomes unfair if only the fulfiller is constrained.

Consider:

```text
valid work delivered
→ funder obtains source code
→ funder rejects
→ funder takes full refund
```

or:

```text
physical item delivered
→ buyer receives it
→ buyer claims non-delivery
→ buyer attempts refund
```

or:

```text
correct NFT transferred
→ buyer owns it
→ buyer refuses to release payment
```

A fair settlement model must therefore prevent:

> **unilateral recovery of all funds after meaningful fulfillment has already begun, unless the agreed verification policy permits it.**

Once valid fulfillment enters the verification stage, disagreement should move into:

```text
review,
mutual cancellation,
objective verification,
or dispute
```

rather than giving either side unilateral control.

---

## 14. Template Examples

| Deal type | Counterparty does nothing | Counterparty acts dishonestly | Funder acts dishonestly | Verification need |
| --- | --- | --- | --- | --- |
| Freelance | No work submission | Low-quality / false completion | Uses work, refuses settlement | Submission + review + dispute |
| Physical Goods | Never ships | Fake tracking / wrong item | Receives item, denies it | Delivery evidence + inspection + dispute |
| Digital Goods | Never delivers | Broken / wrong file | Obtains artifact, denies receipt | Delivery proof + review |
| Bounty | No result | Result misses criteria | Uses result, refuses reward | Criteria + submission + dispute |
| NFT Deal | No transfer | Wrong contract / token | Receives NFT, blocks settlement | Objective on-chain verification |
| Token Trade | Does not perform payment side | Fake payment evidence | Receives value, denies receipt | Rail-specific verification + dispute |
| Custom | No fulfillment | Manipulated evidence | Denies valid performance | Explicit verification policy |

This table does not claim every future VINSS template must use exactly these rules.

It describes the product problem that the verification model must account for.

---

## 15. Fragmentation Creates Five Specific User Problems

### 8.1 Agreement ambiguity

Chat is flexible, but flexibility can make the final agreement difficult to identify.

A conversation may contain:

```text
original proposal,
revision,
counterproposal,
clarification,
informal acceptance,
later correction.
```

When something goes wrong, both parties may point to different messages as the authoritative terms.

The product problem is not simply "chat is bad."

The problem is that ordinary chat is not designed to make a deal's state explicit.

---

### 8.2 Transaction-context separation

A blockchain transaction can prove that value moved.

It does not necessarily prove the private commercial meaning of that payment.

For example:

```text
payment for what?
under which offer?
before or after delivery?
full settlement or partial payment?
refundable or final?
who was expected to perform next?
```

The commercial context can remain trapped in chat or screenshots.

---

### 8.3 Identity and impersonation risk

Users often move between:

```text
social identity,
chat identity,
wallet identity,
and payment address.
```

Those identities can be confused or impersonated.

The problem is especially important when the user copies addresses manually or receives payment instructions through a communication channel that can be spoofed.

---

### 8.4 Weak evidence continuity

A transaction hash is useful evidence of a transaction.

A screenshot is useful human context.

A chat history contains negotiation context.

An escrow contract contains financial state.

But when these objects are separate, the user must manually reconstruct the story of the deal.

That creates an evidence-continuity problem.

---

### 8.5 Privacy leakage

A sensitive deal may involve information that neither party wants to publish:

```text
commercial terms,
counterparty relationship,
deliverable,
negotiated price,
payment rationale,
internal notes,
dispute evidence.
```

Yet the parties may still need verifiable financial settlement.

The product challenge is therefore not:

> hide everything.

It is:

> preserve useful verification while minimizing unnecessary disclosure.

---

## 16. The Problem Statement

The current VINSS problem statement is:

> **Parties conducting sensitive digital deals often have to move between chat, wallets, manual evidence, and escrow tools. The problem becomes harder because either party can fail to perform or act opportunistically, different deal types require different ways to verify fulfillment, and the party who created an Offer is not necessarily the party who should fund settlement. At the same time, cryptocurrency transfers can be difficult to reverse and public blockchain activity can expose financial relationships. This creates a need for a more structured way to connect communication, agreement, obligations, verification, settlement, and evidence without unnecessarily exposing the private context of the deal.**

This is a problem statement.

It is not a claim that VINSS has already solved the problem at scale.

---

## 17. What Is Supported by Public Evidence

The following statements are supported by the sources used in this document:

- Fraud and impersonation produce substantial reported losses.
- Cryptocurrency is used as a payment method in scams.
- Cryptocurrency transfers may be difficult or impossible to reverse.
- Many reported scams begin through digital/social communication.
- Public blockchain activity creates observable transaction metadata.
- Privacy technology can reduce the exposure of selected financial information while leaving some protocol metadata observable.

These are the **evidence layer**.

---

## 18. What Is Still a VINSS Hypothesis

The following statements must remain hypotheses until validated directly:

- Freelancers are an ideal first customer segment.
- OTC participants are an ideal first customer segment.
- Crypto teams are an ideal first customer segment.
- Marketplaces or wallets are an ideal distribution channel.
- Users will move meaningful negotiations from Telegram or WhatsApp into a dedicated Deal Room.
- Users prefer a structured encrypted deal timeline over their existing workflow.
- Users will pay for private deal coordination.
- Users will pay for Rekber / escrow protection.
- Privacy of deal context materially increases conversion or repeat usage.
- Linking negotiation and settlement reduces meaningful user mistakes.
- Users understand and trust the privacy model.
- Users return frequently enough to support the intended business model.
- Users understand the distinction between fulfillment evidence and successful completion.
- Users can correctly identify who funds and who fulfills each deal type.
- Template-specific verification reduces disputes or settlement confusion.
- Users trust deterministic settlement more when fulfillment is objectively verifiable.
- Users accept dispute or review requirements for subjective and off-chain deals.

These assumptions require:

```text
interviews,
observed behavior,
prototype tests,
pilots,
transaction data,
retention data,
and willingness-to-pay evidence.
```

---

## 19. Validation Questions

Customer discovery should not begin with:

> Would you use VINSS?

Better questions investigate existing behavior.

### Workflow

```text
Tell us about the last high-value digital deal you completed.

Where did the conversation happen?

How were the final terms recorded?

How did you verify the counterparty?

How did you exchange wallet/payment details?

Was escrow involved?

What evidence did you keep afterward?
```

### Risk

```text
What part of the transaction made you most uncomfortable?

Have payment instructions ever changed during a deal?

Have you ever worried that an account or wallet address was impersonated?

What happens when the two parties disagree about the final terms?
```

### Privacy

```text
Which information in a deal would you not want public?

Does transaction privacy matter for the deal itself,
or only for the transfer?

Who would you ever need to disclose the transaction to?
```

### Willingness to pay

```text
What do you currently pay for escrow, marketplace protection,
payment infrastructure, or deal administration?

When is protection valuable enough to justify a fee?

Which part of the workflow would you refuse to pay for?
```

The objective is to discover real behavior, not to obtain polite agreement with the product idea.

---

## 20. Evidence vs. Hypothesis Matrix

| Statement | Current classification |
| --- | --- |
| Fraud causes substantial financial losses | Public evidence |
| Impersonation is a major fraud category | Public evidence |
| Social communication is a common scam entry point | Public evidence |
| Crypto payments can be difficult to reverse | Public evidence |
| Public blockchain activity creates privacy trade-offs | Public evidence |
| Deal workflow fragmentation is painful enough to change behavior | Product hypothesis |
| A private Deal Room is a preferred solution | Product hypothesis |
| Users will pay for private coordination | Business hypothesis |
| Users will pay for Rekber protection | Business hypothesis |
| Freelancer is the best beachhead | Market hypothesis |
| OTC is the best beachhead | Market hypothesis |
| VINSS reduces fraud | Unproven outcome hypothesis |
| VINSS has product-market fit | Not established |

---

## 21. What VINSS Must Not Claim From This Evidence

Do not turn the problem evidence into claims such as:

```text
VINSS prevents scams.

VINSS eliminates impersonation.

VINSS makes blockchain transactions completely invisible.

VINSS would have prevented the FTC-reported losses.

The fraud-loss figures are VINSS's market size.

Freelancers already want VINSS.

OTC desks already want VINSS.

Users have proven willingness to pay.

VINSS has product-market fit.
```

Those conclusions are not supported by the evidence in this document.

---

## 22. Product Requirements Derived From the Problem

Without prescribing the implementation, the problem implies that a useful product should make it easier for users to:

1. keep the relevant deal context together;
2. distinguish communication from explicit agreement;
3. know which agreement is currently authoritative;
4. connect value movement to the intended deal;
5. understand which party must act next;
6. preserve verifiable evidence without exposing unnecessary business context;
7. recover the deal state after interruption;
8. reduce ambiguity before an irreversible action;
9. make privacy boundaries understandable;
10. use stronger settlement protection when trust is insufficient;
11. define who funds, who receives, and who fulfills before settlement begins;
12. define a fulfillment deadline;
13. choose a verification method appropriate to the type of deal;
14. distinguish non-performance from disputed performance;
15. prevent either party from unilaterally exploiting the settlement after meaningful fulfillment begins.

Whether VINSS's current design satisfies those requirements is evaluated in the separate Solution, Product Experience, Validation, and Technical documentation.

---

## 23. Product Principle

The core product principle derived from this problem is:

> **Do not make users reconstruct a sensitive deal from disconnected chat messages, wallet transactions, screenshots, and escrow state if the product can preserve that context coherently.**

A second principle is equally important:

> **Verification should not require publishing more private business context than the transaction actually needs.**

---

## 24. Validation Discipline

VINSS should maintain three separate categories of statements:

```text
PROVEN EXTERNALLY
    public evidence that the underlying problem exists

OBSERVED IN VINSS
    evidence from actual product usage and testing

HYPOTHESIS
    what VINSS currently believes but still needs to test
```

Moving a statement from one category to another requires evidence.

A product roadmap does not convert a hypothesis into a fact.

A successful technical test does not establish customer demand.

A user interview does not establish retention.

A transaction does not establish product-market fit.

---

## 25. When This Document Should Change

Update this document when there is material new evidence about:

- customer workflows;
- repeated user pain;
- user segment priority;
- willingness to pay;
- fraud/impersonation behavior relevant to the target market;
- privacy expectations;
- adoption or retention;
- reasons users abandon the current workflow;
- evidence that a stated hypothesis is false.

Do not update the problem statement merely because a new technical feature is implemented.

---

## References

### [1] Federal Trade Commission — Fraud losses in 2024

**New FTC Data Show a Big Jump in Reported Losses to Fraud to $12.5 Billion in 2024**

https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024

Used for:

- reported fraud losses in 2024;
- investment scam losses;
- imposter scam losses;
- payment-method context.

### [2] Federal Trade Commission — Imposter scams in 2025

**FTC Data Show People Reported Losing $3.5 Billion to Imposter Scams in 2025**

https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025

Used for:

- reported imposter scam losses in 2025;
- prevalence of imposter scams in fraud reports.

### [3] Federal Trade Commission — Cryptocurrency scams

**Reports show scammers cashing in on crypto craze**

https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2022/06/reports-show-scammers-cashing-crypto-craze

Used for:

- reported cryptocurrency scam losses;
- irreversibility context;
- role of social-media communication.

### [4] Federal Trade Commission — Social-media scams in 2025

**Reported losses to scams on social media eight times higher than in 2020**

https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2026/04/reported-losses-scams-social-media-eight-times-higher-2020

Used for:

- share of reported money-loss scams beginning on social media;
- reported social-media scam losses in 2025.

### [5] Starknet — Privacy and STRK20

**Privacy Is Now Live on Starknet**

https://www.starknet.io/blog/privacy-live-on-starknet/

Used for:

- distinction between private transaction data and observable protocol metadata;
- description of what private STRK20 transfers hide from public observers.

### [6] Chainalysis — Industry scam estimate

**2026 Crypto Crime Report: Scams**

https://www.chainalysis.com/blog/crypto-scams-2026/

Used only as an industry estimate for:

- scam-address inflows in 2025;
- evolving impersonation and scam infrastructure.

Chainalysis estimates are not treated as official government statistics or as VINSS market-size data.

---

## Related Product Documentation

```text
problem.md             ← this document
solution.md            ← how VINSS proposes to address the problem
innovation.md          ← what is differentiated about the approach
product-experience.md  ← the end-to-end user journey
target-users.md        ← customer hypotheses and beachhead candidates
use-cases.md           ← concrete deal scenarios
validation.md          ← assumptions, experiments, and evidence
README.md              ← concise product overview
```
