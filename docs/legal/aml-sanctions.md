# VINSS AML, CFT & Sanctions Notes

> **Purpose:** identify the anti-money-laundering, counter-terrorist-financing, sanctions, Travel Rule, transaction-risk, and operational-control questions created by the actual VINSS architecture.

**Status:** Global AML/CFT & sanctions issue spotting
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** This document is not legal advice. It does not conclude that VINSS or DXJ Labs is, or is not, subject to any AML/CFT, sanctions, VASP, CASP, MSB, money-transmission, Travel Rule, customer-due-diligence, reporting, or screening obligation in any jurisdiction.

---

# 1. Separate Legal Obligation From Product Risk

VINSS must keep two questions separate:

```text
Is the relevant VINSS operator legally subject
to AML/CFT obligations in a jurisdiction?
```

and:

```text
Does VINSS create money-laundering,
terrorist-financing, sanctions,
fraud, or other illicit-finance risk?
```

The second question can exist even before the first question is legally resolved.

Likewise:

```text
not classified as a VASP
        ≠
no sanctions risk

not classified as an MSB
        ≠
no fraud risk

privacy-preserving
        ≠
AML exemption

peer-to-peer
        ≠
compliance exemption

smart-contract settlement
        ≠
compliance exemption
```

The correct approach is:

```text
freeze product facts
        ↓
identify the legally relevant operator
        ↓
identify target jurisdiction
        ↓
determine AML/CFT and sanctions perimeter
        ↓
assess product-specific risk
        ↓
implement only the controls that are
legally required or risk-justified
```

---

# 2. Current VINSS Risk Surface

The AML/CFT and sanctions analysis should consider the complete service, not only Rekber funding.

Potential risk-bearing functions include:

```text
Private Room creation;
Invite;
encrypted Message;
structured Offer;
Rekber funding;
Fulfillment;
refund;
release;
dispute;
resolution split;
claim;
paymaster / sponsored transaction;
Agent;
Dispute Agent;
Settlement Certificate;
Points / loyalty;
future VINSS token;
future VINSS → DXJ mechanism.
```

Different functions create different risks.

For example:

```text
Message privacy
        ≠
movement of settlement principal

Settlement Certificate
        ≠
custody

Points
        ≠
token transfer

future token distribution
        ≠
current product-fee revenue.
```

---

# 3. Current Asset-Flow Questions

Before designing AML controls, freeze the real fund flow.

For every supported settlement asset document:

```text
asset;
token contract;
network;
Funder;
custody contract;
principal amount;
service fee;
fee recipient;
refund path;
release path;
dispute split;
claim path;
paymaster/sponsor involvement;
public identifiers;
off-chain operator involvement.
```

For the current Rekber design, the basic economic flow is:

```text
Funder
   │
   │ user-authorized transaction
   ▼
VinssEscrowRekber
   │
   ├── service-fee handling
   │
   └── custody principal
          │
          ├── release
          ├── refund
          └── dispute resolution
                 │
                 ├── payer share
                 └── payee share
                        ↓
                     claim
```

AML analysis should match this actual architecture.

---

# 4. FATF Global Layer

The Financial Action Task Force (FATF) sets international AML/CFT standards that influence national regulation of virtual assets and virtual asset service providers.

FATF does not directly license or approve VINSS.

The relevant legal obligations arise through the laws and regulations of the jurisdictions implementing FATF standards.

Current official baseline:

- FATF Updated Guidance for a Risk-Based Approach to Virtual Assets and VASPs (2021):
  https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-rba-virtual-assets-2021.html

- FATF Seventh Targeted Update on Implementation of the FATF Standards on Virtual Assets/VASPs (16 July 2026):
  https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html

The 2026 update reports continuing implementation gaps and increasing attention to:

```text
VA-enabled fraud;
organised-crime use of virtual assets;
stablecoin misuse;
P2P transactions through unhosted wallets;
offshore VASPs;
DeFi arrangements;
licensing / registration;
Travel Rule implementation;
supervision and enforcement.
```

For VINSS, FATF is a global reference layer.

It is not a substitute for local law.

---

# 5. FATF 2026 — Stablecoins & Unhosted Wallets

FATF published a targeted report on **Stablecoins and Unhosted Wallets — Peer-to-Peer Transactions** on 3 March 2026.

Official source:

https://www.fatf-gafi.org/en/publications/Virtualassets/targeted-report-stablecoins-unhosted-wallets.html

