# VINSS Jurisdiction Matrix

> **Purpose:** maintain a conservative jurisdiction-by-jurisdiction launch and legal-perimeter triage for VINSS.

**Status:** High-level research matrix — not launch approval
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** A jurisdiction appearing in this file is not evidence that VINSS is licensed, registered, approved, or lawfully marketable there. A launch conclusion requires current VINSS-specific analysis of the actual operating entity, fund flow, resolver powers, data flow, assets, fees, and marketing.

---

# 1. Status Vocabulary

Use only the following statuses.

| Status | Meaning |
|---|---|
| `HIGH-LEVEL RESEARCHED` | Official regulatory framework identified; VINSS-specific legal analysis remains incomplete |
| `COUNSEL REQUIRED` | A material classification, licensing, registration, or launch question remains |
| `NOT YET ASSESSED` | No reliable VINSS-specific launch conclusion exists |
| `RESTRICT` | Active targeting/use should be blocked unless and until the relevant issue is cleared |
| `LAUNCH-APPROVED` | A current written jurisdiction-specific decision supports launch under documented conditions |

`LAUNCH-APPROVED` is intentionally difficult to obtain.

The following do not qualify:

```text
website accessibility;
mainnet deployment;
open-source publication;
self-custody wallet support;
use of smart contracts;
use of privacy technology;
general regulator guidance;
AI research;
developer opinion.
```

---

# 2. Decision Rule

A jurisdiction should be evaluated using the following order:

```text
actual VINSS architecture
        ↓
operating entity
        ↓
fund flow / custody / control
        ↓
resolver and verifier powers
        ↓
supported assets
        ↓
fees and sponsorship
        ↓
data processing
        ↓
marketing / targeting
        ↓
local financial-regulatory perimeter
        ↓
AML / sanctions
        ↓
privacy / consumer law
        ↓
launch decision
```

The legal decision should be tied to a specific product version and review date.

---

# 3. Current High-Level Matrix

| Jurisdiction / Layer | Current status | Primary VINSS issues | Current official baseline |
|---|---|---|---|
| Global / FATF | `HIGH-LEVEL RESEARCHED` | Local VASP implementation, AML/CFT, Travel Rule, P2P/unhosted-wallet and DeFi risk | FATF R.15, 2021 VA/VASP Guidance, 2026 Seventh Targeted Update |
| European Union / EEA | `COUNSEL REQUIRED` | MiCA CASP perimeter, custody/control, transfer service, stablecoin treatment, GDPR, consumer protection, future token | MiCA, GDPR, EU consumer framework |
| United States — federal | `COUNSEL REQUIRED` | FinCEN MSB/money transmission, OFAC sanctions, consumer/privacy, future token/securities analysis | FinCEN, OFAC, FTC, current federal crypto/securities framework |
| United States — state | `NOT YET ASSESSED` | State money-transmitter and virtual-currency licensing | State-by-state analysis |
| United Kingdom | `COUNSEL REQUIRED` | Current MLR perimeter, financial promotions, transition to new FSMA cryptoasset regime, UK GDPR, consumer law | FCA MLR regime and 2026 FSMA cryptoasset framework |
| Singapore | `COUNSEL REQUIRED` | Payment Services Act/DPT perimeter, cross-border service model, PDPA | MAS / PDPC |
| Indonesia | `COUNSEL REQUIRED` | OJK AKD/crypto perimeter, payment/transfer activity, local operator/marketing, consumer/data rules | POJK 27/2024 as amended by POJK 23/2025 |
| Other jurisdictions | `NOT YET ASSESSED` | Local financial, crypto, payment, AML, sanctions, privacy and consumer rules | Local regulator + local counsel |

No row is currently `LAUNCH-APPROVED` merely from this research matrix.

---

# 4. Global / FATF Layer

FATF standards shape national AML/CFT frameworks for virtual assets and virtual asset service providers.

FATF does not directly license or approve VINSS.

Official baseline:

- FATF Updated Guidance for a Risk-Based Approach to Virtual Assets and VASPs (2021):
  https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-rba-virtual-assets-2021.html
