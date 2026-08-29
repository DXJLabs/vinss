# VINSS Legal Risk Register

> **Purpose:** maintain a current, evidence-based register of material legal and regulatory risks that can affect VINSS product design, jurisdiction launch, mainnet operation, marketing, privacy, dispute handling, and any future token program.

**Status:** Advisor working register
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** This register is not legal advice and does not itself determine that VINSS is licensed, prohibited, compliant, non-custodial, a VASP/CASP/MSB, or otherwise classified in any jurisdiction.

Severity is a product-priority estimate, not a legal conclusion.

---

# 1. How to Use This Register

Every material risk should have:

```text
ID;
risk statement;
severity;
current state;
affected product area;
trigger;
required evidence;
required action;
decision owner;
review trigger.
```

A risk should not be treated as resolved because:

```text
the code works;
mainnet works;
a competitor operates similarly;
a regulator has not contacted VINSS;
an AI suggested a conclusion;
the product uses self-custody wallets;
the product is open source;
the product is described as decentralized.
```

The evidence standard is:

```text
technical fact
        ↓
operational fact
        ↓
official legal/regulatory source
        ↓
jurisdiction-specific analysis
        ↓
written decision
        ↓
implemented control
```

---

# 2. Risk States

Use the following states consistently.

| State | Meaning |
|---|---|
| `UNRESOLVED` | Material question remains open |
| `RESEARCHED` | Official-source research exists but no final VINSS-specific decision |
| `COUNSEL REQUIRED` | A jurisdiction/product-specific legal conclusion is needed |
| `CONTROL REQUIRED` | Legal/risk conclusion is sufficiently known but an operational control remains |
| `CONTROL IMPLEMENTED` | Required control exists and evidence is recorded |
| `MONITOR` | Current risk is accepted/managed but requires continuing review |
| `FUTURE` | Risk belongs to a feature/program not yet live |
| `RESTRICT` | Feature, user group, asset, or jurisdiction should not be actively served pending clearance |
| `CLOSED` | Risk no longer applies and closure evidence is recorded |

Do not move a risk directly from:

```text
UNRESOLVED
```

to:

```text
CLOSED
```

without evidence.

---

# 3. Severity Scale

| Severity | Meaning |
|---|---|
| `Critical` | Could block launch, create licensing/registration exposure, affect custody of user assets, create sanctions/AML exposure, or create major token/offering liability |
| `High` | Could create material legal, consumer, privacy, contractual, dispute, or enforcement exposure |
| `Medium` | Material but generally controllable through disclosure, process, documentation, or operational controls |
| `Low` | Limited impact or primarily housekeeping, provided it remains controlled |

Severity is not probability.

A low-probability event can still be `Critical` if the potential consequence is severe.

---

# 4. Current Core Risk Register

