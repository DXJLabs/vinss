# VINSS Dispute & Settlement Legal Notes

> **Purpose:** identify the legal, contractual, governance, consumer-protection, evidence, privacy, liability, and dispute-resolution questions created by the current VINSS Rekber dispute and settlement architecture.

**Status:** Product-law issue spotting
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** This document is not legal advice. It does not conclude that the VINSS dispute mechanism is arbitration, mediation, adjudication, escrow, a court process, or any other legally recognized dispute-resolution procedure in a specific jurisdiction.

---

# 1. Technical Resolution Is Not Automatically Legal Arbitration

VINSS must distinguish:

```text
smart-contract state transition
        ≠
commercial dispute resolution
        ≠
consumer ADR
        ≠
legal arbitration
        ≠
court judgment
```

A technical resolver can determine an on-chain economic outcome without becoming a legal arbitrator.

Likewise:

```text
settlement complete on-chain
        ≠
all legal claims between the parties are extinguished.
```

Product copy, Terms, support material, and Agent output should preserve this distinction.

---

# 2. Current Rekber Dispute Context

The current VINSS settlement flow can include:

```text
Accepted Offer
        ↓
Rekber setup
        ↓
Funded
        ↓
Fulfillment
        ↓
Review
        ↓
Approve / Revision / Refund / Dispute
        ↓
Release / Refund / Resolution
        ↓
Claim
        ↓
Settled
```

Dispute is therefore one path inside a larger contract state machine.

Legal analysis should not treat the dispute feature as an isolated chatbot or customer-support tool.

It can affect who receives settlement principal.

---

# 3. Current Resolver Economic Boundary

The current technical design constrains dispute resolution to an exact allocation between payer and payee.

The core invariant is:

```text
payer_amount + payee_amount = custody_principal
```

The resolver cannot use the dispute-resolution mechanism to make itself the beneficiary of settlement principal.

The permitted economic outcome is a split between the two settlement parties.

Examples:

```text
100% payer / 0% payee

75% payer / 25% payee

50% payer / 50% payee

0% payer / 100% payee
```

provided that the total equals the custody principal.

Each party later claims its own authorized share.

This bounded authority is a material technical fact.

It does not itself answer the legal status of the resolver.

---

# 4. Resolver Authority Must Be Described Exactly

For legal review, document:

```text
Who appoints the resolver?

Who can replace the resolver?

Who controls the resolver key?

Is the resolver DXJ Labs?

Is it a separate entity?

Is it a human?

Is it a multisig?

Is it an Agent-assisted human process?

Can the resolver act automatically?

Can the resolver see private evidence?

Can the resolver authorize a full payer allocation?

Can the resolver authorize a full payee allocation?

Can the resolver authorize a partial split?

Can the resolver receive principal?

Can the resolver redirect principal to a third party?

Can the resolver freeze an active Rekber?

Can the resolver reverse a completed claim?

Can the resolver act outside a formal dispute state?
```

Do not use broad descriptions such as:

```text
the Agent resolves disputes
```

unless that is literally the authority model.

---

# 5. Resolver Cannot Be Described as a Court or Judge

Avoid describing the resolver as:

```text
court;
judge;
tribunal;
legal authority;
government authority;
final court;
binding legal judge.
```

unless a legally recognized structure actually exists.

Preferred factual terminology:

```text
Dispute
Resolver
Resolution
Evidence
Recommended outcome
Authorized split
Settlement state
```

The UI can be strong and understandable without borrowing legal institutional language.

---

# 6. Arbitration Requires a Separate Legal Structure

Legal arbitration normally involves more than:

```text
software chooses a split.
```

Depending on governing law, relevant elements can include:

```text
a valid arbitration agreement;
scope of disputes submitted;
appointment of arbitrator(s);
independence/impartiality;
procedural fairness;
notice;
opportunity to present a case;
seat of arbitration;
governing procedural law;
award requirements;
challenge/set-aside rules;
court supervision;
recognition/enforcement.
```

UNCITRAL's Model Law on International Commercial Arbitration addresses matters including the arbitration agreement, tribunal composition, jurisdiction, court intervention, interim measures, awards, and recognition/enforcement.

Official source:

https://uncitral.un.org/en/texts/arbitration/modellaw/commercial_arbitration

The existence of a VINSS resolver should not be represented as satisfying those requirements.

---

# 7. Do Not Accidentally Create Arbitration Language

Terms and marketing should avoid statements such as:

```text
By using VINSS you agree that the Agent is your arbitrator.

The resolver acts as a court.

VINSS arbitration is legally final worldwide.

The on-chain split is an arbitral award.

The Settlement Certificate is a court-enforceable judgment.
```

unless counsel intentionally designs that framework.