- FATF Seventh Targeted Update on Implementation of the FATF Standards on Virtual Assets/VASPs (16 July 2026):
  https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html
- FATF Targeted Report on Regulatory Challenges from DeFi (21 July 2026):
  https://www.fatf-gafi.org/en/news/targeted-report-decentralised-finance-2026.html

VINSS-specific questions:

```text
Could the relevant operator fall within a local VASP definition?

Does Rekber custody affect the classification?

Does resolver authority affect the classification?

Does transaction sponsorship affect the analysis?

What Travel Rule obligations would apply if VINSS becomes an in-scope provider?

What controls are expected for stablecoin, unhosted-wallet, P2P, sanctions, or DeFi-related risk?
```

### Current state

```text
HIGH-LEVEL RESEARCHED
```

This is a global reference layer, not launch approval for any country.

---

# 5. European Union / EEA

MiCA, Regulation (EU) 2023/1114, regulates crypto-asset issuance and defined crypto-asset services in the Union.

Official text:

https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng

Relevant service categories include, among others:

```text
custody and administration of crypto-assets on behalf of clients;
exchange;
execution of orders;
reception and transmission of orders;
transfer services for crypto-assets on behalf of clients.
```

MiCA Article 59 generally requires a person providing crypto-asset services in the Union to be appropriately authorised or otherwise permitted under the Regulation.

VINSS-specific questions:

```text
Does DXJ Labs control crypto-assets or means of access on behalf of clients?

Does VinssEscrowRekber constitute or form part of a regulated custody service?

Does VINSS provide transfer services on behalf of clients?

Does resolver authority amount to legally relevant control or intermediation?

Who is the actual service provider?

What role do supported stablecoins play?

What consumer-facing contractual requirements apply?

Does a future VINSS token fall under MiCA or another EU financial-services regime?
```

Separate EU workstreams:

```text
GDPR;
AML/CFT implementation;
consumer protection;
marketing;
cross-border provision;
token offering.
```

Self-custody wallets do not by themselves resolve the MiCA perimeter.

### Current state

```text
COUNSEL REQUIRED
```

### Launch condition

Do not mark EU/EEA `LAUNCH-APPROVED` until there is a written VINSS-specific perimeter analysis covering the actual Rekber and resolver architecture.

---

# 6. United States

U.S. analysis must remain separated into federal and state layers.

## 6.1 Federal — FinCEN / BSA

FinCEN's 2019 CVC guidance applies existing BSA principles to multiple business models.

Official source:

https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

VINSS questions:

```text
Does DXJ Labs accept value from one person?

Does it transmit value to another?

Does the smart contract execute settlement independently of DXJ?

Who controls contract roles?

Who determines a dispute allocation?

Is DXJ operating the settlement service as a business?

Is DXJ merely providing software, or performing a money-transmission function?
```

The answer must be based on actual operations, not labels.

### Current state

```text
COUNSEL REQUIRED
```

---

## 6.2 Federal — OFAC

Sanctions analysis is independent of FinCEN classification.

VINSS should determine:

```text
which U.S. sanctions obligations apply;
whether wallet/address screening is required;
whether geographic restrictions are required;
what escalation follows a possible match;
what technical action is possible after funds enter immutable or constrained contracts.
```

A conclusion that VINSS is not an MSB would not automatically eliminate OFAC obligations.

### Current state

```text
COUNSEL REQUIRED
```

---

## 6.3 State Law

State money-transmission and virtual-currency regulation may create additional requirements.

Therefore:

```text
federal analysis
        ≠
all-state approval.
```

A broad U.S. launch should not be approved from federal research alone.

### Current state

```text
NOT YET ASSESSED
```

A state strategy is required.

---

## 6.4 Future Token

Any future VINSS token distribution, presale, staking/locking design, reward distribution, secondary-market plan, or VINSS → DXJ right requires a separate fresh U.S. analysis.

Current VINSS product operation must not be used as evidence that future token activity is legally cleared.

---

# 7. United Kingdom

