# VINSS Consumer Protection & User Contract Notes

> **Purpose:** identify the pricing, disclosure, contract, marketing, complaint, digital-service, refund, and user-protection requirements that may apply to VINSS as a consumer-facing product.

**Status:** Global consumer-protection issue spotting
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** This document is not legal advice. It does not conclude that a particular consumer, financial-services, digital-services, unfair-trading, or distance-contract rule applies or does not apply to VINSS in a specific jurisdiction.

---

# 1. Consumer Protection Is a Separate Legal Layer

VINSS may face consumer-protection obligations even if a jurisdiction ultimately concludes that the relevant operator is not a:

```text
bank;
custodian;
money transmitter;
VASP;
CASP;
payment institution;
regulated escrow provider.
```

A user may still be purchasing or using:

```text
Room access;
Message actions;
Offer actions;
Rekber service;
Fulfillment/review workflow;
Agent functionality;
other digital services.
```

Therefore:

```text
financial-regulatory classification
        ≠
consumer-law classification.
```

Likewise:

```text
smart-contract execution
        ≠
waiver of consumer rights

user wallet signature
        ≠
automatic informed consent to every legal term

on-chain irreversibility
        ≠
permission for misleading pricing or claims.
```

---

# 2. Identify the Consumer-Facing Contract

Before drafting Terms, identify the actual service relationship.

Record:

```text
Who operates VINSS?

Which legal entity contracts with the user?

Who receives VINSS product fees?

What service is being sold?

When is the contract formed?

How does the user accept Terms?

What version of the Terms applies?

Can the user use VINSS without creating a traditional account?

Does wallet connection itself create any contract?

Does payment for a specific action create a separate transaction contract?

Which jurisdictions are targeted?
```

Do not assume the smart contract itself is the complete legal agreement between DXJ Labs and the user.

---

# 3. User-to-User Deal vs User-to-VINSS Service

VINSS involves at least two legally distinct relationships:

```text
User A
   ↕
User B
```

and:

```text
User
   ↕
VINSS / relevant operator
```

The first can involve:

```text
sale;
freelance service;
token trade;
NFT deal;
digital goods;
physical goods;
bounty;
custom agreement.
```

The second can involve:

```text
software access;
private coordination;
Rekber functionality;
fee-bearing transaction services;
Agent;
support;
Dispute workflow;
other product services.
```

A dispute between two users is not automatically the same as a complaint against VINSS.

Terms and UI must preserve that distinction.

---

# 4. Current Product Flow Relevant to Consumers

The consumer experience can include:

```text
Connect wallet
        ↓
Create / join Private Room
        ↓
Message / negotiate
        ↓
Create structured Offer
        ↓
Counter / Accept / Reject
        ↓
Start Rekber
        ↓
Fund
        ↓
Fulfillment
        ↓
Review / Revision
        ↓
Release / Refund / Dispute
        ↓
Claim
        ↓
Settlement
        ↓
optional Settlement Certificate
```

At every economically meaningful step, determine:

```text
what the user sees;
what the user pays;
what the user signs;
what becomes irreversible;
what rights remain;
what can fail;
what VINSS can and cannot do.
```

---

# 5. Pricing Transparency

The user should receive material pricing information before committing to a charge.

Where applicable show:

```text
action name;
settlement/payment asset;
principal;
VINSS service fee;
network/gas treatment;
sponsor/paymaster treatment;
total user-side amount;
quote status;
quote expiry;
what can cause a quote to change;
which fees are refundable;
which fees are not refundable.
```

Avoid:

```text
hidden fee;
fee disclosed only after wallet approval;
ambiguous total;
unclear asset denomination;
unclear percentage basis;
unclear minimum fee;
unexplained fee change;
marketing something as free when the user must pay a material charge.
```

The exact legal disclosure standard depends on jurisdiction and product classification.

---

# 6. Dynamic Pricing

VINSS may use dynamic pricing or a dynamic sponsor/cost floor.

The user does not need to understand the full internal cost model.

The user does need to understand the price they are agreeing to.

A useful product principle is:

```text
public baseline
        ↓
current executable quote
        ↓
user sees amount
        ↓
user approves
```

If the quote can change because of:

```text
network conditions;
oracle movement;
asset price;
sponsor cost;
FeePolicy parameters;
quote expiry;
```