Preferred approach:

```text
The VINSS dispute mechanism determines the settlement outcome
available under the Rekber contract.

Legal rights outside VINSS may continue to exist subject to
applicable law and the Terms.
```

Exact public wording requires jurisdiction-specific review.

---

# 8. Governing Law Is Separate From Smart-Contract Law

The smart contract has deterministic code rules.

That is not the same as identifying:

```text
governing law of VINSS Terms;
governing law of the user-to-user Offer;
law applicable to consumer rights;
law applicable to arbitration/ADR;
law applicable to property/custody;
law applicable to token transfers.
```

Terms should eventually determine an appropriate governing-law approach.

Mandatory local rules may override contractual choices in some cases.

---

# 9. Forum Is Separate From Rekber Resolution

The product should distinguish:

```text
Where a Rekber dispute is resolved technically
```

from:

```text
Where a legal claim against DXJ Labs is heard
```

and:

```text
Where a legal claim between the two users is heard.
```

Possible legal forums can include:

```text
court;
statutory consumer ADR;
contractual arbitration;
regulator complaint;
ombudsman;
other mandatory process.
```

The Rekber resolver does not automatically replace those forums.

---

# 10. User-to-User Dispute vs Complaint Against VINSS

Examples:

```text
Payee did not deliver
        =
user-to-user Rekber dispute
```

```text
VINSS displayed the wrong fee
        =
product complaint
```

```text
VINSS disclosed private evidence incorrectly
        =
privacy / product complaint
```

```text
Resolver had a conflict of interest
        =
resolver-governance / product complaint
```

These processes should not be collapsed into one legal category.

---

# 11. Consumer ADR Is a Separate Framework

Where VINSS serves consumers, local consumer alternative-dispute-resolution rules may apply independently of the Rekber resolver.

In the European Union, Directive 2013/11/EU establishes a framework for alternative dispute resolution of certain consumer disputes through qualifying ADR entities and sets quality requirements including independence, impartiality, transparency, effectiveness, and fairness.

Official source:

https://eur-lex.europa.eu/eli/dir/2013/11/oj/eng

The directive has also been amended, so EU launch analysis should use the then-current consolidated framework and national implementation.

Do not assume:

```text
VINSS Resolver
        =
EU ADR entity.
```

---

# 12. UK Arbitration Law Is Also Separate

For England, Wales, and Northern Ireland, the Arbitration Act 2025 came into force on **1 August 2025**, amending the Arbitration Act 1996 framework.

Official commencement instrument:

https://www.legislation.gov.uk/uksi/2025/905/contents/made

This is relevant only if VINSS intentionally adopts a legally valid arbitration model with the relevant UK nexus.

The existence of a technical resolver does not itself place the Rekber mechanism inside the Arbitration Act framework.

---

# 13. Commercial Arbitration vs Consumer Dispute

Consumer arbitration can be subject to additional restrictions or fairness requirements.

Therefore a single clause should not assume:

```text
business-to-business deal
```

and:

```text
consumer-to-business deal
```

are legally identical.

For every targeted jurisdiction, determine:

```text
Can consumer arbitration be required?

What form of assent is needed?

What fairness standards apply?

Are certain disputes non-arbitrable?

Can consumers retain access to courts/regulators?

Are fee or venue terms restricted?

Are class/group rights affected?

Are mandatory ADR mechanisms applicable?
```

---

# 14. Resolver Independence

If the resolver is operated or appointed by DXJ Labs, document the conflict model.

Questions:

```text
Does DXJ Labs earn fees from the transaction?

Does DXJ Labs benefit economically from a particular outcome?

Can the resolver be removed for an unfavorable decision?

Is compensation linked to case outcome?

Does resolver performance affect commercial incentives?

Can support staff influence resolution?

Can founders/admins override decisions?
```

A conflict policy should exist before describing the resolver as:

```text
independent
```

or:

```text
neutral.
```

---

# 15. Resolver Conflict Policy

Minimum policy areas:

```text
self-interest;
financial relationship;
personal relationship;
prior involvement;
counterparty relationship;
token holdings;
employment;
advisory relationship;
case-specific bias;
technical conflict.
```

Potential process:

```text
conflict identified
        ↓
disclosure
        ↓
recusal / replacement where required
        ↓
new resolver
        ↓
case continues
```

Do not promise recusal if the technical architecture cannot replace the resolver safely.

---

# 16. Resolver Governance Record

Maintain:

| Field | Required fact |
|---|---|
| Resolver identity | Wallet/entity |
| Appointment authority | Exact actor |
| Removal authority | Exact actor |
| Technical powers | Exact contract calls |
| Economic limits | Bounded payer/payee split |
| Evidence access | Categories |
| Conflict policy | Reference |
| Confidentiality | Contract/policy |
| Retention | Period/policy |
| Security | Key/access controls |
| Incident process | Reference |
| Last reviewed | Date |