This matters to VINSS because current or future Rekber settlement may involve:

```text
stablecoins;
self-custody wallets;
peer-to-peer transfers;
smart-contract custody;
cross-border users.
```

The existence of a self-custody or unhosted wallet does not itself establish that:

```text
the user is suspicious;
the transaction is prohibited;
the service is regulated;
screening is legally required.
```

Risk controls should be proportionate and jurisdiction-specific.

Potential risk questions include:

```text
Is a stablecoin supported?

Who issued it?

Can the issuer freeze or block addresses?

Is the asset commonly used across borders?

Does the service interact with unhosted wallets?

Can risk be assessed using public settlement identifiers
without decrypting private deal content?

What obligations apply if VINSS is an in-scope service provider?
```

---

# 6. FATF 2026 — Offshore VASPs

FATF published **Understanding and Mitigating the Risks of Offshore Virtual Asset Service Providers** on 11 March 2026.

Official source:

https://www.fatf-gafi.org/en/publications/Virtualassets/Understanding-Mitigating-Risks-Offshore-VASPs.html

This is relevant to any globally accessible service because:

```text
operator jurisdiction
        may differ from
user jurisdiction
        may differ from
contract/network location.
```

VINSS should therefore maintain an explicit record of:

```text
operating entity;
place of establishment;
infrastructure locations;
target jurisdictions;
restricted jurisdictions;
local partners;
marketing channels;
supported assets;
service-provider roles.
```

Do not rely on:

```text
the blockchain is global
```

as an answer to jurisdictional AML obligations.

---

# 7. FATF 2026 — DeFi

FATF published a targeted report on regulatory challenges from decentralised finance on 21 July 2026.

Official source:

https://www.fatf-gafi.org/en/news/targeted-report-decentralised-finance-2026.html

This report matters because technical decentralisation does not necessarily eliminate the possibility that a jurisdiction identifies:

```text
owner;
operator;
service provider;
person with control or sufficient influence;
other accountable actor.
```

For VINSS, counsel should examine:

```text
Who deploys the contracts?

Who operates the frontend?

Who receives fees?

Who controls FeePolicy?

Who appoints resolver roles?

Who can change privileged roles?

Who operates the backend?

Who sponsors transactions?

Who markets the service?
```

Do not use:

```text
decentralized
```

as an AML conclusion.

---

# 8. Travel Rule

The FATF Travel Rule is implemented through national legal frameworks and applies to in-scope providers according to local law.

The 2026 FATF targeted update reports increasing implementation across jurisdictions.

VINSS should not implement a Travel Rule workflow solely because this document exists.

First determine:

```text
Is the relevant VINSS operator an obliged entity?

Which transaction types are in scope?

Which jurisdiction applies?

What thresholds or exceptions apply?

Which originator/beneficiary information is required?

When must information be transmitted?

To whom?

How should self-hosted/unhosted wallets be handled?

What privacy/security rules govern the information?
```

If VINSS is not legally in scope, unnecessary collection of identity data could conflict with the product's privacy and data-minimisation objectives.

The correct rule is:

```text
do not collect Travel Rule data by assumption;
do not ignore Travel Rule duties by assumption.
```

---

# 9. United States — FinCEN / BSA

FinCEN's 2019 guidance applies Bank Secrecy Act principles to certain business models involving convertible virtual currencies.

Official source:

https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

FinCEN emphasizes actual activity and facts.

VINSS-specific questions include:

```text
Does DXJ Labs accept value from one person?

Does DXJ transmit value to another person or location?

Does the smart contract independently execute the transfer?

Who controls contract roles?

Who determines settlement outcomes?

Does resolver authority change the analysis?

Does the operator act as a business?

Is the operator merely providing software?
```

If the relevant operator is an MSB / money transmitter, BSA obligations may become relevant.

This document does not conclude that VINSS is or is not an MSB.

State-level U.S. analysis is separate.

---

# 10. FinCEN Illicit-Activity Risk Indicators

FinCEN's 2019 advisory on illicit activity involving convertible virtual currency is an additional risk-reference source.

Official source:

https://www.fincen.gov/resources/advisories/fincen-advisory-fin-2019-a003

Any transaction-monitoring design should be based on:

```text
applicable legal duties;
actual VINSS business model;
actual available data;
risk-based thresholds;
documented escalation rules.
```

Do not mechanically import every banking or exchange red flag into VINSS.

A private settlement product has a different observable data surface.