The UK currently has a transitional structure involving existing cryptoasset obligations and a broader forthcoming FSMA regime.

The FCA states that firms carrying on certain in-scope cryptoasset services by way of business in the UK must register under the Money Laundering Regulations before starting those services.

Official current FCA source:

https://www.fca.org.uk/firms/cryptoassets/who-needs-register

The FCA states that the new broader cryptoasset regulatory regime is expected to begin on **25 October 2027**.

The FCA also states that the application period for the new regime runs from **30 September 2026 to 28 February 2027**.

Official sources:

- https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation
- https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/what-you-need-to-do
- https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/registration-under-mlrs-ahead-new-fsma-regime

VINSS-specific questions:

```text
Does VINSS perform an activity currently in scope of the MLRs?

Does Rekber or the resolver create an in-scope cryptoasset service?

Will the service fall within a regulated activity under the new FSMA regime?

Does VINSS market qualifying cryptoassets to UK consumers?

What financial-promotion restrictions apply?

What UK consumer and UK GDPR duties apply?
```

The future commencement of the FSMA regime does not suspend current obligations.

### Current state

```text
COUNSEL REQUIRED
```

---

# 8. Singapore

Singapore should be evaluated against the exact VINSS service model.

Primary questions:

```text
Does VINSS provide a regulated payment service?

Does VINSS provide a digital-payment-token service?

Who controls, arranges, or transmits value?

Where is the operating entity?

Does the service target Singapore users?

What cross-border service activity occurs?

What user data is processed or transferred?
```

Any Singapore launch analysis should use current Payment Services Act and MAS materials rather than assuming all blockchain software falls inside or outside the same perimeter.

Privacy is a separate workstream.

The Singapore PDPC describes the Personal Data Protection Act as the baseline personal-data protection framework governing collection, use, disclosure and care of personal data.

Official PDPC source:

https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act

### Current state

```text
COUNSEL REQUIRED
```

---

# 9. Indonesia

Indonesia is one jurisdiction in the VINSS global matrix.

It should not be treated as the controlling legal framework for all users merely because DXJ Labs or project contributors may operate from Indonesia.

OJK's POJK 27/2024 governs the operation of digital financial asset trading, including crypto-assets, and became effective on 10 January 2025.

Official source:

https://ojk.go.id/id/regulasi/Pages/POJK-27-2024-AKD-AK.aspx

POJK 23/2025 amended POJK 27/2024 and became effective on 10 November 2025.

Official source:

https://ojk.go.id/id/regulasi/Pages/POJK-23-2025-Perubahan-POJK-27-Tahun-2024-tentang-Penyelenggaraan-Perdagangan-Aset-Keuangan-Digital-Termasuk-Aset-Kripto.aspx

VINSS-specific questions:

```text
Is the relevant VINSS activity within the OJK digital-financial-asset / crypto trading perimeter?

Does Rekber create a separate payment, transfer, custody, or intermediary issue?

Who is legally operating the service?

Does active marketing to Indonesian users change obligations?

What consumer-protection duties apply?

What personal-data rules apply?

What additional analysis would a future VINSS token require?
```

Do not infer that POJK 27/2024 or POJK 23/2025 automatically applies to every VINSS function.

Do not infer that VINSS is automatically outside those rules either.

### Current state

```text
COUNSEL REQUIRED
```

---

# 10. Expansion Queue

The following jurisdictions are commercially or structurally relevant enough to consider for future dedicated research:

```text
Switzerland;
United Arab Emirates;
ADGM;
DIFC;
Hong Kong;
Japan;
South Korea;
Australia;
Canada;
Brazil;
selected LATAM jurisdictions.
```

This list is a research queue, not a launch list.

Do not copy a legal conclusion from one jurisdiction into another.

---

# 11. Active Targeting vs Technical Accessibility

The jurisdiction matrix should track where VINSS is **actively targeted**, not only where the application can technically be opened.

Evidence of targeting can include:

```text
country-specific advertising;
local-language campaigns;
local partnerships;
local affiliates;
local payment rails;
market-specific onboarding;
country-specific pricing;
events;
community campaigns;
local customer support;
token promotion directed to residents.
```

A public blockchain application may remain technically accessible without every jurisdiction being intentionally targeted.

Legal counsel should still determine whether accessibility itself creates obligations in the relevant jurisdiction.

---

# 12. Restricted-Jurisdiction Logic

`RESTRICT` should be used when a current product, sanctions, licensing, marketing, or other material risk supports blocking active service pending clearance.

Restriction controls may include, depending on legal advice:

```text
geo restrictions;
IP controls;
account restrictions;
wallet/address screening;
asset restrictions;
feature restrictions;
marketing restrictions;
partner restrictions.
```

Do not claim that geoblocking alone guarantees compliance.

---

# 13. Private Launch-Control Register

The public legal documentation should not contain sensitive operational decisions unnecessarily.

Maintain a private launch register containing:

| Field | Example |
|---|---|
| Jurisdiction | Country / state / region |
| Current status | COUNSEL REQUIRED |
| Active targeting allowed | No / Conditional / Yes |
| Feature restrictions | Rekber disabled / token disabled / etc. |
| Asset restrictions | STRK / USDC / other |
| Legal memo date | YYYY-MM-DD |
| Counsel / reviewer | Private record |
| Product version | Commit / release |
| Next review | Date or trigger |

A public `LAUNCH-APPROVED` claim should only be made if appropriate and supported.

---

# 14. Minimum Counsel Questions Per Jurisdiction

For every jurisdiction considered for active launch, obtain answers to:

```text
1. Who is legally providing the VINSS service?

2. Is DXJ Labs or another operator a custodian?

3. Does Rekber constitute regulated escrow/custody?

4. Is any operator a money transmitter, VASP, CASP,
   payment service, DPT service, or local equivalent?

5. Does resolver authority change the classification?

6. Do admin/upgrade/pause powers change the classification?

7. Does FeePolicy or percentage-based Rekber revenue matter?

8. Are supported assets subject to specific restrictions?

9. Are stablecoins treated differently?

10. What AML/CFT duties apply?

11. What sanctions duties apply?

12. What Travel Rule duties apply?

13. What privacy/data obligations apply?

14. What consumer disclosures and contractual terms are required?

15. What marketing restrictions apply?

16. Is local licensing or registration required?

17. Is a local entity or local presence required?

18. Which features must be restricted?

19. Which user types must be excluded?

20. What triggers a mandatory re-review?
```

---

# 15. Approval Evidence Standard

A jurisdiction should move to `LAUNCH-APPROVED` only when the evidence record identifies:

```text
jurisdiction;
operating entity;
product version;
contract architecture;
supported assets;
resolver model;
fee model;
data flow;
marketing model;
legal classification;
required licence/registration status;
required controls;
written reviewer/counsel conclusion;
decision date;
review trigger.
```

The following are insufficient:

```text
README statement;
AI answer;
developer assumption;
competitor behavior;
absence of enforcement;
general regulator article;
successful mainnet transaction.
```

---

# 16. Change-Control Rule

Re-open a jurisdiction decision after material changes including:

```text
new Rekber contract;
new custody path;
new asset;
new stablecoin;
new resolver;
resolver-power expansion;
new objective verifier;
admin-key change;
upgradeability change;
pause/freeze control;
new fee recipient;
new fee model;
new paymaster;
fiat integration;
local payment integration;
new Agent provider;
new Dispute evidence workflow;
new local marketing;
new local partner;
token launch;
presale;
VINSS → DXJ mechanism.
```

A legal memo for an older product version should not automatically be carried forward.

---

# 17. Current Launch Position

This matrix currently supports the following conservative interpretation:

```text
VINSS has a global product architecture.

Global architecture does not equal global launch approval.

The major jurisdictions currently listed require
VINSS-specific legal analysis before they should be
represented as launch-approved.

Mainnet deployment is an engineering state,
not a jurisdictional legal status.
```

The matrix should become more specific over time as actual written jurisdiction decisions are obtained.