Any resolver change should trigger legal and security review.

---

# 17. Agent Is Not the Resolver Unless It Actually Holds Authority

Separate:

```text
Agent analysis
```

from:

```text
resolver authorization.
```

The Agent may:

```text
assemble chronology;
summarize Offer terms;
summarize Fulfillment;
compare evidence;
identify inconsistencies;
apply a policy rubric;
recommend an outcome.
```

That does not necessarily mean the Agent can execute:

```text
authorize_dispute_resolution.
```

Public documentation should identify the actual authority chain.

---

# 18. No Unconstrained AI Fund-Moving Authority

An LLM should not have unconstrained authority to:

```text
release;
refund;
split;
freeze;
redirect;
seize
```

settlement principal based solely on generated output.

If automation is introduced, define:

```text
deterministic limits;
policy rules;
human review threshold;
authentication;
transaction authorization;
maximum scope;
audit trail;
rollback/incident process;
model/provider failure handling.
```

The contract's principal-conservation invariant remains a critical safety boundary.

---

# 19. Evidence Should Be Purpose-Limited

A dispute does not automatically justify disclosure of the entire Deal Room.

Preferred evidence flow:

```text
Dispute opened
        ↓
party selects relevant evidence
        ↓
evidence package created
        ↓
authorized resolver receives minimum necessary material
        ↓
resolution
        ↓
limited case record retained
```

Avoid:

```text
automatic full-room export;
automatic disclosure of unrelated Messages;
publishing private evidence on-chain;
indefinite retention by default.
```

---

# 20. Evidence Categories

Potential evidence can include:

```text
Offer terms;
Counter / Acceptance record;
Fulfillment record;
chat excerpt;
attachment;
code delivery;
file hash;
tracking information;
receipt;
transaction hash;
NFT ownership state;
token transfer;
timestamp;
screenshot;
photo;
identity information;
payment evidence;
external platform evidence;
expert statement.
```

Every category has different reliability and privacy implications.

---

# 21. Evidence Commitment vs Evidence Content

Keep separate:

```text
evidence commitment / hash
```

from:

```text
underlying evidence content.
```

A commitment can help demonstrate that specific data existed or was referenced.

It does not automatically prove:

```text
truth;
authenticity;
ownership;
context;
real-world performance;
identity.
```

Do not market cryptographic commitments as proof of facts they do not establish.

---

# 22. On-Chain Evidence

On-chain evidence can objectively establish some facts.

Examples:

```text
wallet sent transaction;
token transferred;
NFT owner at a block;
contract emitted event;
timestamp/block range;
specific public state.
```

But even objective on-chain facts can require interpretation.

Example:

```text
NFT transferred
        ≠
every off-chain representation about that NFT was true.
```

---

# 23. Off-Chain Evidence

Off-chain evidence can include:

```text
delivery files;
screenshots;
receipts;
shipping records;
photos;
messages;
documents;
identity records.
```

Potential issues:

```text
tampering;
forgery;
missing context;
metadata;
privacy;
copyright;
confidentiality;
malware;
retention;
cross-border transfer.
```

The resolver process should define how reliability is assessed without pretending that every item can be cryptographically verified.

---

# 24. Objective Verification

Objective verifier paths can reduce subjective decision-making where the parties agreed on a machine-verifiable condition.

Examples:

```text
NFT ownership;
token transfer;
specific contract event;
blockchain state.
```

Document:

```text
what the verifier checks;
which data source it trusts;
who controls the verifier;
how it handles reorg/finality;
what happens if external data is wrong;
what settlement transition follows;
whether the verifier can be replaced.
```

Objective does not mean infallible.

---

# 25. Real-World Fulfillment

Physical goods and off-chain services create additional uncertainty.

Examples:

```text
Was the package actually delivered?

Was it empty?

Was the item authentic?

Did the freelancer meet subjective quality requirements?

Did the digital file contain malware?

Was a promised license valid?
```

The product should not imply that smart-contract settlement eliminates real-world fact disputes.

---

# 26. Evidence Authenticity

Where evidence authenticity matters, consider:

```text
original file;
hash;
timestamp;
source system;
digital signature;
chain event;
issuer verification;
metadata;
custody/history;
counterparty admission.
```

Do not invent a universal evidentiary standard without jurisdiction and use-case analysis.

---

# 27. Evidence Privacy

Dispute evidence may contain sensitive information.

Potential data:

```text
full names;
addresses;
phone numbers;
financial records;
shipping details;
private messages;
employment data;
identity documents;
photos;
account identifiers;
commercial secrets.
```