---

# 11. OFAC Sanctions

U.S. sanctions analysis is separate from FinCEN classification.

OFAC published **Sanctions Compliance Guidance for the Virtual Currency Industry** on 15 October 2021.

Official source:

https://ofac.treasury.gov/recent-actions/20211015

OFAC's guidance is intended to help virtual-currency industry participants understand sanctions requirements, licensing/enforcement processes, and compliance best practices.

VINSS should determine:

```text
whether U.S. sanctions jurisdiction applies;
which actors are subject to OFAC requirements;
whether screening is required;
what identifiers can be screened;
when screening should occur;
what to do after a possible match;
how false positives are handled;
what records must be retained;
whether blocking/reporting duties apply;
whether an OFAC licence may be relevant;
how smart-contract constraints affect response options.
```

Do not assume:

```text
not an MSB
        =
OFAC does not matter.
```

---

# 12. Other Sanctions Regimes

A global product may be affected by sanctions regimes beyond OFAC.

Depending on the operating entity, infrastructure, staff, counterparties, users, and target markets, analyse:

```text
United Nations measures;
European Union sanctions;
United Kingdom sanctions;
Singapore sanctions framework;
Indonesian obligations;
other relevant national regimes.
```

The applicable regimes should be determined by counsel.

Do not create a single universal sanctions rule without identifying the legal nexus.

---

# 13. Sanctions Screening Design

If screening is legally required or adopted as a documented risk control, define exactly what is screened.

Possible identifiers:

```text
wallet address;
counterparty wallet;
settlement asset;
transaction hash;
public contract interaction;
user/account identifier;
country/IP signal;
legal name, only if lawfully collected;
other risk-provider signals.
```

Prefer a design that uses the minimum data necessary.

A privacy-preserving pattern may be:

```text
public settlement identifier
        +
wallet/address risk signal
        +
jurisdiction signal where appropriate
        +
selective escalation
```

rather than:

```text
decrypt and store every private Message
for continuous surveillance.
```

---

# 14. Screening Timing

Where screening is required, determine the correct control points.

Possible stages:

```text
room creation;
wallet connection;
before Rekber funding;
before release;
before dispute resolution;
before claim;
before token distribution;
before reward allocation.
```

Do not add every control point automatically.

Assess:

```text
legal requirement;
effectiveness;
false-positive impact;
contract state;
ability to prevent harm;
user rights;
privacy cost.
```

A screening design that cannot legally or technically act on a result should be reconsidered.

---

# 15. Smart-Contract Immutability & Positive Matches

A sanctions or AML process must account for what VINSS can actually do after principal has entered a smart contract.

Document:

```text
Can funding be prevented?

Can an active settlement be paused?

Can a claim be blocked?

Can an address be restricted?

Can an administrator freeze funds?

Can a resolver redirect funds?

Can funds be returned?

Can a sanctioned asset issuer freeze the token?

What legal authority permits any intervention?
```

Do not promise a compliance capability that the contracts do not possess.

Likewise, do not add arbitrary seizure powers merely for hypothetical compliance unless legally required and carefully designed.

---

# 16. Privacy-Preserving Compliance

VINSS should not treat privacy and compliance as opposites.

Preferred principle:

```text
comply with actual legal obligations
        while
collecting and disclosing the minimum necessary data.
```

Possible design goals:

```text
screen public identifiers where sufficient;
do not decrypt room content by default;
use case-level escalation;
limit compliance access;
log compliance decisions rather than entire private histories;
use retention schedules;
separate product analytics from compliance data;
avoid collecting identity data without a defined purpose.
```

Privacy architecture should make compliance more precise, not impossible.

---

# 17. No "Anonymous / Untraceable" Marketing

VINSS should not market itself as:

```text
anonymous;
untraceable;
sanctions-proof;
AML-proof;
compliance-proof;
impossible to block;
impossible to investigate;
no identity ever needed;
private from regulators;
perfectly anonymous escrow.
```

These claims create both legal and product risk.

Preferred privacy language is narrower:

> VINSS is designed to minimize unnecessary public exposure of private commercial coordination while preserving the public settlement state required for on-chain execution.

---

# 18. Rekber-Specific Illicit-Finance Risks

Rekber can potentially be abused for:

```text
fraud;
fake transactions;
collusive settlement;
wash activity;
self-dealing;
circular transfer;
layering;
sanctions evasion;
fake Fulfillment;
fake disputes;
false evidence;
artificial volume;
token farming;
referral farming.
```

