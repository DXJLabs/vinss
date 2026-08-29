# VINSS Global Regulatory Framework

> **Purpose:** provide a global legal-perimeter framework for analysing VINSS before jurisdiction-specific launch decisions.

**Status:** Advisor issue-spotting framework
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** This document is not legal advice, a licence determination, or a statement that VINSS may lawfully be offered in every jurisdiction.

VINSS is designed as a Private Deal Room that connects private coordination, structured agreement, Rekber settlement, Fulfillment, review, dispute, settlement, and optional settlement evidence.

The legal analysis must follow what the product **actually does**, who operates each part of it, and where it is offered.

---

# 1. Global Product Does Not Mean Global Authorization

VINSS may be designed for global reach.

That does not create:

```text
one global licence;
one global custody answer;
one global AML answer;
one global privacy answer;
one global consumer-law answer;
one global token answer.
```

The correct model is:

```text
global product architecture
        ↓
freeze actual product facts
        ↓
identify operator / entity / fee recipient
        ↓
identify targeted jurisdiction
        ↓
analyse local regulatory perimeter
        ↓
APPROVE / RESTRICT / LICENCE OR REGISTRATION NEEDED / UNKNOWN
        ↓
implement required product and operational controls
```

Technical accessibility is not the same as lawful targeting.

```text
website accessible in a country
        ≠
approved to market there

mainnet deployment
        ≠
regulatory approval

open-source repository
        ≠
regulatory exemption
```

---

# 2. Start From Functions, Not Labels

The legal perimeter should not begin from product labels such as:

```text
decentralized;
non-custodial;
self-custody;
peer-to-peer;
privacy-preserving;
escrow;
Rekber;
protocol;
software;
open source.
```

Those terms may describe parts of the architecture but do not independently decide legal status.

Instead analyse the functions performed.

For VINSS, relevant functions can include:

```text
frontend operation;
wallet transaction construction;
transaction sponsorship;
Private Room access;
encrypted Message coordination;
structured Offer coordination;
Rekber custody;
settlement execution;
fee collection;
dispute resolution;
objective verification;
backend/indexer operation;
Agent processing;
Dispute evidence processing;
Settlement Certificate issuance;
future token issuance or distribution.
```

A jurisdiction may regulate one function even if another function is outside its perimeter.

---

# 3. Current VINSS Regulatory Perimeter Map

The legal service map should be maintained as:

```text
DXJ Labs / relevant operating entity
        │
        ├── frontend
        ├── backend / indexer
        ├── Agent services
        ├── Dispute services
        ├── fee recipient
        ├── infrastructure / sponsorship
        ├── contract deployment / administration
        │
        └── VINSS product
               │
               ├── Invite
               ├── Private Message
               ├── Offer
               ├── Rekber
               ├── Fulfillment
               ├── Review / Revision
               ├── Dispute
               ├── Release / Refund / Resolution
               ├── Claim
               ├── Settlement
               └── Settlement Certificate
```

For every layer record:

```text
operator;
legal entity;
contract or service;
who pays;
who receives fees;
who can change behavior;
what data is processed;
which users are targeted;
which jurisdiction is relevant.
```

---

# 4. Current Technical Facts That Matter Legally

Legal analysis should remain synchronized with current technical documentation and deployed behavior.

## 4.1 User Wallets

Users sign transactions through their own wallets.

That can reduce direct operator control over user keys.

It does **not** automatically establish that every VINSS activity is legally non-custodial.

---

## 4.2 Rekber Custody

`VinssEscrowRekber` performs actual on-chain custody of supported settlement principal.

The relevant legal questions therefore include:

```text
Who deployed the contract?

Who controls privileged roles?

Can the contract be upgraded?

Can it be paused?

Who can affect settlement state?

Who can replace resolver/verifier roles?

Does DXJ Labs provide the custody/transfer service as a business?

Does local law treat autonomous smart-contract custody differently?
```

Do not simplify this to:

```text
smart contract holds funds
therefore
DXJ is not a custodian.
```

or:

```text
smart contract holds funds
therefore
DXJ is automatically a regulated custodian.
```

Both conclusions require jurisdiction-specific analysis.

---

## 4.3 Resolver Authority

Current VINSS dispute resolution is bounded by the settlement contract.

The resolver can authorize only a payer/payee allocation satisfying:

```text
payer_amount + payee_amount = custody_principal
```

The resolver cannot use the resolution mechanism to make itself the recipient of settlement principal.

The parties later claim their authorized shares.

These constraints are important because they limit arbitrary disposition of principal.

They do not by themselves answer whether:

```text
DXJ Labs;
the appointed resolver;
or another operator
```

is legally acting as an intermediary, escrow provider, dispute service, fiduciary, or other regulated actor.

---

## 4.4 Privacy Architecture

VINSS uses encrypted application coordination for Message, Offer, and private Rekber-related data.

Privacy should be described as:

> minimizing unnecessary public exposure of private commercial context.

It should not be described as:

```text
legal anonymity;
zero metadata;
no personal data;
AML immunity;
sanctions immunity;
untraceability.
```

Public blockchain state, wallet identifiers, network metadata, backend records, Agent requests, and Dispute evidence may still have legal relevance.

---

## 4.5 Fee Model

VINSS charges or plans product fees for certain actions.

Fee collection is relevant because it may support the factual conclusion that a service is being operated as a business.

However:

```text
charging a fee
        ≠
automatic classification as a custodian,
money transmitter, CASP, VASP, or payment institution.
```

The complete service model must be analysed.

---

# 5. International AML/CFT Layer — FATF

The Financial Action Task Force (FATF) sets international AML/CFT standards that influence national regulation of virtual assets and virtual asset service providers.

FATF does not itself:

```text
license VINSS;
approve VINSS;
decide VINSS classification in every jurisdiction.
```

It is an important global classification and risk-management reference.

Official baseline:

- FATF Updated Guidance for a Risk-Based Approach to Virtual Assets and VASPs (2021):
  https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-rba-virtual-assets-2021.html

- FATF Seventh Targeted Update on Implementation of the Standards on Virtual Assets/VASPs (16 July 2026):
  https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html

The 2026 targeted update reports continuing implementation gaps across jurisdictions while highlighting increasing risks involving:

```text
stablecoins;
peer-to-peer transactions through unhosted wallets;
offshore VASPs;
DeFi arrangements;
VA-enabled fraud and organised crime.
```

FATF also published a 2026 targeted report on regulatory challenges involving DeFi.

Official source:

https://www.fatf-gafi.org/en/news/targeted-report-decentralised-finance-2026.html

For VINSS, the FATF layer creates questions such as:

```text
Could an operator fall within a local implementation of VASP rules?

Does the Rekber service affect that analysis?

Does a resolver affect that analysis?

What Travel Rule duties would apply if VINSS becomes an in-scope service provider?

What controls are expected for sanctions, illicit-finance, stablecoin, or P2P risk?

Does the jurisdiction treat relevant DeFi arrangements as having an identifiable service provider?
```

The answer must come from the jurisdiction implementing FATF standards, not from FATF terminology alone.

---

# 6. United States

The United States requires multiple separate analyses.

```text
FinCEN / BSA
+
OFAC sanctions
+
state money-transmission law
+
consumer/privacy law
+
future securities / token analysis
```

No single U.S. crypto conclusion covers all of them.

## 6.1 FinCEN

FinCEN's 2019 guidance applies the Bank Secrecy Act framework to certain business models involving convertible virtual currencies.

Official source:

https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

FinCEN emphasizes the underlying facts and activities rather than labels attached to a business model.

VINSS-specific questions include:

```text
Does DXJ Labs accept value from one person?

Does DXJ Labs transmit value to another?

Does an autonomous smart contract execute settlement independently?

Who controls the contract?

Who determines settlement?

Does the resolver role change the analysis?

Is DXJ merely providing software or operating the transfer/settlement service?
```

A federal FinCEN analysis is not sufficient for state-law launch approval.

---

## 6.2 State Law

State money-transmitter and virtual-currency regimes may create separate obligations.

Therefore:

```text
federal conclusion
        ≠
all-state approval.
```

A U.S. launch plan should include a state-level strategy before broad active targeting.

---

## 6.3 OFAC

Sanctions obligations are separate from FinCEN registration.

A business can face sanctions exposure regardless of whether it is an MSB.

VINSS should separately determine:

```text
which sanctions regimes apply;
whether screening is required;
what identifiers can be screened;
what geographic restrictions are appropriate;
what happens after a positive match;
how immutable smart-contract behavior affects response options.
```

---

## 6.4 Future Token

Any future VINSS token sale, distribution, reward program, staking/locking design, or VINSS → DXJ right requires a fresh U.S. analysis based on final facts.

Do not treat current product operation as approval of a future token.

---

# 7. European Union / EEA

The Markets in Crypto-Assets Regulation (MiCA), Regulation (EU) 2023/1114, creates a regulatory framework for crypto-assets and crypto-asset service providers.

Official text:

https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng

Relevant MiCA service categories can include:

```text
custody and administration of crypto-assets on behalf of clients;
exchange services;
execution of orders;
reception and transmission of orders;
transfer services for crypto-assets on behalf of clients;
other defined crypto-asset services.
```

VINSS-specific questions include:

```text
Does DXJ Labs control crypto-assets or means of access on behalf of clients?

Does Rekber constitute or form part of a transfer service?

Is DXJ providing a service on behalf of clients?

Who is the service provider?

What role does resolver authority play?

What assets are supported?

Does stablecoin use create additional legal requirements?

Does a future VINSS token fall under MiCA or another EU financial-services regime?
```

EU analysis must also consider:

```text
GDPR;
consumer law;
marketing;
contract terms;
AML implementation;
cross-border service rules.
```

Self-custody wallets alone do not establish that VINSS is outside MiCA.

---

# 8. United Kingdom

The UK currently has multiple relevant crypto layers, including:

```text
Money Laundering Regulations;
cryptoasset financial-promotion rules;
the forthcoming broader FSMA cryptoasset regime;
UK GDPR and consumer law.
```

The FCA states that the new broader cryptoasset regulatory regime is expected to commence on **25 October 2027**.

Official sources:

- FCA new cryptoasset regime:
  https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation

- FCA registration under the MLRs ahead of the new FSMA regime:
  https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/registration-under-mlrs-ahead-new-fsma-regime

VINSS should not treat the future commencement date as a reason to ignore current UK obligations.

Before actively targeting UK users, determine:

```text
whether current MLR registration requirements apply;
whether financial-promotion rules apply;
whether future FSMA authorization will apply;
what transition rules matter;
what consumer requirements apply;
what UK GDPR obligations apply.
```

---

# 9. Singapore

Singapore regulation should be analysed separately under the actual service model.

Relevant questions include:

```text
Does VINSS provide a regulated payment service?

Does it provide a digital-payment-token service?

Who controls or transmits value?

Where is the operator established?

Which users are targeted?

What cross-border activity occurs?

What personal data is processed?
```

The Payment Services Act and MAS rules should be reviewed against current product facts before Singapore-directed launch.

Privacy obligations under the Personal Data Protection Act should be analysed separately.

See [`jurisdiction-matrix.md`](jurisdiction-matrix.md) and [`regulatory-sources.md`](regulatory-sources.md).

---

# 10. Indonesia

Indonesia should be treated as one jurisdiction in the global framework, not as the legal framework for every VINSS user.

Relevant analysis should include:

```text
digital-financial-asset / crypto perimeter;
payment or transfer activity;
local operating/entity questions;
marketing;
consumer protection;
personal-data protection;
future token activity.
```

Current OJK crypto/digital-financial-asset rules identified in the jurisdiction matrix include POJK 27/2024 and POJK 23/2025.

Their existence does not by itself determine VINSS classification.

A VINSS-specific Indonesian analysis remains required before treating Indonesia as launch-approved.

---

# 11. Privacy & Data Protection Is a Separate Layer

Even if VINSS is outside a financial-services licence in a jurisdiction, privacy/data rules may still apply.

Potential data includes:

```text
wallet identifiers;
IP addresses;
device/browser data;
support data;
feedback;
backend logs;
transaction references;
Agent prompts;
Dispute evidence;
account/contact information;
analytics.
```

Encryption reduces exposure.

It does not automatically eliminate controller/processor obligations or personal-data classification.

For every targeted jurisdiction determine:

```text
controller / processor roles;
lawful basis where applicable;
notice obligations;
data minimisation;
retention;
security;
rights handling;
international transfers;
subprocessors;
breach response.
```

See [`privacy-and-data-protection.md`](privacy-and-data-protection.md).

---

# 12. Consumer Protection Is Independent of Crypto Licensing

VINSS may charge users for digital services or transaction-related actions.

Consumer obligations can therefore exist even where the financial-regulatory perimeter does not require a licence.

Review:

```text
price disclosure;
dynamic-fee disclosure;
quote expiry;
service-fee treatment;
principal refund treatment;
irreversibility;
Rekber role descriptions;
Fulfillment requirements;
review periods;
Dispute process;
service failures;
complaints;
marketing claims;
security claims.
```

Do not use:

```text
licensed;
insured;
guaranteed;
risk-free;
trust account;
fiduciary;
court;
arbitration;
```

unless legally accurate for the relevant service and jurisdiction.

See [`consumer-protection.md`](consumer-protection.md).

---

# 13. Dispute Authority Requires Its Own Analysis

A technical resolver can be economically important without being a court or legal arbitrator.

VINSS must distinguish:

```text
smart-contract resolution
        ≠
legal arbitration

user-v-user product dispute
        ≠
legal claim against DXJ Labs.
```

Analyse:

```text
who appoints resolver;
who can remove resolver;
resolver conflicts;
decision rules;
evidence access;
privacy;
record retention;
appeal/review;
liability;
whether local ADR rules apply.
```

The bounded payer/payee split reduces arbitrary fund redirection but does not eliminate these questions.

See [`dispute-and-settlement.md`](dispute-and-settlement.md).

---

# 14. Token Regulation Is a Separate Future Workstream

The current VINSS product should not inherit legal conclusions from a future token design.

Keep separate:

```text
product
≠
Points
≠
Settlement Certificate / SBT
≠
VINSS token
≠
presale
≠
VINSS → DXJ.
```

Token analysis should consider:

```text
issuer;
rights;
sale structure;
distribution;
marketing;
expected profit;
utility;
governance;
staking / locking;
secondary trading;
team / investor allocation;
redemption or conversion;
AML / sanctions;
consumer / investor rules;
tax.
```

A token should not be marketed as legally approved merely because VINSS mainnet exists.

See [`token-regulatory-notes.md`](token-regulatory-notes.md).

---

# 15. Cross-Border Targeting

For legal launch analysis, distinguish:

```text
technical accessibility
from
active targeting.
```

Evidence of targeting can include:

```text
localized marketing;
country-specific campaigns;
local-language promotion;
local partnerships;
local payment rails;
country-specific pricing;
support directed at a market;
events or affiliates;
token promotion to residents.
```

Geo-blocking alone is not a complete legal strategy.

The operational question is:

> Which jurisdictions does VINSS intentionally serve, promote into, or structure services for?

That list should be explicit.

---

# 16. Jurisdiction Decision Framework

Before moving a jurisdiction to `LAUNCH-APPROVED`, freeze the relevant facts and obtain a current written decision.

Minimum analysis:

```text
1. operating entity
2. fee recipient
3. user flow
4. fund flow
5. custody/control
6. resolver/verifier authority
7. admin and upgrade powers
8. supported assets
9. paymaster/sponsorship
10. data flow
11. marketing/targeting
12. AML/CFT
13. sanctions
14. privacy
15. consumer law
16. licensing/registration
17. required disclosures
18. required product restrictions
```

Possible outcome:

```text
LAUNCH-APPROVED
RESTRICT
LICENCE / REGISTRATION NEEDED
PRODUCT CHANGE REQUIRED
COUNSEL REQUIRED
NOT YET ASSESSED
```

Do not force every jurisdiction into a launch/no-launch binary before the analysis is complete.

---

# 17. Required Legal Outputs

The legal workstream should ultimately produce:

```text
global regulatory framework;
jurisdiction matrix;
custody/control memo;
asset-flow diagram;
resolver-governance memo;
AML/sanctions policy decision;
privacy data inventory;
subprocessor/vendor map;
consumer disclosure matrix;
marketing claim register;
launch-country decision memos;
Terms of Service;
Privacy Notice;
Risk / Fee / Refund disclosures;
token memo if token design proceeds.
```

Research documentation is preparation for these outputs, not a substitute for them.

---

# 18. Change-Control Rule

A prior legal analysis should be re-opened when material facts change.

Triggers include:

```text
new custody contract;
new settlement asset;
resolver-power change;
objective-verifier change;
admin-key change;
upgradeability change;
pause/freeze capability;
new fee recipient;
new pricing model;
new paymaster;
new wallet or Privacy Pool integration;
new fiat/payment rail;
new Agent provider;
new Dispute evidence process;
new targeted country;
new local partner;
new Settlement Certificate rights;
new token rights;
presale;
VINSS → DXJ mechanism.
```

Legal conclusions should carry:

```text
jurisdiction;
product version;
architecture version;
date;
source set;
counsel / reviewer;
next review trigger.
```

---

# 19. Global Design Principle

The legal objective is not to hide regulated activity behind technical terminology.

VINSS should instead minimize unnecessary legal surface through clear and bounded architecture.

Preferred design direction:

```text
users retain their keys;
minimal privileged control;
bounded resolver authority;
no arbitrary resolver beneficiary;
transparent fees;
minimal personal-data collection;
selective Dispute evidence disclosure;
clear operator identity;
clear jurisdiction controls;
no unnecessary token promises.
```

The core principle is:

> **Minimize unnecessary custody, unnecessary discretion, unnecessary data collection, and unnecessary financial promises — then analyse the remaining service honestly in every jurisdiction that VINSS intends to target.**