| ID | Risk | Severity | Current state | Primary evidence / action |
|---|---|---:|---|---|
| L-01 | Rekber is classified as regulated custody, escrow, crypto-asset, payment, or equivalent service in a target jurisdiction | Critical | `COUNSEL REQUIRED` | Jurisdiction-specific custody/control analysis based on current Rekber source and fund flow |
| L-02 | DXJ Labs or another VINSS operator is classified as money transmitter, MSB, VASP, CASP, payment service, DPT provider, or local equivalent | Critical | `COUNSEL REQUIRED` | Operator-role + asset-flow + jurisdiction analysis |
| L-03 | Resolver authority creates regulated intermediary status, escrow obligations, fiduciary duties, or additional liability | High | `COUNSEL REQUIRED` | Resolver governance and legal-role memo |
| L-04 | Admin, upgrade, pause, verifier, FeePolicy, or role-replacement powers create legally relevant control not reflected in public claims | High | `UNRESOLVED` | Privileged-role inventory + deployed-contract verification |
| L-05 | VINSS actively targets a jurisdiction before local perimeter analysis is complete | Critical | `CONTROL REQUIRED` | Jurisdiction matrix + launch-country decision process |
| L-06 | A sanctioned or legally restricted person/address uses VINSS in circumstances where the operator has applicable obligations | Critical | `COUNSEL REQUIRED` | Sanctions nexus + screening/escalation analysis |
| L-07 | VINSS becomes subject to AML/CFT duties without an adequate KYC/CDD, monitoring, reporting, or recordkeeping process | Critical | `COUNSEL REQUIRED` | Jurisdiction-specific AML perimeter analysis |
| L-08 | Applicable Travel Rule duties are missed | High | `COUNSEL REQUIRED` | VASP/CASP status + transaction-scope analysis |
| L-09 | VINSS collects unnecessary identity or compliance data where no legal/risk purpose exists | High | `CONTROL REQUIRED` | Data-minimisation review before KYC/screening rollout |
| L-10 | Privacy claims overstate actual backend, chain, wallet, Agent, or vendor data handling | High | `CONTROL REQUIRED` | Production data inventory + marketing claim audit |
| L-11 | Public Rekber state exposes more commercial/personal information than users reasonably understand | High | `CONTROL REQUIRED` | UI/Privacy Notice disclosure + state minimisation review |
| L-12 | Dispute evidence exposes unnecessary private or personal information | High | `CONTROL REQUIRED` | Selective evidence + access + retention policy |
| L-13 | External LLM/provider receives plaintext context without accurate disclosure or vendor governance | High | `CONTROL REQUIRED` | Provider register + Agent disclosure + retention review |
| L-14 | Cross-border personal-data transfers lack an applicable transfer mechanism or vendor safeguards | High | `COUNSEL REQUIRED` | GDPR/UK/SG/other transfer analysis |
| L-15 | Backend, hosting, proxy, analytics, or security logs process undeclared personal data | High | `UNRESOLVED` | Production infrastructure/log audit |
| L-16 | VINSS cannot satisfy applicable deletion/rights requests for operator-controlled data or misstates blockchain erasure capability | Medium | `CONTROL REQUIRED` | Rights workflow + blockchain immutability disclosure |
| L-17 | Dynamic fee or quote behavior is insufficiently disclosed | Medium | `CONTROL REQUIRED` | Quote UX + fee disclosure + Terms |
| L-18 | “Refund” causes users to believe both principal and VINSS service fee return | High | `CONTROL REQUIRED` | Principal/service-fee language audit |
| L-19 | Failure/revert UI incorrectly tells users that funds moved or did not move | High | `CONTROL REQUIRED` | State-aware error/receipt testing |
| L-20 | “Private”, “secure”, “protected”, “trustless”, “non-custodial”, “guaranteed”, or similar claims exceed evidence | High | `CONTROL REQUIRED` | Marketing claim register |
| L-21 | Rekber or resolver is described as legal arbitration, court, judge, or legally final process without a valid legal structure | High | `CONTROL REQUIRED` | Terminology controls + Terms review |
| L-22 | User-to-user Rekber dispute is confused with a complaint against VINSS | Medium | `CONTROL REQUIRED` | Separate complaint workflow |
| L-23 | Resolver conflict, compromise, unavailability, or inconsistent policy harms settlement outcomes | High | `CONTROL REQUIRED` | Resolver policy + security + conflict + replacement process |
| L-24 | Fully or materially automated AI dispute decisions create unfair, opaque, or legally problematic outcomes | High | `FUTURE` | Separate AI decision/legal review before automation |
| L-25 | Terms of Service do not match current contract behavior | High | `CONTROL REQUIRED` | Terms/source/UI reconciliation |
| L-26 | Privacy Notice does not match actual production systems/vendors | High | `CONTROL REQUIRED` | Production data-flow audit |
| L-27 | User-facing fee, risk, refund, or dispute disclosures are not available before economically material signatures | High | `CONTROL REQUIRED` | Mobile-first pre-sign disclosure audit |
| L-28 | Stablecoin or supported-asset characteristics trigger additional payment, e-money, custody, sanctions, or issuer-control issues | Critical | `COUNSEL REQUIRED` | Asset-by-asset legal/risk analysis |
| L-29 | Stablecoin freeze/blacklist or depeg behavior causes settlement outcomes not reflected in user disclosure | High | `CONTROL REQUIRED` | Asset-risk disclosure + incident procedure |
| L-30 | Paymaster/sponsorship model creates misleading “free” claims, economic abuse, or legally relevant service-control facts | Medium | `CONTROL REQUIRED` | Sponsor flow + pricing + access-control documentation |
| L-31 | Mainnet deployment is publicly described as regulatory approval, licence, audit, or guarantee | High | `CONTROL REQUIRED` | Marketing/release claim controls |
| L-32 | Production contract source, ABI, deployed configuration, or docs diverge and legal analysis relies on stale architecture | Critical | `CONTROL REQUIRED` | Release-linked technical fact pack |
| L-33 | Third-party open-source licence, NOTICE, attribution, or trademark obligations are missed | Medium | `CONTROL REQUIRED` | Dependency/licence audit |
| L-34 | Future VINSS token sale/distribution triggers securities, MiCA, financial-promotion, crypto-offer, or similar regulation | Critical | `FUTURE` | Dedicated token counsel before announcement/sale |
| L-35 | Points are communicated as guaranteed future VINSS entitlement or fixed-value claim | High | `CONTROL REQUIRED` | Loyalty copy + no-fixed-conversion rule |
| L-36 | Points/token incentives create wash deals, Sybil behavior, fake Fulfillment, or artificial settlement volume | High | `FUTURE` | Anti-farming program |
| L-37 | Presale money is accepted before issuer, seller, treasury, buyer eligibility, AML/sanctions, and sale terms are established | Critical | `FUTURE` | Presale launch gate |
| L-38 | VINSS → DXJ creates redemption, exchange, investment, money-transmission, payment, or other regulated rights | Critical | `FUTURE` | Dedicated VINSS→DXJ economic/legal memo |
| L-39 | Token staking/locking/reward design creates yield or investment claims not reflected in legal analysis | Critical | `FUTURE` | Separate final-design review |
| L-40 | Token/influencer/community marketing creates unsupported price, return, listing, buyback, or legal-status claims | Critical | `FUTURE` | Token marketing approval process |
| L-41 | New target jurisdiction is added without updating legal documents and launch controls | High | `CONTROL REQUIRED` | Jurisdiction change-control |
| L-42 | New asset, payment rail, fiat feature, or wallet integration changes legal perimeter without re-review | Critical | `CONTROL REQUIRED` | Product change-control |
| L-43 | Settlement Certificate is represented as legal judgment, proof of real-world performance, investment right, or proof of fraud | High | `CONTROL REQUIRED` | Certificate claim controls |
| L-44 | Reputation/Points consequences convert ordinary dispute outcomes into unsupported fraud/criminal labels | High | `FUTURE` | Neutral reputation policy |
| L-45 | Complaint, privacy, security, or legal escalation process is absent at public scale | High | `CONTROL REQUIRED` | Operational complaint/incident framework |