These are risk categories, not assumptions about ordinary users.

Risk assessment should focus on patterns.

---

# 19. Dispute Abuse

A dispute system can become a separate attack surface.

Potential abuse:

```text
collusive parties create fake disputes;
false evidence is submitted;
resolver is bribed or compromised;
multiple wallets recycle funds;
split outcomes obscure economic purpose;
Dispute Agent is manipulated;
cases are generated to farm Points or reputation.
```

Controls to evaluate:

```text
case-level audit trail;
public settlement reference;
evidence commitment;
resolver identity;
decision record;
authorized split;
conflict checks;
rate limits;
anti-sybil rules;
manual escalation for high-risk cases.
```

Do not store excessive private evidence solely for fraud monitoring.

---

# 20. Agent / Dispute Agent

Normal Agent and Dispute Agent may receive user-selected context.

AML/sanctions processing should not silently repurpose Agent data unless:

```text
there is a lawful basis;
the user disclosure is accurate;
the purpose is documented;
access is controlled;
retention is defined.
```

Do not create a hidden compliance-surveillance pipeline through the Agent.

If Agent output is used to flag risk, define:

```text
what signals it can generate;
whether a human reviews;
false-positive handling;
whether it can block a user;
whether it can move funds;
whether the model provider receives sensitive data.
```

An LLM should not receive unconstrained authority to seize, redirect, or freeze user principal.

---

# 21. Resolver Governance & AML

If a resolver is involved in suspicious or sanctioned activity, document:

```text
who makes the legal compliance decision;
who makes the dispute decision;
whether those are separate roles;
whether the resolver can see screening results;
whether the resolver is permitted to act on them;
what happens if a legal restriction conflicts with the ordinary settlement path.
```

Do not assume:

```text
resolver
        =
compliance officer.
```

Role separation can reduce conflicts.

---

# 22. Supported Assets

AML/sanctions risk differs by asset.

Maintain an asset register:

| Field | Required information |
|---|---|
| Asset | STRK / USDC / future asset |
| Contract | Network address |
| Issuer | If applicable |
| Stablecoin | Yes / No |
| Freeze/block capability | If applicable |
| Redemption characteristics | If applicable |
| Known sanctions controls | If applicable |
| Jurisdiction issues | Counsel note |
| Risk review date | Date |

Adding a new asset should trigger AML/sanctions re-review.

---

# 23. Stablecoin-Specific Questions

For each stablecoin used in VINSS determine:

```text
issuer;
issuer jurisdiction;
freeze/block mechanics;
redemption rights;
blacklist mechanics;
transfer restrictions;
sanctions policy;
supported chains;
contract upgradeability;
issuer terms.
```

A stablecoin's centralized control features can affect:

```text
settlement certainty;
sanctions response;
refund expectations;
user disclosure;
contract risk.
```

Do not treat all ERC-20-like assets as legally or operationally equivalent.

---

# 24. Geographic Risk

Do not equate country risk with user guilt.

Geographic controls should be based on:

```text
legal restrictions;
sanctions;
licensing perimeter;
risk assessment;
regulator expectations;
operational capability.
```

Potential controls:

```text
restricted-country list;
IP/geolocation signal;
marketing restrictions;
feature restrictions;
asset restrictions;
manual review;
legal escalation.
```

Geo controls must have a documented legal or risk rationale.

---

# 25. High-Risk Activity Indicators

If transaction monitoring becomes legally required or risk-justified, define VINSS-specific signals rather than copying exchange rules blindly.

Potential patterns to evaluate:

```text
high-frequency self-dealing;
same economic parties across many wallets;
rapid fund-recycle patterns;
repeated full refunds;
repeated artificial disputes;
abnormal split patterns;
many rooms with no real Fulfillment;
repeated referral loops;
Points farming;
funding from known high-risk addresses;
claims to known high-risk addresses;
use inconsistent with stated product limits;
automated abuse of sponsored transactions.
```

A signal should trigger:

```text
review
```

not automatically:

```text
criminal conclusion.
```

---

# 26. Risk Scoring

If VINSS introduces wallet or transaction risk scoring, document:

```text
provider;
data source;
score meaning;
threshold;
false-positive process;
appeal/escalation;
retention;
jurisdiction;
vendor terms;
whether score affects access;
whether score affects settlement.
```

Do not expose a user to irreversible loss solely because a third-party score changed without a defined review process.