Apply:

```text
minimum necessary disclosure;
case-level access;
confidentiality;
retention schedule;
security;
deletion where permitted;
vendor restrictions.
```

See `privacy-and-data-protection.md`.

---

# 28. Evidence Access Logging

Record:

```text
case id;
user submitting;
resolver accessing;
timestamp;
evidence item;
action;
download/export if applicable;
deletion/archive event.
```

Access logs should themselves avoid unnecessary sensitive content.

---

# 29. Evidence Retention

Define retention based on:

```text
case lifecycle;
appeal/review;
legal claims period;
consumer complaint obligations;
AML/sanctions duties if applicable;
privacy law;
security needs.
```

Do not retain all private evidence forever merely because storage is inexpensive.

---

# 30. Confidentiality

If dispute evidence is private, define confidentiality duties for:

```text
DXJ Labs;
resolver;
Agent provider;
support staff;
hosting/database provider;
external expert;
other vendor.
```

Do not promise:

```text
strictly confidential
```

without identifying lawful disclosure exceptions and actual vendor access.

---

# 31. Resolver Decision Standard

A resolver should not operate on an undisclosed standard.

Potential standard categories:

```text
agreed Offer terms;
documented Fulfillment conditions;
objective evidence;
burden of proof;
timeliness;
material breach;
partial performance;
mutual agreement;
defined product policy.
```

The standard should be understandable before a dispute occurs.

---

# 32. Do Not Invent Legal Burdens of Proof

Terms such as:

```text
beyond reasonable doubt;
preponderance of evidence;
clear and convincing evidence
```

have legal meanings in particular systems.

Do not import them casually into VINSS product policy.

Use a product-specific evidence standard unless counsel intentionally adopts a legal standard.

---

# 33. Partial Performance

The resolver's split capability can support cases where neither party should receive 100%.

Potential scenario:

```text
scope partially completed
        ↓
evidence reviewed
        ↓
partial payer/payee allocation
```

Terms should explain that a split is technically possible.

Do not promise a specific split formula unless it is actually fixed.

---

# 34. Mutual Cancellation

Mutual cancellation should be legally and technically distinguished from:

```text
resolver-imposed refund.
```

Record:

```text
who consents;
what amount returns;
what fee remains;
whether dispute is closed;
whether claims remain;
what state is emitted.
```

Mutual agreement can reduce dispute risk but does not automatically waive mandatory legal rights.

---

# 35. Refund After Fulfillment

A product should avoid implying that a Funder always has unilateral refund power after valid Fulfillment.

Legal and technical rules should match.

Preferred principle:

```text
before valid Fulfillment / applicable deadline
        → refund path may be available

after valid Fulfillment
        → review / approve / dispute / mutual resolution
```

The exact state transitions are governed by current source and must be documented accurately.

---

# 36. Settlement Finality

Different meanings of finality must be separated.

```text
contract state finality;
blockchain finality;
product dispute finality;
legal claim finality.
```

Example:

```text
Rekber settled
```

can mean:

```text
the smart contract reached a terminal settlement state
```

without meaning:

```text
no party can ever sue the other party.
```

---

# 37. Claim Step

If resolution authorizes funds but each party must later claim:

```text
resolution authorized
        ≠
funds already received.
```

UI and Terms should state the distinction.

Preferred state language:

```text
Resolution authorized
Claim available
Claim completed
Settlement complete
```

Avoid:

```text
Paid
```

before the transfer actually occurs.

---

# 38. Duplicate Settlement Protection

Contract invariants should prevent mutually exclusive settlement paths from executing more than once.

Legal documentation should rely on source-backed facts such as:

```text
state-dependent transitions;
principal conservation;
single settlement outcome;
party-specific claim authorization.
```

Do not claim:

```text
impossible to exploit
```

merely because guards exist.

---

# 39. Resolver Liability

If DXJ Labs operates the resolver, potential liability questions include:

```text
negligence;
conflict;
bad faith;
incorrect interpretation;
security compromise;
privacy breach;
evidence mishandling;
failure to follow policy;
delay;
system error.
```

Terms can allocate risk only within the limits of applicable law.

Do not assume a broad disclaimer eliminates all liability.

---

# 40. Independent Resolver Does Not Automatically Remove DXJ Liability

If resolver services are outsourced, document:

```text
contract;
service standard;
conflict policy;
confidentiality;
security;
data processing;
audit rights;
indemnity;
insurance if appropriate;
record retention;
incident notification;
termination;
replacement.
```

A third party can create additional vendor risk.

It does not automatically eliminate operator responsibility.

---

# 41. Resolver Security

Because resolver authority affects economic outcomes, security controls should include:

```text
key protection;
MFA where applicable;
hardware wallet/multisig where appropriate;
least privilege;
role separation;
transaction review;
address allowlists where useful;
monitoring;
incident response;
rotation;
recovery.
```

A compromised resolver key is both a security and legal risk.

---

# 42. Resolver Compromise

Prepare an incident plan:

```text
detect compromise;
prevent additional resolution actions where technically possible;
rotate/replace role;
identify affected cases;
preserve logs;
assess asset exposure;
notify users where appropriate;
assess legal/regulatory notification;
remediate;
post-incident review.
```

Do not promise that every active Rekber can be frozen unless the contract supports it.

---

# 43. Resolver Availability

A dispute mechanism can fail if the resolver is unavailable.

Define:

```text
backup resolver;
replacement authority;
timeout;
escalation;
user notice;
what happens to locked principal;
whether another path becomes available.
```

Indefinite fund lock is a material user risk.

---

# 44. Decision Delay

If the resolver has a target response time, label it accurately.

```text
target
```

is different from:

```text
guarantee.
```

Terms should address exceptional delay and unavailable evidence.

---

# 45. Appeal / Review

If VINSS does not provide an internal appeal, do not imply that one exists.

If an appeal/review feature is introduced, define:

```text
who may request;
deadline;
grounds;
reviewer;
effect on claim;
whether settlement is paused;
fee;
final technical outcome.
```

An internal review is not automatically a legal appeal.

---

# 46. External Legal Rights

Terms should consider whether users retain:

```text
court rights;
consumer complaint rights;
regulatory complaint rights;
statutory remedies;
contract claims.
```

Do not state:

```text
VINSS decision is final under all laws
```

without jurisdiction-specific support.

---

# 47. User Notice Before Dispute

Before the user submits a dispute, show:

```text
what dispute does;
what evidence may be shared;
who receives evidence;
possible outcomes;
resolver authority;
whether claim is paused;
privacy impact;
fee if any;
expected process.
```

This is both a UX and legal disclosure.

---

# 48. Counterparty Notice

The counterparty should receive appropriate notice of:

```text
dispute opened;
issue summary;
deadline to respond;
evidence opportunity;
resolver process;
possible outcomes.
```

Do not design a process where one party can secretly submit material evidence and obtain an outcome without any opportunity for response, unless a legally justified emergency mechanism exists.

---

# 49. Procedural Fairness

Even where VINSS is not legal arbitration, fair process improves enforceability, consumer trust, and resolver quality.

Potential principles:

```text
notice;
opportunity to respond;
consistent rules;
conflict disclosure;
evidence access appropriate to privacy;
reasoned outcome;
audit trail;
no undisclosed ex parte influence;
timely decision.
```

The exact standard should be adapted to jurisdiction and deal type.

---

# 50. Ex Parte Communication

If one party communicates privately with resolver staff, define:

```text
whether allowed;
what can be discussed;
whether material content is disclosed to the other party;
how confidentiality/security reports are handled;
how conflicts are prevented.
```

Support communication should not become an undisclosed route to influence case outcome.

---

# 51. Decision Reasons

A reasoned resolution can improve accountability.

Possible record:

```text
case id;
Offer reference;
Fulfillment state;
evidence considered;
policy/rule applied;
payer amount;
payee amount;
reason code;
resolver;
timestamp.
```

Do not expose private evidence publicly in the reason.

---

# 52. Public Settlement Result

The public blockchain should contain only the settlement information required for execution.

Avoid publishing:

```text
private allegations;
full evidence;
personal names;
addresses;
sensitive documents;
private Message excerpts.
```

Preferred public result:

```text
minimal state;
commitment;
authorized split;
settlement event.
```

---

# 53. Settlement Certificate

A Settlement Certificate should represent only the on-chain settlement fact defined by its contract.

It should not claim:

```text
court victory;
legal judgment;
arbitral award;
proof of innocence;
proof of fraud;
proof of full real-world performance;
legal title to unrelated assets.
```

If a certificate encodes role or settlement status, define the exact scope.

---

# 54. Reputation Consequences

If future loyalty/reputation systems use dispute outcomes, consider fairness.

Questions:

```text
Does losing a dispute reduce reputation?

Can a partial split be treated as fraud?

Can a user contest an incorrect record?

Are outcomes public?

Does an Agent score the user?

Does reputation affect future access?
```

Do not convert a product dispute result into an unsupported allegation of criminal or fraudulent conduct.

---

# 55. Points & Dispute Farming

If successful settlement creates Points, actors may create artificial disputes or settlements.

Potential abuse:

```text
wash deals;
collusion;
self-dealing;
fake Fulfillment;
fake dispute;
pre-agreed split;
multiple wallets;
referral farming.
```