---

# 5. Critical Mainnet Launch Blockers

The following questions should be resolved or consciously restricted before broad mainnet promotion.

```text
[ ] Legal operating entity identified

[ ] Product fee recipient identified

[ ] Current deployed Rekber architecture frozen and documented

[ ] Supported settlement assets identified

[ ] Fund flow documented

[ ] Admin / upgrade / pause powers documented

[ ] Resolver authority documented

[ ] Objective verifier authority documented

[ ] FeePolicy control documented

[ ] Paymaster / sponsor role documented

[ ] Backend production data flow documented

[ ] Agent provider/data flow documented

[ ] Dispute evidence flow documented

[ ] Initial target jurisdictions identified

[ ] Restricted / unassessed jurisdictions identified

[ ] Custody / money-transmission perimeter reviewed for target markets

[ ] AML/CFT perimeter reviewed for target markets

[ ] Sanctions obligations reviewed

[ ] Privacy Notice matches production reality

[ ] Terms match source and UI

[ ] Fee disclosure matches executable pricing

[ ] Principal vs service-fee refund language is accurate

[ ] Complaint/support channel exists

[ ] Marketing claims have evidence

[ ] Mainnet is not marketed as legal approval
```

A successful mainnet transaction does not resolve these items.

---

# 6. Critical Custody / Settlement Risks

## L-01 — Rekber Classification

**Risk**

A jurisdiction may classify the actual Rekber service as:

```text
custody;
escrow;
payment service;
crypto-asset service;
transfer service;
other regulated intermediary activity.
```