---

# 27. Customer Due Diligence / KYC

Do not introduce KYC merely because VINSS handles crypto.

First determine:

```text
whether KYC/CDD is legally required;
which users must be identified;
when identification is required;
what information is required;
whether simplified/enhanced measures apply;
what verification standard is required;
what retention period applies;
which vendor processes the identity data;
what cross-border transfers occur.
```

If required, collect only what is necessary.

If not required, excessive identity collection would conflict with VINSS's privacy objective.

---

# 28. Enhanced Due Diligence

Where law or risk requires enhanced due diligence, define:

```text
trigger;
additional information;
source-of-funds/source-of-wealth requirement, if applicable;
approval authority;
review frequency;
retention;
exit decision.
```

Do not use "high risk" as an undefined category.

---

# 29. Suspicious Activity Reporting

If an operating entity becomes subject to suspicious-activity reporting obligations, define:

```text
legal reporting authority;
filing threshold;
decision maker;
confidentiality restrictions;
recordkeeping;
escalation;
interaction with user support;
interaction with privacy rights;
interaction with smart-contract execution.
```

Do not disclose a confidential filing to a user where tipping-off restrictions apply.

This is jurisdiction-specific and should only be implemented after confirming the legal obligation.

---

# 30. Recordkeeping

If VINSS becomes subject to AML/CFT or sanctions recordkeeping, identify the minimum records required.

Potential categories:

```text
account / customer records;
wallet identifiers;
transaction records;
screening result;
case escalation;
CDD records;
risk assessment;
Travel Rule records;
suspicious-activity decision;
sanctions decision;
licensing/reporting records.
```

Retention periods must come from applicable law.

Do not invent a universal retention period.

---

# 31. Audit Trail

Operational compliance decisions should have a minimal, reviewable audit trail.

Example:

```text
case_id;
timestamp;
public transaction reference;
wallet/address screened;
rule/provider;
result;
reviewer;
decision;
reason code;
action;
legal basis / policy reference;
retention deadline.
```

Do not attach the entire private room history unless necessary.

---

# 32. Points & Loyalty Abuse

Current loyalty design should be evaluated for:

```text
Sybil wallets;
fake referrals;
self-referrals;
wash Rekber;
circular principal;
fake Fulfillment;
collusive successful settlement;
multiple wallets controlled by one actor;
sponsored-transaction abuse.
```

Points are not currently the same as a token.

However, if Points later influence token allocation, abuse can acquire financial significance.

---

# 33. Future VINSS Token

A token launch would expand AML/sanctions questions.

Potential workstreams:

```text
token purchaser/distribution screening;
jurisdiction restrictions;
presale KYC;
sanctions controls;
airdrop/reward screening;
treasury controls;
vesting;
market-making;
exchange listings;
staking/locking;
secondary transfers;
Travel Rule;
token issuer obligations.
```

Do not reuse the current product AML conclusion as the token AML conclusion.

---

# 34. VINSS → DXJ Future Mechanism

Any future VINSS → DXJ conversion mechanism requires separate analysis.

Risk questions include:

```text
who operates conversion;
who receives VINSS;
who supplies DXJ;
whether value transfer occurs on behalf of users;
whether redemption-like rights are created;
whether screening is required;
whether conversion creates money-transmission or exchange activity;
what records are required;
what jurisdiction applies.
```

This mechanism is future design only and should not be marketed as live.

---

# 35. Paymaster / Sponsor Abuse

Sponsored transactions create a separate economic abuse surface.

Potential risks:

```text
bot farming;
Sybil wallets;
repeated low-value spam;
sponsor depletion;
fake transaction volume;
referral farming;
Points farming.
```

Controls may include:

```text
rate limits;
wallet-level limits;
action eligibility;
abuse detection;
sponsor-budget limits;
manual blocking of sponsorship.
```

Blocking sponsorship is not necessarily the same as blocking the user's ability to transact independently.

Document that distinction.

---

# 36. Compliance vs Product Access

Separate:

```text
VINSS refusing to sponsor gas
```

from:

```text
VINSS preventing contract interaction
```

and:

```text
legal blocking/freezing of assets.
```

These have different technical and legal meanings.

Product documentation should not call all three:

```text
blocked
```

without explanation.

---

# 37. No Hidden Seizure Authority

Do not add arbitrary principal-seizure capability merely to create a broad "compliance" feature.

Any ability to:

```text
freeze;
redirect;
confiscate;
return;
burn;
block claim;
replace recipient
```

should have:

```text
technical necessity;
legal basis;
governance;
authorization;
auditability;
user disclosure;
security review.
```

The current bounded resolver architecture should not be expanded casually.

---

# 38. AML / Sanctions Vendor Register

If VINSS uses third-party screening/compliance vendors, maintain:

| Field | Required information |
|---|---|
| Provider | Legal entity |
| Service | Wallet screening / KYC / sanctions / analytics |
| Data sent | Exact categories |
| Data source | Provider description |
| Jurisdictions | Coverage |
| False-positive process | Documented |
| Retention | Current terms |
| Subprocessors | Current list |
| Security | Contract / standard |
| User impact | Block / review / informational |
| Last reviewed | Date |

Vendor output does not replace VINSS's legal responsibility where VINSS is legally responsible.

---

# 39. Compliance Decision Matrix

Before launch in a jurisdiction, record:

| Question | Decision |
|---|---|
| AML-regulated entity? | Yes / No / Unknown |
| Sanctions regime applicable? | Yes / No / Unknown |
| CDD/KYC required? | Yes / No / Conditional |
| Travel Rule required? | Yes / No / Conditional |
| Transaction monitoring required? | Yes / No / Conditional |
| Suspicious reporting required? | Yes / No / Conditional |
| Wallet screening required? | Yes / No / Conditional |
| Recordkeeping required? | Yes / No / Conditional |
| Geo restrictions required? | Yes / No / Conditional |
| Product changes required? | Details |
| Written counsel memo | Date / reference |
| Re-review trigger | Event/date |

Do not populate legal conclusions from this research file alone.

---

# 40. Launch Gate

Before actively targeting a jurisdiction, determine:

```text
[ ] operating entity
[ ] service classification
[ ] AML/CFT perimeter
[ ] sanctions nexus
[ ] supported assets
[ ] stablecoin issues
[ ] target users
[ ] target countries
[ ] restricted countries
[ ] CDD/KYC requirement
[ ] Travel Rule requirement
[ ] transaction-monitoring requirement
[ ] sanctions-screening requirement
[ ] suspicious-reporting requirement
[ ] recordkeeping requirement
[ ] vendor requirements
[ ] smart-contract response capability
[ ] privacy/data implications
[ ] Terms/disclosures
[ ] incident/escalation process
```

No checklist item should be marked complete solely because:

```text
a competitor does it;
an AI suggested it;
mainnet works;
the product is decentralized;
the user controls their wallet.
```

---

# 41. Current Non-Claims

Unless supported by current jurisdiction-specific legal analysis, VINSS should not state:

```text
VINSS has no AML obligations;

VINSS has no sanctions obligations;

VINSS is not a VASP;

VINSS is not an MSB;

VINSS is outside the Travel Rule;

self-custody users do not require screening;

smart contracts cannot be regulated;

privacy makes compliance unnecessary;

VINSS is legally anonymous;

no KYC will ever be required;

VINSS can never block users;

all jurisdictions allow the same P2P model;

the current product AML analysis covers a future token.
```

---

# 42. Change-Control Rule

Re-open AML/CFT and sanctions analysis when any of the following changes:

```text
operating entity;
target jurisdiction;
supported asset;
stablecoin;
Rekber contract;
custody path;
resolver;
resolver powers;
objective verifier;
admin powers;
fee recipient;
paymaster;
wallet integration;
new compliance vendor;
new identity/KYC flow;
new geographic targeting;
new local partner;
new Agent use;
new Dispute evidence flow;
Points economics;
token announcement;
token distribution;
presale;
VINSS → DXJ mechanism.
```

Also review when FATF, sanctions authorities, or local regulators materially change relevant rules or guidance.

---

# 43. Core AML/CFT & Sanctions Principle

VINSS should avoid both extremes:

```text
maximum surveillance by default
```

and:

```text
zero controls by assumption.
```

The preferred model is:

```text
identify actual legal obligations
        ↓
identify actual product risk
        ↓
use minimum necessary data
        ↓
apply proportionate controls
        ↓
preserve private deal content where possible
        ↓
document every material decision
        ↓
re-review when product or law changes.
```

The core rule is:

> **Compliance should be based on actual legal duties and actual risk, while VINSS preserves its privacy architecture by avoiding unnecessary identity collection, unnecessary plaintext access, and unnecessary surveillance.**