state that clearly.

Do not represent a baseline price as guaranteed if the executable price can be higher.

---

# 7. Quote Expiry

If a quote is time-sensitive, define:

```text
quote created at;
quote expires at;
conditions that invalidate quote;
whether wallet approval after expiry fails;
whether a new quote is required;
whether the user is ever charged more than the displayed approved quote.
```

Preferred rule:

> A user should not be silently charged a higher VINSS service fee than the price they were shown and authorized.

If contract execution can fail because the quote is stale, explain the failure without implying funds were necessarily lost.

---

# 8. Rekber Price Disclosure

Rekber has a separate economic structure from a flat Message or Offer action.

Before funding, clearly distinguish:

```text
settlement principal;
VINSS Rekber service fee;
network/sponsor cost;
total wallet movement;
settlement asset.
```

If the service fee is calculated as:

```text
max(minimum fee, percentage of deal value, applicable dynamic floor)
```

the UI should display the resulting executable amount, not require the user to calculate it.

The user should also know whether:

```text
Release is included;
Claim is included;
Dispute creates an additional VINSS fee;
Refund returns principal only;
the service fee is non-refundable after funding.
```

Any statement must match current implementation.

---

# 9. Principal vs Service Fee

This distinction is critical.

```text
settlement principal
        ≠
VINSS service fee
```

A UI button labelled:

```text
Refund
```

can reasonably create confusion if:

```text
principal returns
but
service fee does not.
```

Preferred terminology should make the difference visible before funding and when refund is requested.

Example conceptual wording:

```text
Principal refund
```

rather than simply:

```text
Full refund
```

when a product fee remains non-refundable.

Final public wording should be reviewed against actual contract behavior.

---

# 10. Gas, Sponsor & Paymaster Costs

The product should distinguish:

```text
VINSS service fee;
network gas;
sponsored execution;
Privacy Pool/provider charge;
third-party wallet/provider charge.
```

If VINSS sponsors part of the transaction cost:

```text
sponsored
```

does not necessarily mean:

```text
free.
```

If sponsorship cost is recovered through a VINSS fee or dynamic price floor, the user-facing quote should not be misleading about the total economic charge.

---

# 11. Failed Transactions

Define what happens when a transaction:

```text
is rejected by wallet;
fails before submission;
reverts on-chain;
fails during proving;
fails because quote expired;
fails because sponsor rejects;
fails because RPC/provider fails;
fails because balance is insufficient.
```

For each case determine:

```text
Was a VINSS fee charged?

Was network gas consumed?

Was principal moved?

Can the user retry?

Does a duplicate-action guard apply?

What message does the UI show?
```

Do not use:

```text
Your funds are safe
```

as a generic failure message unless the application actually verifies that no principal moved.

---

# 12. Irreversibility & Blockchain Finality

VINSS should explain material blockchain risks before users commit value.

Potential risks include:

```text
irreversible wallet authorization;
wrong wallet/address;
wrong asset;
network congestion;
chain reorganization/finality assumptions;
smart-contract failure;
third-party provider failure;
token contract restrictions;
stablecoin issuer freeze;
lost wallet access.
```

Do not promise:

```text
VINSS can always reverse transactions;
VINSS can always recover mistaken transfers;
VINSS controls the blockchain;
VINSS can restore a lost private key.
```

---

# 13. Wallet Responsibility

Terms should explain what the user controls, without shifting every product failure onto the user.

User responsibilities may include:

```text
protecting wallet credentials;
reviewing transaction details;
using supported assets;
maintaining sufficient balance;
confirming counterparty;
protecting room secrets;
maintaining device security.
```

VINSS responsibilities may separately include:

```text
accurate pricing disclosure;
reasonable product operation;
accurate description of contract behavior;
security of operator-controlled systems;
complaint handling;
privacy/data obligations;
not making deceptive claims.
```

Avoid clauses that attempt to disclaim every responsibility regardless of mandatory consumer law.

---

# 14. Rekber Is Not a Guarantee

Do not market:

```text
guaranteed safe transaction;
guaranteed money back;
zero counterparty risk;
fraud-proof;
risk-free;
100% protected;
```

unless those claims are literally supportable and legally approved.

More accurate product language can describe mechanisms:

```text
principal is held by the Rekber contract;
release/refund/dispute paths are state-dependent;
resolver authority is bounded;
settlement follows contract rules;
each party remains responsible for real-world facts not verified on-chain.
```

Mechanism claims are preferable to absolute outcome claims.

---

# 15. Fulfillment Claims

VINSS can record or coordinate Fulfillment.

That does not mean VINSS independently proves every real-world obligation.

Different Offer types can involve:

```text
software delivery;
design work;
physical shipment;
digital file;
NFT transfer;
token transfer;
custom performance.
```

Terms should distinguish:

```text
Fulfillment submitted
```

from:

```text
Fulfillment legally complete.
```

Likewise:

```text
on-chain proof
```

may prove only the on-chain fact represented by that proof.

---

# 16. Review / Approve

The user should understand what an approval action does.

Before approval disclose:

```text
what is being approved;
whether approval authorizes release;
whether approval is final;
whether approval can be reversed;
whether a claim step follows;
what amount is authorized.
```

Do not hide an economically final action behind vague UI such as:

```text
Continue
```

when the action actually authorizes settlement.

---

# 17. Refund Rules

Document refund paths precisely.

Questions:

```text
Who may request refund?

Under which state?

Does deadline matter?

Does valid Fulfillment block unilateral refund?

Is mutual cancellation possible?

Can a dispute produce a partial refund?

What happens to service fee?

What happens to network costs?
```

Public Terms must match contract state transitions.

---

# 18. Dispute Rules

Before a user relies on Dispute, disclose:

```text
when Dispute is available;
who may initiate;
what evidence may be submitted;
who decides;
what powers resolver has;
what outcomes are possible;
whether resolver is DXJ Labs or another actor;
whether the decision is technically final;
whether legal rights outside VINSS remain.
```

Possible technical outcomes may include:

```text
full payer allocation;
full payee allocation;
partial split.
```

Do not call the resolver:

```text
court;
judge;
arbitrator;
tribunal;
```

unless that legal structure actually exists.

---

# 19. Product Dispute vs Legal Dispute

A technical Rekber resolution does not necessarily extinguish legal rights between users.

Likewise:

```text
smart-contract settlement
        ≠
court judgment.
```

Terms should be reviewed for:

```text
governing law;
forum;
mandatory consumer rights;
complaints against VINSS;
user-to-user legal claims;
limitations on dispute terms.
```

Do not imply that using VINSS eliminates access to legally mandatory remedies.

---

# 20. Agent Claims

The Agent may help users understand:

```text
Offer terms;
timeline;
Fulfillment;
evidence;
possible next steps.
```

Do not describe Agent output as:

```text
legal advice;
financial advice;
binding legal decision;
guaranteed fraud detection;
guaranteed correct resolution.
```

If an Agent can recommend a Dispute outcome, distinguish:

```text
recommendation
```

from:

```text
authorized on-chain resolution.
```

---

# 21. Settlement Certificate Claims

A Settlement Certificate can prove the contract state it is designed to represent.

It should not be marketed as proving:

```text
the physical item was genuine;
the work was legally satisfactory;
all representations were true;
no fraud occurred;
no legal claim remains;
the holder has financial/investment rights.
```

Preferred description should identify exactly what on-chain settlement fact the certificate attests to.

---

# 22. Privacy & Security Marketing

High-risk marketing terms include:

```text
private;
anonymous;
encrypted;
secure;
non-custodial;
trustless;
decentralized;
zero-knowledge;
untraceable.
```

Every claim should be reviewed against actual architecture.

Examples:

```text
client-side encrypted Message content
```

is narrower and more testable than:

```text
completely private.
```

Similarly:

```text
users retain their wallet private keys
```

is more precise than a broad legal statement:

```text
VINSS is non-custodial.
```

---

# 23. Security Claims

Before using:

```text
secure;
safe;
protected;
audited;
battle-tested;
```

record the supporting evidence.

Possible evidence levels include:

```text
source implementation;
unit tests;
integration tests;
testnet E2E;
mainnet deployment;
source verification;
external security audit;
formal verification;
bug bounty;
production history.
```

Do not treat one level as proof of another.

---

# 24. Marketing Claim Register

Maintain a claim register containing:

| Claim | Where used | Evidence | Legal review | Allowed wording | Review trigger |
|---|---|---|---|---|---|
| Private | Website/UI | Architecture evidence | Pending | Narrow factual wording | Architecture change |
| Secure | Website | Security evidence | Pending | Avoid absolute claim | Audit/change |
| Non-custodial | Marketing | Legal + technical analysis | Pending | Prefer factual key/custody description | Rekber change |
| Protected | Rekber UI | Contract behavior | Pending | Define protection | State-machine change |
| Verified | Certificate | Exact attestation scope | Pending | State what is verified | Certificate change |

Do not publish an absolute claim solely because competitors use similar language.

---

# 25. Influencer, Affiliate & Community Marketing

If VINSS uses:

```text
influencers;
affiliates;
referral partners;
community ambassadors;
paid reviews;
sponsored content;
```

material commercial relationships may require disclosure depending on jurisdiction.

Marketing controls should prohibit partners from making unsupported claims about:

```text
returns;
token price;
security;
legal status;
licensing;
guarantees;
privacy;
risk.
```

Referral incentives should not become hidden compensation for misleading endorsements.

---

# 26. Dark Patterns

VINSS UX should avoid manipulating users into economically material actions.

Examples to avoid:

```text
preselected paid option;
fake urgency;
hidden fee;
confusing cancel path;
button wording that disguises release;
making Reject much harder than Accept;
obscuring quote expiry;
hiding non-refundable fee;
repeated pressure to sign;
misleading success confirmation.
```

User approval should be meaningful.

---

# 27. EU Consumer Rights Directive

The EU Consumer Rights Directive, Directive 2011/83/EU, contains information requirements for consumer contracts and specific rules for distance and off-premises contracts.

European Commission official source:

https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en

The Commission notes that the distance-contract rules include pre-contract information requirements and withdrawal rules.

VINSS-specific questions include:

```text
Is the user a consumer?

Who is the trader?

Is the VINSS service a distance contract?

What information must be provided before payment?

Does a withdrawal right apply?

Does an exception apply once digital performance begins?

Are financial-service rules applicable instead?

What confirmation must be provided on a durable medium?
```

Do not assume the standard 14-day withdrawal model applies unchanged to every VINSS action.

---

# 28. EU Digital Content & Digital Services

Directive (EU) 2019/770 applies to certain contracts for digital content and digital services.

Official text:

https://eur-lex.europa.eu/eli/dir/2019/770/oj

The Directive includes conformity requirements and remedies for qualifying consumer digital-content/service contracts.

Potential VINSS questions:

```text
Which VINSS functions qualify as digital services?

What does conformity mean for those services?

What remedy applies if a paid VINSS service fails?

How do smart-contract actions interact with digital-service remedies?

Does a financial-services exclusion apply to a particular feature?
```

Do not assume every component of VINSS falls within the same Directive.

---

# 29. EU Distance Financial Services Update

Directive (EU) 2023/2673 amended the Consumer Rights Directive as regards financial-services contracts concluded at a distance and repealed the older Distance Marketing of Financial Services Directive.

The European Commission states that these rules entered into application on **19 June 2026**.

Official Commission source:

https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en

This matters if VINSS or a particular Rekber-related service is legally classified as a consumer financial service.

Counsel should determine:

```text
whether the financial-services distance-contract rules apply;
what pre-contract disclosures apply;
whether withdrawal/cancellation rules apply;
what interface requirements apply;
what national implementation matters.
```

---

# 30. EU Unfair Commercial Practices

EU consumer law also regulates unfair business-to-consumer practices.

VINSS marketing and UX should avoid:

```text
false licensing claims;
false security claims;
false scarcity;
misleading omission of fees;
misleading refund descriptions;
false guarantees;
misleading token-return claims;
undisclosed commercial endorsements.
```

EU-specific analysis should consider the Unfair Commercial Practices Directive and national implementation.

---

# 31. United Kingdom — Consumer Protection

The UK Digital Markets, Competition and Consumers Act 2024 introduced updated consumer-protection rules and enforcement powers.

The Competition and Markets Authority published guidance on unfair commercial practices under the Act in April 2025 and updated it in November 2025, including price-transparency guidance.

Official source:

https://www.gov.uk/government/publications/unfair-commercial-practices-cma207

VINSS-specific UK review should consider:

```text
misleading actions;
misleading omissions;
aggressive practices;
price transparency;
drip pricing;
fake reviews;
commercial endorsements;
online choice architecture;
contract terms.
```

Do not assume crypto-native UX is outside ordinary UK consumer rules.

---

# 32. United Kingdom — Pricing

Where UK consumer rules apply, the displayed price should not omit unavoidable mandatory charges in a misleading way.

For VINSS this means counsel should review how the UI presents:

```text
service fee;
percentage Rekber fee;
minimum fee;
dynamic floor;
gas;
sponsor contribution;
third-party fee;
total amount.
```

A technically separate blockchain payment can still be material to the consumer's understanding of total price.

---

# 33. United States — FTC

The Federal Trade Commission applies established consumer-protection principles to financial technology.

Official FTC FinTech source:

https://www.ftc.gov/business-guidance/credit-finance/fintech

The FTC also states that advertising claims must be:

```text
truthful;
non-deceptive;
non-unfair;
supported by evidence.
```

Official source:

https://www.ftc.gov/business-guidance/advertising-marketing

VINSS claims about:

```text
privacy;
security;
fees;
refunds;
guarantees;
risk;
token economics;
legal/compliance status;
```

should therefore be supportable where FTC jurisdiction applies.

---

# 34. U.S. Crypto Claim Risk

FTC enforcement involving crypto businesses demonstrates the risk of claims that customer assets are:

```text
safe;
always available;
low risk;
protected;
```

when facts do not support those representations.

For VINSS, avoid turning technical safeguards into broad financial guarantees.

The safer approach is to describe:

```text
what the smart contract does;
what the resolver can do;
what the user controls;
what risks remain.
```

---

# 35. U.S. State Consumer Law

Federal FTC analysis is not the complete U.S. consumer-law picture.

States maintain their own unfair/deceptive acts and practices laws and other consumer rules.

A broad U.S. launch should therefore review:

```text
state targeting;
state Terms requirements;
state auto-renewal rules if subscriptions exist;
state privacy rules;
state money-transmission overlap;
state consumer remedies.
```

Do not label the product:

```text
U.S.-compliant
```

from FTC research alone.

---

# 36. Singapore — Fair Trading

Singapore's Competition and Consumer Commission states that fair-trading laws protect consumers from unfair business conduct and promote transparency.

Official CCCS source:

https://www.cccs.gov.sg/consumer-protection/fair-trading-practices

The Consumer Protection (Fair Trading) Act identifies unfair practices, including certain deceptive or misleading representations.

VINSS-specific review should consider:

```text
pricing representations;
rights/remedies claims;
refund claims;
guarantees;
service capability;
contract terms;
pressure tactics;
token marketing.
```

If a price materially exceeds an estimate, legal consequences can depend on whether the consumer expressly agreed to the higher price.

Dynamic quote design should therefore be reviewed carefully.

---

# 37. Indonesia — Consumer Protection

Indonesia requires a product-specific consumer-law analysis.

If VINSS or the relevant operator falls within the OJK-regulated financial-services perimeter, POJK 22 Tahun 2023 on Consumer and Public Protection in the Financial Services Sector becomes particularly relevant.

Official OJK source:

https://ojk.go.id/id/regulasi/Pages/Pelindungan-Konsumen-dan-Masyarakat-di-Sektor-Jasa-Keuangan.aspx

OJK describes POJK 22/2023 as covering, among other matters:

```text
product/service design;
product/service information;
marketing;
agreements;
service delivery;
complaint handling;
dispute resolution;
market conduct.
```

Do not assume POJK 22/2023 applies to VINSS merely because VINSS uses crypto.

First determine whether the relevant operator/product falls within its regulated scope.

Separate analysis of Indonesia's generally applicable consumer-protection law may also be required.

---

# 38. Terms of Service

A production Terms of Service should eventually cover at least:

```text
operator identity;
contact information;
eligibility;
consumer/business-user distinction;
supported jurisdictions;
restricted jurisdictions;
prohibited users;
wallet responsibility;
room-secret responsibility;
supported assets;
fees;
dynamic pricing;
gas/sponsorship;
quote expiry;
smart-contract risk;
Rekber mechanics;
Fulfillment;
review;
release;
refund;
Dispute;
resolver;
claim;
Agent limitations;
certificate limitations;
privacy;
sanctions/AML where applicable;
service availability;
third-party providers;
intellectual property;
open-source licensing relationship;
complaints;
termination;
governing law;
forum;
mandatory consumer-right carve-outs;
changes to Terms.
```