**Current technical fact**

Settlement principal is held by:

```text
VinssEscrowRekber
```

during the active Rekber lifecycle.

Users retaining wallet private keys does not eliminate this fact.

**Required evidence**

```text
deployed contract;
source;
ABI;
fund flow;
admin powers;
resolver powers;
claim flow;
operator entity;
fee recipient;
supported assets;
target jurisdiction.
```

**State**

```text
COUNSEL REQUIRED
```

---

## L-02 — Money Transmission / VASP / CASP

**Risk**

The surrounding VINSS operator could be classified as an in-scope transfer, money-service, VASP, CASP, DPT, or similar provider.

**Key questions**

```text
Does operator accept/transmit value?

Does operator provide transfer service on behalf of users?

Who controls contract roles?

Who determines settlement?

Who receives fees?

Is the product merely software or an actively operated service?
```

**State**

```text
COUNSEL REQUIRED
```

---

## L-03 — Resolver Authority

**Risk**

Bounded resolver authority may still create legally relevant intermediary/control duties.

**Current technical boundary**

```text
payer_amount + payee_amount = custody_principal
```

The resolver cannot use the dispute-resolution mechanism to pay principal to itself.

**Remaining legal question**

```text
Does deciding the payer/payee economic split create
regulated, fiduciary, contractual, consumer, or other duties?
```

**State**

```text
COUNSEL REQUIRED
```

---

# 7. Critical AML / Sanctions Risks

## L-06 — Sanctions

Do not assume:

```text
self-custody
        =
no sanctions obligation.
```

Before target-market launch determine:

```text
applicable sanctions regime;
operator nexus;
screening requirement;
screening timing;
positive-match process;
recordkeeping;
blocking/reporting duty;
technical response capability.
```

**State**

```text
COUNSEL REQUIRED
```

---

## L-07 — AML/CFT

If VINSS becomes an obliged entity, controls may be needed for:

```text
CDD/KYC;
enhanced due diligence;
monitoring;
Travel Rule;
suspicious reporting;
recordkeeping;
risk assessment.
```

Do not implement broad identity collection until the legal/risk purpose is defined.

**State**

```text
COUNSEL REQUIRED
```

---

# 8. Critical Privacy Risks

## L-10 — Privacy Claims

Examples of dangerous unsupported claims:

```text
VINSS sees nothing;
everything is anonymous;
all Rekber data is private;
all data stays on your device;
the backend stores no personal data.
```

Before public claims, verify:

```text
frontend;
backend;
database;
hosting logs;
wallet/provider;
Privacy Pool;
paymaster;
Agent;
Dispute;
analytics;
support.
```

**State**

```text
CONTROL REQUIRED
```

---

## L-12 — Dispute Evidence

Dispute evidence can contain:

```text
identity;
shipping data;
payments;
private Messages;
screenshots;
documents;
source code;
commercial secrets.
```

Required controls:

```text
selective disclosure;
case-level access;
vendor disclosure;
retention;
deletion;
security;
access logs.
```

**State**

```text
CONTROL REQUIRED
```

---

# 9. Critical Consumer / Contract Risks

## L-18 — Refund Ambiguity

The product must distinguish:

```text
principal refund
```

from:

```text
VINSS service-fee refund.
```

A button or Terms clause using:

```text
Full refund
```

may be misleading if the service fee remains non-refundable.

**State**

```text
CONTROL REQUIRED
```

---

## L-20 — Marketing Claims

Maintain evidence for claims such as:

```text
private;
secure;
protected;
non-custodial;
trustless;
verified;
audited;
compliant;
legal;
guaranteed.
```

Preferred communication describes mechanisms rather than absolute results.

**State**

```text
CONTROL REQUIRED
```

---

## L-25 — Terms vs Source

The legal contract should match:

```text
contract state machine;
actual fee behavior;
refund behavior;
claim behavior;
resolver powers;
Agent behavior;
privacy flow.
```

A generic crypto Terms template is insufficient.

**State**

```text
CONTROL REQUIRED
```

---

# 10. Critical Technical-Legal Consistency Risk

## L-32 — Stale Architecture