Anti-farming controls should not interfere with legitimate user rights to dispute.

---

# 56. Sanctions / AML Conflict

A dispute case can intersect with AML or sanctions obligations.

Example:

```text
resolver would ordinarily authorize payer/payee split
        ↓
sanctions alert exists
        ↓
ordinary contract path may conflict with legal restriction.
```

Before this occurs, determine:

```text
who makes compliance decision;
what contract controls exist;
whether claim can be blocked;
whether a licence is required;
whether reporting is required;
what may be disclosed to user.
```

Do not give resolver arbitrary compliance authority by default.

---

# 57. Compliance Role vs Resolver Role

Preferred separation:

```text
Resolver
        → decides product dispute according to case rules

Compliance function
        → decides legal/regulatory restrictions where applicable
```

They may communicate where necessary.

They should not be conflated without intentional governance.

---

# 58. Consumer Complaints About Resolver

A user may complain that:

```text
resolver was biased;
evidence was ignored;
private evidence leaked;
decision policy was inconsistent;
service was unavailable.
```

Provide a product complaint route separate from the technical settlement decision.

That complaint may not reverse on-chain settlement, but it still requires handling.

---

# 59. Terms of Service Requirements

Terms should eventually address:

```text
what Rekber is;
what Dispute is;
resolver identity/model;
resolver powers;
evidence submission;
confidentiality;
privacy;
possible outcomes;
claim;
technical finality;
legal-right carve-outs;
complaints;
liability;
governing law;
forum;
consumer mandatory rights.
```

Do not use generic arbitration boilerplate as a substitute.

---

# 60. Offer Terms & Dispute Scope

The structured Offer should help define the scope of a future dispute.

Useful fields can include:

```text
deliverable;
quantity;
asset;
deadline;
acceptance criteria;
revision rules;
shipping requirement;
proof requirement;
objective verifier condition;
special conditions.
```

The clearer the agreed criteria, the less discretionary the dispute process needs to be.

---

# 61. Custom Deal Risk

Custom deals can contain ambiguous or illegal terms.

Potential controls:

```text
prohibited-use policy;
clear limitation that VINSS does not validate legality;
structured key fields;
warning for unsupported objective verification;
manual escalation for high-risk cases.
```

A resolver should not be expected to enforce an illegal agreement.

---

# 62. Illegal / Unenforceable Terms

Terms should address what happens if the underlying user agreement involves:

```text
illegal goods/services;
sanctions violation;
fraud;
rights infringement;
unenforceable obligation;
prohibited asset.
```

Do not promise automatic enforcement of every Offer merely because both users accepted it.

---

# 63. Choice of Evidence Standard by Deal Type

Different deals need different evidence.

Examples:

```text
Freelance
→ deliverable + acceptance criteria + revision history

Physical Goods
→ shipment + delivery + item condition

Digital Goods
→ file delivery + access + integrity

NFT Deal
→ contract + token ID + owner state

Token Trade
→ token transfer + agreed asset/amount

Bounty
→ defined task + objective criteria

Custom
→ specifically agreed evidence
```

Avoid one universal dispute rubric for materially different deals.

---

# 64. Physical-Goods Consumer Rights

A physical-goods deal can create mandatory consumer rights that the Rekber resolver cannot waive.

Potential issues:

```text
conformity;
returns;
warranty;
delivery;
misdescription;
unsafe goods;
distance-sale rights.
```

If VINSS actively facilitates consumer commerce, product-specific counsel review is required.

---

# 65. Digital Goods / Content

Digital goods can create issues involving:

```text
license rights;
copying;
malware;
access;
revocation;
intellectual property;
conformity;
withdrawal rights.
```

A successful file transfer does not prove that the seller had the legal right to distribute the content.

---

# 66. Intellectual Property Evidence

A resolver may receive:

```text
source code;
design files;
copyrighted documents;
trade secrets.
```

Evidence procedures should not accidentally grant VINSS or resolver a broad license to use those materials.

Terms should authorize only what is necessary to resolve the dispute and operate the service.

---

# 67. Confidential Business Information

Commercial users may submit:

```text
pricing;
client lists;
source code;
business plans;
contracts;
invoices.
```

Access should be tightly scoped.

Confidentiality obligations should survive case closure where appropriate.

---

# 68. Malware & Unsafe Evidence

File evidence can be malicious.

Operational controls should include:

```text
file type restrictions;
size limits;
malware scanning where appropriate;
isolated preview;
no automatic execution;
safe storage;
access controls.
```

This is a security obligation as well as a dispute-process concern.

---

# 69. AI Evidence Hallucination Risk

An Agent may incorrectly summarize or infer facts.