Do not copy generic exchange or SaaS Terms.

The Terms must match VINSS.

---

# 39. Terms Acceptance

Record how Terms are accepted.

Possible evidence:

```text
version;
timestamp;
wallet/account identifier;
acceptance action;
jurisdiction;
language/version shown.
```

Avoid:

```text
Terms hidden in footer only
```

for economically significant rights if local law requires clearer assent.

If Terms materially change, define when re-acceptance is required.

---

# 40. Contract Versioning

Every published Terms version should have:

```text
effective date;
version identifier;
archive;
change summary;
operator identity;
contact information.
```

Do not overwrite Terms without retaining the version that governed a prior user action.

This is especially important for Rekber transactions that can remain active across time.

---

# 41. Mandatory Consumer Rights

Terms should not state:

```text
all rights are waived;
VINSS has no liability under any circumstance;
all refunds are prohibited;
all disputes are final;
```

without jurisdiction-specific review.

Some consumer rights cannot be waived by contract.

Use appropriate carve-outs such as:

```text
except where prohibited by applicable law
```

only where counsel confirms the wording is sufficient.

Generic carve-outs do not fix fundamentally unfair terms.

---

# 42. Complaint Handling

Create a product complaint process separate from Rekber Dispute.

Minimum categories:

```text
fee complaint;
failed transaction;
incorrect UI state;
privacy complaint;
security complaint;
Agent complaint;
Rekber product complaint;
counterparty dispute;
billing/sponsorship complaint;
accessibility complaint;
legal/regulatory complaint.
```

Each category should have an owner and escalation path.

---

# 43. Complaint Record

Maintain:

```text
complaint id;
date;
user/contact;
wallet/transaction reference where needed;
category;
summary;
evidence;
assigned owner;
response;
resolution;
escalation;
regulatory-reporting flag;
closure date.
```

Do not require unnecessary private Deal Room content to file a product complaint.

---

# 44. Complaint vs Rekber Dispute

Clearly distinguish:

```text
Counterparty did not deliver
        =
Rekber/user-to-user dispute
```

from:

```text
VINSS displayed the wrong fee
        =
product complaint
```

and:

```text
VINSS mishandled personal data
        =
privacy complaint.
```

A single support button may route these internally, but the legal handling can differ.

---

# 45. Service Availability

Do not guarantee continuous availability if VINSS depends on:

```text
Starknet;
RPC providers;
Privacy Pool;
wallet provider;
paymaster;
oracle;
hosting;
database;
LLM provider;
third-party APIs.
```

Terms should accurately describe dependency risk.

However, an availability disclaimer should not be used to excuse avoidable misrepresentation or legally mandatory service obligations.

---

# 46. Third-Party Services

Identify third-party components that affect the user experience.

Examples:

```text
wallet;
Privacy Pool/provider;
paymaster;
RPC;
oracle;
stablecoin issuer;
LLM provider;
hosting;
analytics;
support.
```

For each determine:

```text
which terms apply;
whether VINSS controls the service;
what failure means;
what fee applies;
what data is shared.
```

Do not make the user responsible for unknown third-party terms that were never reasonably disclosed.

---

# 47. Stablecoin & Asset Risks

If Rekber supports stablecoins or other tokens, disclose material product risks where appropriate:

```text
issuer freeze/blacklist;
depeg;
contract upgrade;
token transfer restrictions;
network-specific representation;
unsupported token;
fake token contract;
issuer insolvency/redemption risk.
```

VINSS should not imply that:

```text
1 token = guaranteed fiat redemption
```

unless legally and factually accurate.

---

# 48. Error Messages as Consumer Disclosure

Error copy is part of the user experience.

Avoid:

```text
Success
```

before final success is known.

Avoid:

```text
No funds moved
```

without verifying chain state.

Avoid:

```text
Refund complete
```

when only authorization has occurred and claim remains.

Prefer state-accurate copy:

```text
Transaction submitted;
Funding confirmed;
Refund authorized;
Claim available;
Settlement complete.
```

---

# 49. Confirmation Receipts

For fee-bearing or economically significant actions, preserve a receipt containing where appropriate:

```text
action;
timestamp;
network;
transaction hash;
principal;
VINSS fee;
asset;
quote;
state/result;
room/Rekber reference;
Terms version.
```

Receipts improve user understanding and complaint investigation.

Do not put private commercial terms in a public receipt unless necessary.

---

# 50. Accessibility & Understandability

Material legal and pricing information should not be technically present but practically unreadable.

Review:

```text
mobile layout;
font size;
contrast;
scroll depth;
tooltip-only disclosure;
wallet-modal visibility;
language clarity;
screen-reader/accessibility support.
```

A user operating from mobile should be able to understand the fee and settlement consequence before signing.

---

# 51. Language

Legal language should preserve product terminology without overstating legal status.

Preferred:

```text
Rekber;
Dispute;
Resolver;
Resolution;
Principal;
VINSS service fee;
Settlement Certificate.
```

Use legal-specific terms such as:

```text
escrow agent;
trust;
fiduciary;
arbitration;
insured deposit;
custodian;
```

only after the legal structure supports them.

---

# 52. Consumer vs Business Users

VINSS can support both:

```text
consumer transactions;
business/professional transactions.
```

The applicable rights may differ.

Do not classify a user as a business merely because:

```text
they use a crypto wallet;
they use on-chain assets;
they create multiple deals.
```

If business-user status matters, define an appropriate process.

---

# 53. Minors

Before permitting minors, determine:

```text
contract capacity;
wallet access;
financial-service restrictions;
privacy rules;
marketing restrictions;
local age rules.
```

A conservative launch policy may restrict use to users who have legal capacity to enter the relevant agreement.

Do not copy an age threshold without jurisdiction review.

---

# 54. Prohibited Use

Terms may prohibit activity such as:

```text
fraud;
illegal goods/services;
sanctions evasion;
money laundering;
stolen assets;
malware;
extortion;
rights infringement;
manipulation of Rekber/Points;
abuse of sponsored transactions.
```

The prohibited-use list should match actual enforcement capability.

Do not promise monitoring that VINSS does not perform.

---

# 55. Refund Policy vs Contract Logic

A public Refund Policy should not be written separately from contract state.

For every refund scenario map:

```text
legal wording
        ↔
UI wording
        ↔
contract entrypoint
        ↔
state requirement
        ↔
actual asset movement.
```

If those diverge, the public policy is unreliable.

---

# 56. Fee Disclosure Document

For mainnet launch, consider a concise public fee disclosure separate from long Terms.

It should cover:

```text
fee-bearing actions;
current baseline;
dynamic quote principle;
Rekber formula;
principal vs service fee;
network/sponsor costs;
refund treatment;
quote expiry;
where current executable price is shown.
```

Do not hardcode volatile amounts in Terms if they can change.

---

# 57. Risk Disclosure

A user-facing risk disclosure can cover:

```text
smart-contract risk;
blockchain finality;
wallet loss;
counterparty risk;
real-world Fulfillment risk;
oracle/provider risk;
stablecoin risk;
resolver risk;
network availability;
third-party dependencies;
regulatory restrictions.
```

Avoid using the disclosure as an excuse for misleading claims elsewhere.

---

# 58. Mainnet Claims

Do not state or imply:

```text
mainnet = safe;
mainnet = audited;
mainnet = approved;
mainnet = licensed;
mainnet = guaranteed.
```

Mainnet means the product is operating on a production blockchain environment.

It is an engineering/deployment fact.

---

# 59. Token & Loyalty Marketing

Keep separate:

```text
Points;
Settlement Certificate/SBT;
future VINSS token;
future VINSS presale;
future VINSS → DXJ mechanism.
```

Current Points should not promise:

```text
guaranteed token allocation;
fixed monetary value;
fixed exchange rate;
guaranteed future conversion.
```

Future token marketing requires separate legal review.

---

# 60. Consumer Claim Risks for Future Token

Avoid:

```text
guaranteed profit;
price will increase;
risk-free yield;
guaranteed listing;
guaranteed buyback;
guaranteed DXJ redemption;
dividend/revenue share
```

unless a future legally reviewed design intentionally creates such rights.

Do not use token incentives to obscure the price of the actual VINSS service.

---

# 61. User Support Before Scale

Before broad launch define:

```text
support channel;
supported language;
support hours/expectation;
security escalation;
privacy contact;
complaint contact;
Rekber issue route;
transaction lookup process;
lost-access policy;
scam report process.
```

Do not promise 24/7 support unless it exists.

---

# 62. Consumer Incident Response

A product incident may require user communication even when no privacy breach occurs.

Examples:

```text
incorrect fee quote;
contract bug;
wrong UI settlement state;
oracle failure;
paymaster outage;
stablecoin freeze;
resolver compromise;
certificate error.
```

Prepare:

```text
incident severity;
user-impact assessment;
public notice;
direct notice where appropriate;
remediation;
refund/compensation analysis;
regulator notification where required.
```

---

# 63. Compensation & Goodwill Refunds

Separate:

```text
contractual principal refund;
legal consumer remedy;
VINSS service-fee refund;
goodwill compensation.
```

Do not use the word:

```text
refund
```

for all four without explanation.

Operations should have authority limits and records for any off-chain compensation.

---

# 64. Record of Material User Consent

Where consent/acknowledgment is materially relied on, record what the user saw.

Examples:

```text
Terms version;
fee quote;
non-refundable-fee disclosure;
high-risk irreversible action warning;
Agent data disclosure;
Dispute evidence disclosure.
```

Do not create unnecessary consent banners for matters that require a different legal basis.

---

# 65. Launch Checklist

Before consumer-facing mainnet promotion, verify:

```text
[ ] operating entity identified
[ ] Terms drafted
[ ] Privacy Notice drafted
[ ] fee disclosure drafted
[ ] risk disclosure drafted
[ ] refund/principal language matches contract
[ ] complaint channel active
[ ] Dispute wording accurate
[ ] resolver wording accurate
[ ] Agent limitations accurate
[ ] all major marketing claims evidenced
[ ] dynamic pricing clearly displayed
[ ] wallet-signature consequences clear
[ ] failed-transaction copy tested
[ ] third-party dependencies disclosed where material
[ ] jurisdiction restrictions implemented
[ ] consumer-law review completed for targeted jurisdictions
```

A technically successful mainnet E2E does not complete this checklist.

---

# 66. Consumer-Law Change Triggers

Re-open this analysis when any of the following changes:

```text
new paid feature;
new fee;
new pricing model;
subscription;
auto-renewal;
new Rekber formula;
refund behavior;
resolver power;
Fulfillment behavior;
Agent behavior;
new marketing claim;
new jurisdiction;
new affiliate campaign;
new token plan;
new third-party payment rail;
fiat support;
new stablecoin;
new Terms;
new complaint workflow.
```

---

# 67. Claims VINSS Should Avoid

Unless current evidence and legal review support them, do not state:

```text
VINSS is completely safe;

VINSS guarantees settlement;

VINSS guarantees refunds;

VINSS eliminates fraud;

VINSS eliminates counterparty risk;

all transactions are reversible through Rekber;

all Rekber data is private;

VINSS is legally non-custodial;

VINSS is legally compliant worldwide;

VINSS is licensed worldwide;

mainnet means approved;

Settlement Certificate proves the real-world deal;

Agent decisions are legally binding;

Points have guaranteed future value;

VINSS token will generate returns.
```

---

# 68. Preferred Factual Communication

Prefer statements that can be verified.

Examples:

```text
The displayed quote is the VINSS charge for this action
at the time of approval.

Settlement principal and VINSS service fee are shown separately.

VinssEscrowRekber holds settlement principal according to
the contract's state machine.

The dispute resolver may authorize only a payer/payee split
that equals the custody principal.

Private coordination content is encrypted, while settlement
contracts expose the public state required for execution.

A Settlement Certificate represents the qualifying on-chain
settlement state defined by the certificate contract.
```

Every statement should remain synchronized with current source.

---

# 69. Core Consumer-Protection Principle

VINSS should make economically meaningful actions understandable before the user commits.

The preferred model is:

```text
clear product role
        ↓
clear price
        ↓
clear principal vs fee
        ↓
clear wallet action
        ↓
clear settlement consequence
        ↓
clear refund/dispute rights
        ↓
clear remaining risks
        ↓
accurate receipt
        ↓
accessible complaint path.
```

The core rule is:

> **Do not make the user infer the price, the fund flow, the finality of an action, or what VINSS can and cannot protect.**