Legal analysis can become invalid if based on an older architecture.

Maintain a release evidence pack:

```text
release/commit;
network;
deployed addresses;
verified source status;
ABI;
admin roles;
FeePolicy;
resolver/verifier;
supported assets;
backend version;
frontend version;
data flow;
fee flow;
legal-review version.
```

Evidence levels should remain distinct:

```text
implemented source
        ≠
build success
        ≠
test success
        ≠
testnet deployment
        ≠
testnet wallet E2E
        ≠
mainnet deployment
        ≠
source verification
        ≠
mainnet product E2E
        ≠
legal approval.
```

**State**

```text
CONTROL REQUIRED
```

---

# 11. Token Risk Register

Token risks remain `FUTURE` unless and until a token program becomes active.

## L-34 — Token Classification / Offer

Before any token announcement involving economic rights:

```text
issuer;
offeror;
rights;
supply;
allocation;
vesting;
sale;
distribution;
utility;
governance;
staking/locking;
secondary markets;
marketing;
target jurisdictions
```

must be frozen sufficiently for legal review.

**State**

```text
FUTURE
```

---

## L-35 — Points Promise

Current safe rule:

```text
Points
        ≠
VINSS
```

and:

```text
Points
        ≠
fixed token debt.
```

No fixed conversion should be promised unless deliberately created after legal review.

**State**

```text
CONTROL REQUIRED
```

---

## L-37 — Presale

Do not accept presale funds before:

```text
issuer;
seller;
treasury;
sale agreement;
buyer eligibility;
jurisdiction restrictions;
AML/sanctions;
vesting;
delivery;
tax/accounting;
risk disclosure.
```

**State**

```text
FUTURE
```

---

## L-38 — VINSS → DXJ

Current planning principles may consider:

```text
optional;
epoch-based;
hard-capped DXJ pool;
variable ratio;
no permanent fixed redemption;
VINSS burned after successful conversion.
```

Those constraints do not resolve legal classification.

**State**

```text
FUTURE
```

---

# 12. Risk Ownership

Every open risk should have a decision owner.

Possible roles:

```text
DXJ Labs product owner;
engineering owner;
privacy owner;
security owner;
compliance/legal owner;
external counsel;
token issuer board/governance, if created.
```

A risk without an owner is not controlled.

The register may remain public, but sensitive information such as counsel names, internal security design, sanctions cases, and personal data should remain in a private operational register where appropriate.

---

# 13. Evidence Required to Change State

## Research Evidence

Acceptable research input can include:

```text
official law;
regulator rule;
regulator guidance;
official enforcement material;
official FAQ;
official consultation/final policy;
court decision where relevant;
current regulator register.
```

Research is not the same as a VINSS-specific conclusion.

---

## Technical Evidence

Examples:

```text
source;
tests;
deployed bytecode/source;
ABI;
transaction trace;
admin-role query;
production configuration;
backend schema;
vendor contract/configuration.
```

---

## Legal Decision Evidence

Examples:

```text
written external counsel memo;
written internal legal analysis by qualified counsel;
regulator authorization/registration;
formal jurisdiction launch decision based on current facts.
```

---

## Control Evidence

Examples:

```text
production feature restriction;
geo/marketing restriction;
Terms;
Privacy Notice;
screening workflow;
resolver policy;
complaint process;
retention policy;
audit log;
marketing approval.
```

---

# 14. Risk Acceptance Rule

A risk may be accepted only when the record identifies:

```text
risk;
severity;
reason for acceptance;
decision maker;
supporting evidence;
product version;
jurisdiction;
remaining controls;
expiry/review trigger.
```

Do not use:

```text
we think it is probably fine
```

as risk acceptance.

---

# 15. Restriction Rule

Use `RESTRICT` when a material risk cannot be sufficiently resolved before launch.

Restriction can apply to:

```text
jurisdiction;
asset;
Rekber;
token feature;
marketing;
wallet/provider;
payment rail;
user type.
```

Restriction is a valid product decision.

Launching everywhere is not a required outcome.

---

# 16. Mainnet Decision Rule

Mainnet deployment should be treated as:

```text
engineering deployment status.
```

It must not automatically change:

```text
jurisdiction status;
custody classification;
AML status;
sanctions status;
privacy status;
consumer-law status;
token status.
```

Therefore:

```text
MAINNET
        ≠
LAUNCH-APPROVED.
```

---

# 17. Token Decision Rule

A technically complete token contract does not mean the token should launch.

The valid outcomes of token review include:

```text
LAUNCH;
MODIFY;
RESTRICT;
DELAY TOKEN;
DO NOT LAUNCH.
```

Token urgency is not a legal criterion.

---

# 18. Before Broad Mainnet Promotion

Minimum evidence pack:

```text
[ ] product fact sheet
[ ] architecture diagram
[ ] deployed addresses
[ ] fund flow
[ ] fee flow
[ ] privileged-role map
[ ] resolver governance
[ ] asset list
[ ] target jurisdiction list
[ ] jurisdiction matrix
[ ] AML/sanctions decisions
[ ] privacy data inventory
[ ] vendor register
[ ] Terms
[ ] Privacy Notice
[ ] fee disclosure
[ ] risk disclosure
[ ] refund language
[ ] complaint process
[ ] marketing claim register
[ ] production E2E evidence
```

---

# 19. Before New Jurisdiction Targeting

Re-review:

```text
L-01 custody;
L-02 transfer/VASP/CASP/MSB;
L-05 targeting;
L-06 sanctions;
L-07 AML;
L-08 Travel Rule;
L-10 privacy claims;
L-14 cross-border data;
L-17 pricing;
L-20 marketing;
L-25 Terms;
L-28 supported assets.
```

Do not copy another jurisdiction's legal conclusion.

---

# 20. Before New Asset Support

Re-review:

```text
asset legal classification;
issuer;
freeze/blacklist;
redemption;
payment/stablecoin status;
custody;
AML/sanctions;
fee pricing;
oracle;
refund;
incident behavior;
consumer disclosure.
```

---

# 21. Before Resolver Change

Re-review:

```text
appointment;
replacement;
powers;
economic limits;
conflicts;
evidence access;
security;
privacy role;
liability;
availability;
incident response.
```

---

# 22. Before Agent Provider Change

Re-review:

```text
data sent;
retention;
training use;
subprocessors;
storage region;
security;
cross-border transfers;
user disclosure;
Dispute evidence impact.
```

---

# 23. Before Token Announcement

Re-review:

```text
L-34 token classification;
L-35 Points promise;
L-36 farming;
L-37 presale;
L-38 VINSS→DXJ;
L-39 staking/locking;
L-40 token marketing;
privacy;
AML/sanctions;
tax/accounting;
consumer protection.
```

Do not announce economic rights before this review.

---

# 24. Advisor Review Cadence

Review the register:

```text
before broad mainnet promotion;

before active targeting of a new jurisdiction;

before supporting a new asset;

before changing resolver or verifier authority;

before changing admin/upgrade/pause controls;

before fiat/payment-rail support;

before new Agent/LLM provider;

before new Dispute evidence workflow;

before token marketing;

before presale;

before VINSS → DXJ;

after material regulator/law changes;

after material production incidents;

at least quarterly while the product is scaling.
```

---

# 25. Closure Rule

A risk can be `CLOSED` only when:

```text
the underlying feature/risk no longer exists;
or
a definitive decision and all required controls are complete.
```

Closure record must include:

```text
date;
decision;
evidence;
product version;
jurisdiction if relevant;
reviewer;
reason no further monitoring is required.
```

If continued monitoring remains necessary, use:

```text
MONITOR
```

instead of `CLOSED`.

---

# 26. Core Risk Principle

The purpose of this register is not to prove VINSS is risk-free.

The purpose is to ensure that important questions are visible before they become production incidents, regulatory problems, misleading user claims, or binding token promises.

The operating principle is:

```text
identify
        ↓
verify facts
        ↓
research
        ↓
obtain required legal decision
        ↓
implement controls
        ↓
record evidence
        ↓
monitor change.
```

The core rule is:

> **No material legal risk should be treated as resolved because the architecture sounds decentralized, because mainnet works, or because a similar product exists. Resolve risks with current facts, current law, documented decisions, and implemented controls.**