Therefore:

```text
Agent summary
        ≠
evidence itself.
```

The resolver should be able to inspect the underlying authorized evidence where required.

Do not resolve solely from a generated summary when material facts are contested.

---

# 70. Model Provider Risk

If a third-party LLM processes dispute evidence, document:

```text
provider;
data sent;
retention;
training policy;
subprocessors;
security;
cross-border transfer;
contract;
deletion;
incident process.
```

Users should receive accurate disclosure before sensitive evidence is sent.

---

# 71. Automated Decision-Making

If a future Agent automatically determines a dispute outcome without meaningful human involvement, additional legal issues can arise.

Potential workstreams:

```text
consumer fairness;
data-protection automated-decision rules;
explainability;
bias;
error correction;
appeal;
contract enforceability;
AI regulation.
```

Do not introduce fully automated final economic decisions without fresh legal review.

---

# 72. Human Review

If human review is required for certain cases, define triggers.

Examples:

```text
high deal value;
ambiguous evidence;
sanctions flag;
identity dispute;
physical-goods fraud allegation;
large partial split;
Agent confidence below threshold;
conflict;
novel case.
```

The thresholds should be documented and tested.

---

# 73. High-Value Deals

Higher-value transactions may justify:

```text
stronger identity verification where lawful;
manual resolver review;
multisig resolver;
enhanced evidence;
longer review window;
additional security;
jurisdiction restriction.
```

Do not assume one Rekber workflow is suitable for every value level.

---

# 74. Resolver Fee

If VINSS later charges a separate dispute fee, disclose:

```text
amount;
who pays;
when charged;
whether refundable;
whether outcome affects fee;
whether inability to pay blocks access.
```

A dispute fee can create consumer fairness issues.

Do not introduce it without separate review.

---

# 75. Outcome-Neutral Compensation

Resolver compensation should not depend on:

```text
payer wins;
payee wins;
size of payee allocation;
size of payer allocation.
```

unless a carefully reviewed model supports it.

Outcome-linked compensation creates obvious conflict risk.

---

# 76. Resolver Metrics

Avoid performance metrics that incentivize unfair outcomes.

Risky metrics:

```text
maximize release;
minimize refunds;
maximize fee retention;
close cases fastest regardless of quality.
```

Better metrics:

```text
policy consistency;
timeliness;
conflict compliance;
security;
quality review;
user understanding.
```

---

# 77. Transparency Report

At scale, VINSS may consider publishing aggregate dispute metrics without exposing private case data.

Possible aggregates:

```text
number of disputes;
median resolution time;
full payer outcomes;
full payee outcomes;
partial splits;
mutual cancellations;
resolver incidents.
```

Do not publish small-cell data that can identify users.

---

# 78. Record Integrity

Case records should be tamper-evident where practical.

Potential controls:

```text
case id;
event timestamps;
evidence hashes;
decision signature;
resolver address;
chain references;
append-only audit log.
```

Tamper evidence does not eliminate the need for access control.

---

# 79. Mainnet Does Not Make Resolver Legally Binding

Mainnet deployment proves an engineering state.

It does not establish:

```text
arbitration validity;
ADR certification;
court enforceability;
consumer fairness;
licensing;
resolver immunity;
legal finality.
```

Avoid marketing that suggests otherwise.

---

# 80. Jurisdiction Review Questions

For every targeted jurisdiction ask counsel:

```text
1. What is the legal characterization of the Rekber dispute mechanism?

2. Is the resolver an intermediary, escrow actor, ADR provider,
   fiduciary, agent, or other regulated actor?

3. Does resolver authority create custody/control implications?

4. Can Terms contractually bind users to the technical resolution?

5. Does the technical resolution limit later legal claims?

6. Can consumer users be bound to the same process?

7. Are mandatory consumer ADR mechanisms relevant?

8. Can arbitration be required?

9. What form of arbitration agreement would be required?

10. What governing law/forum wording is valid?

11. What procedural fairness is required?

12. What evidence/privacy requirements apply?

13. What confidentiality obligations apply?

14. What record retention is required?

15. What liability does DXJ Labs assume?

16. Should resolver be independent from DXJ Labs?

17. What conflict rules are required?

18. What appeal/review rights are required?

19. What disclosures must be shown before Dispute?

20. What product claims must be prohibited?
```

Record jurisdiction conclusions in `jurisdiction-matrix.md`.

---

# 81. Counsel Fact Pack

Provide counsel:

```text
[ ] current Rekber contract source
[ ] current resolver contract/interface
[ ] deployed addresses
[ ] resolver key/governance model
[ ] dispute state machine
[ ] exact resolver powers
[ ] exact resolver limitations
[ ] objective verifier powers
[ ] fund flow
[ ] claim flow
[ ] refund flow
[ ] Offer schema
[ ] Fulfillment schema
[ ] evidence flow
[ ] Agent flow
[ ] Dispute Agent flow
[ ] privacy/vendor flow
[ ] Terms draft
[ ] consumer user flow
[ ] target jurisdictions
[ ] supported assets
[ ] fee model
```

Do not ask for a legal opinion based only on the phrase:

```text
AI-powered decentralized escrow.
```

---

# 82. Required Operational Policies

Before scaling disputes, create:

```text
Resolver Policy;
Conflict Policy;
Evidence Policy;
Privacy/Confidentiality Policy;
Case Retention Policy;
Security Policy;
Resolver Incident Policy;
Complaint Policy;
Compliance Escalation Policy;
Agent Use Policy.
```

These may be internal policies rather than public documents.

---

# 83. Decision Template

A resolver decision record can use:

```text
Case:
Rekber:
Offer reference:
Dispute opened:
Parties:
Resolver:
Conflict check:
Evidence considered:
Relevant agreed terms:
Relevant Fulfillment state:
Policy applied:
Payer allocation:
Payee allocation:
Reason code:
Decision time:
On-chain authorization tx:
Claim status:
Retention date:
```

Private content should remain off public chain unless required.

---

# 84. Reason Codes

Standardized reason codes can improve consistency.

Examples:

```text
FULFILLMENT_NOT_SUBMITTED
FULFILLMENT_INCOMPLETE
OBJECTIVE_CONDITION_FAILED
OBJECTIVE_CONDITION_MET
PARTIAL_PERFORMANCE
MUTUAL_AGREEMENT
INSUFFICIENT_EVIDENCE
COUNTERPARTY_ADMISSION
POLICY_RESTRICTION
```

Do not publish labels implying crime without legal basis.

---

# 85. No Fraud Label From Ordinary Loss

A user losing a dispute does not mean:

```text
fraudster;
scammer;
criminal.
```

Use neutral product terms unless a separate legally supported determination exists.

---

# 86. Settlement Certificate After Dispute

If certificates can be claimed after resolved disputes, decide what they represent.

Possible safe scope:

```text
the Rekber reached an eligible settled state.
```

Avoid encoding:

```text
winner;
loser;
fraud;
guilt;
court decision.
```

unless explicitly justified.

---

# 87. Change-Control Rule

Re-open dispute legal analysis when any of the following changes:

```text
resolver identity;
resolver powers;
resolver automation;
Agent authority;
objective verifier;
claim mechanics;
refund mechanics;
settlement state;
evidence storage;
evidence recipients;
new deal type;
new consumer market;
new dispute fee;
new appeal process;
new arbitration wording;
new governing-law clause;
new target jurisdiction;
new token/reputation consequence.
```

A legal memo is valid only for the architecture it reviewed.

---

# 88. Claims VINSS Should Avoid

Unless supported by a deliberately created legal framework, do not state:

```text
VINSS is a court;

VINSS Resolver is a judge;

VINSS Agent is an arbitrator;

VINSS Dispute is legal arbitration;

VINSS resolution is a court judgment;

all users permanently waive court rights;

the on-chain result is legally final worldwide;

resolver decisions are guaranteed correct;

the resolver is independent without evidence;

all evidence is verified;

all evidence is confidential forever;

VINSS guarantees refunds;

VINSS guarantees delivery;

Settlement Certificate proves legal victory.
```

---

# 89. Preferred Factual Wording

Prefer verifiable statements such as:

```text
VINSS provides an on-chain Rekber dispute-resolution path.

The resolver may authorize only a payer/payee allocation whose
total equals the custody principal.

The resolver cannot make itself the beneficiary of settlement
principal through the dispute-resolution mechanism.

Each party claims its own authorized share.

Users may submit selected evidence through the dispute workflow.

The technical resolution determines the Rekber contract outcome;
legal rights outside VINSS depend on applicable law and Terms.
```

Verify every statement against current source before publication.

---

# 90. Core Dispute Design Principle

The dispute mechanism should minimize arbitrary authority while preserving a workable path when parties disagree.

Preferred model:

```text
clear Offer terms
        ↓
clear Fulfillment state
        ↓
user review
        ↓
selective evidence disclosure
        ↓
bounded resolver authority
        ↓
reasoned decision
        ↓
principal-conserving split
        ↓
party-specific claim
        ↓
minimal public settlement state
        ↓
separate complaint/legal-right path
```

The core rule is:

> **VINSS should describe its resolver as exactly what it is technically and contractually, without turning a bounded smart-contract dispute mechanism into a court, arbitration tribunal, or legal judgment by marketing language alone.**
