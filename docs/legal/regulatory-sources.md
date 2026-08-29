# VINSS Regulatory Source Registry

> **Purpose:** maintain the primary-source and regulator-source index used by the VINSS legal research documents, with enough context to identify what each source can and cannot support.

**Status:** Official-source research index
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** A source appearing in this registry is research evidence, not a VINSS-specific legal opinion, licence, registration, launch approval, or regulatory classification.

This registry should prefer current:

```text
legislation;
regulations;
regulator rules;
regulator guidance;
official FAQs;
official registers;
official enforcement/publication pages;
official international-standard-setter material.
```

Secondary commentary may help locate issues, but important VINSS conclusions should be traced back to primary or official sources.

---

# 1. Source Quality Hierarchy

Use this order where practical:

```text
1. legislation / regulation / official legal text
2. regulator rule / binding notice
3. regulator official guidance
4. regulator official FAQ / policy statement
5. regulator official register / licensing directory
6. regulator enforcement / decision
7. official consultation / speech / research
8. reputable secondary legal analysis
9. general media / industry commentary
```

Do not base a launch decision only on:

```text
blog;
tweet;
Telegram;
Discord;
competitor Terms;
competitor behavior;
AI answer;
search-result snippet.
```

An AI-generated research summary should identify its official sources before being relied upon.

---

# 2. Source Status Vocabulary

Use:

| Status | Meaning |
|---|---|
| `PRIMARY` | Legislation, regulation, rule, official legal text, or binding regulator notice |
| `OFFICIAL GUIDANCE` | Regulator/authority guidance interpreting or explaining applicable framework |
| `OFFICIAL REGISTER` | Current government/regulator licence, registration, or institution directory |
| `OFFICIAL RESEARCH` | Official policy/research material that informs risk analysis but is not itself local law |
| `MONITOR` | Official page useful for tracking future changes |
| `SUPERSEDED / HISTORICAL` | Retained only because older analysis may refer to it |

A source can be highly authoritative without answering the VINSS-specific legal question.

---

# 3. Global — FATF

FATF is an international standard setter.

FATF material is important for:

```text
AML/CFT;
Recommendation 15;
virtual assets;
VASPs;
Travel Rule;
stablecoin risk;
unhosted-wallet/P2P risk;
offshore VASP risk;
DeFi implementation.
```

FATF does not itself license or approve VINSS.

Local law implements FATF standards.

---

## 3.1 FATF — Updated Guidance for a Risk-Based Approach to Virtual Assets and VASPs

**Status:** `OFFICIAL RESEARCH / GUIDANCE`

Official:

https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-rba-virtual-assets-2021.html

Publication:

```text
2021
```

Use for:

```text
VA/VASP concepts;
risk-based AML/CFT framework;
Recommendation 15 context;
P2P and DeFi discussion;
licensing/registration concepts;
Travel Rule background.
```

Read together with later FATF updates.

---

## 3.2 FATF — Targeted Report on Stablecoins and Unhosted Wallets

**Status:** `OFFICIAL RESEARCH`

Official:

https://www.fatf-gafi.org/en/publications/Virtualassets/targeted-report-stablecoins-unhosted-wallets.html

Published:

```text
3 March 2026
```

Use for:

```text
stablecoin misuse risk;
P2P transactions;
unhosted/self-custody wallet risk;
risk-based controls;
cross-border VA risk.
```

Do not infer:

```text
unhosted wallet
        =
prohibited user.
```

---

## 3.3 FATF — Offshore VASPs

**Status:** `OFFICIAL RESEARCH`

Official:

https://www.fatf-gafi.org/en/publications/Virtualassets/Understanding-Mitigating-Risks-Offshore-VASPs.html

Published:

```text
11 March 2026
```

Use for:

```text
offshore VASP risk;
cross-border operator analysis;
regulatory arbitrage;
licensing/registration implementation;
global operator/user jurisdiction mismatch.
```

---

## 3.4 FATF — Seventh Targeted Update on Virtual Assets/VASPs

**Status:** `OFFICIAL RESEARCH`

Official:

https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html

Published:

```text
16 July 2026
```

Verified current at this review.

Use for:

```text
2026 implementation status;
Recommendation 15 progress/gaps;
licensing/registration;
Travel Rule;
supervision/enforcement;
VA-enabled fraud;
stablecoins;
unhosted-wallet P2P;
offshore VASPs;
DeFi challenges.
```

Important current statistic/context should be quoted only from the live report rather than copied indefinitely into VINSS documentation.

---

## 3.5 FATF — Targeted Report on Regulatory Challenges from DeFi

**Status:** `OFFICIAL RESEARCH`

Official:

https://www.fatf-gafi.org/en/news/targeted-report-decentralised-finance-2026.html

Published:

```text
21 July 2026
```

Use for:

```text
DeFi regulatory implementation;
identifiable owner/operator/provider questions;
control/influence analysis;
Recommendation 15 implementation gaps.
```

Do not use:

```text
decentralized
```

as a legal conclusion without local-law analysis.

---

## 3.6 FATF — Virtual Assets Topic Hub

**Status:** `MONITOR`

Official:

https://www.fatf-gafi.org/en/topics/virtual-assets.html

Use for:

```text
new FATF virtual-asset reports;
new targeted updates;
new VA/VASP implementation material.
```

Review this page when the VINSS legal source registry is updated.

---

# 4. European Union — Crypto / Financial Regulation

---

## 4.1 MiCA — Regulation (EU) 2023/1114

**Status:** `PRIMARY`

Official EUR-Lex:

https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng

Use for:

```text
crypto-asset definitions;
crypto-asset offers;
white papers;
ART/EMT;
CASPs;
custody and administration;
transfer services;
marketing communications;
consumer/client protections;
future VINSS token analysis.
```

VINSS-specific questions require mapping the actual operator, Rekber, resolver, supported assets, and service relationship to the Regulation.

---

## 4.2 GDPR — Regulation (EU) 2016/679

**Status:** `PRIMARY`

Official EUR-Lex:

https://eur-lex.europa.eu/eli/reg/2016/679/oj

Use for:

```text
personal data;
territorial scope;
controller/processor;
lawful basis;
transparency;
data minimisation;
security;
data-subject rights;
DPIA;
automated decision-making;
international transfers;
breach obligations.
```

Do not assume blockchain data or wallet identifiers are automatically outside GDPR.

---

# 5. European Union — Consumer Protection

---

## 5.1 Consumer Rights Directive — Directive 2011/83/EU

**Status:** `PRIMARY / OFFICIAL GUIDANCE`

European Commission overview:

https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en

Use for:

```text
distance-contract information;
pre-contract disclosures;
withdrawal/cancellation framework;
online consumer-contract baseline.
```

VINSS-specific applicability can depend on:

```text
consumer status;
service classification;
digital performance;
financial-service treatment;
national implementation.
```

---

## 5.2 Digital Content and Digital Services — Directive (EU) 2019/770

**Status:** `PRIMARY`

Official EUR-Lex:

https://eur-lex.europa.eu/eli/dir/2019/770/oj

Use for:

```text
digital-content/service conformity;
consumer remedies;
digital-service contract obligations.
```

Determine separately whether a specific VINSS function falls within scope or an exclusion.

---

## 5.3 Distance Financial Services — Directive (EU) 2023/2673

**Status:** `PRIMARY`

Official EUR-Lex:

https://eur-lex.europa.eu/eli/dir/2023/2673/oj/eng

European Commission consumer-contract overview:

https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en

The updated EU framework became applicable from:

```text
19 June 2026
```

according to the Commission's current consumer-contract materials.

Use if a VINSS service is legally characterized as a consumer financial service supplied at a distance.

---

## 5.4 Consumer ADR — Directive 2013/11/EU

**Status:** `PRIMARY`

Official EUR-Lex:

https://eur-lex.europa.eu/eli/dir/2013/11/oj/eng

Use for:

```text
consumer ADR framework;
independence;
impartiality;
transparency;
effectiveness;
fairness.
```

Do not equate:

```text
VINSS Resolver
        =
EU ADR entity.
```

Check the current consolidated text and national implementation before relying on specific obligations.

---

# 6. United States — FinCEN / BSA

---

## 6.1 FinCEN — 2013 Virtual Currency Guidance

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering

Use for:

```text
user;
administrator;
exchanger;
money-transmitter baseline;
convertible virtual currency.
```

Read together with later FinCEN guidance.

---

## 6.2 FinCEN — 2019 CVC Business Models Guidance

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

Use for:

```text
business-model analysis;
money-transmission perimeter;
software/service distinctions;
CVC activities;
DApps/business-model examples.
```

This remains an important source for VINSS Rekber/operator analysis.

It does not determine state money-transmission law.

---

## 6.3 FinCEN — 2019 Advisory on Illicit Activity Involving CVC

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fincen.gov/resources/advisories/fincen-advisory-fin-2019-a003

Use for:

```text
CVC illicit-finance risk indicators;
risk-based monitoring reference;
fraud/scam typologies.
```

Do not mechanically transplant every indicator into VINSS without product-specific analysis.

---

# 7. United States — Sanctions

---

## 7.1 OFAC — Sanctions Compliance Guidance for the Virtual Currency Industry

**Status:** `OFFICIAL GUIDANCE`

Official release page:

https://ofac.treasury.gov/recent-actions/20211015

Published:

```text
15 October 2021
```

Use for:

```text
virtual-currency sanctions compliance;
risk assessment;
screening;
geolocation;
transaction monitoring;
remediation;
reporting/licensing awareness.
```

Sanctions applicability is separate from FinCEN/MSB classification.

---

# 8. United States — Securities / Future Token

---

## 8.1 SEC — 2026 Crypto-Asset Interpretive Release

**Status:** `OFFICIAL GUIDANCE / INTERPRETIVE RELEASE`

Official SEC page:

https://www.sec.gov/rules-regulations/2026/03/s7-2026-09

Title:

```text
Application of the Federal Securities Laws to Certain Types
of Crypto Assets and Certain Transactions Involving Crypto Assets
```

SEC issue date:

```text
17 March 2026
```

Effective date:

```text
23 March 2026
```

Release numbers:

```text
33-11412
34-105020
```

File:

```text
S7-2026-09
```

Use for:

```text
current SEC crypto-asset taxonomy;
digital commodities;
digital collectibles;
digital tools;
stablecoin category discussion;
digital securities;
investment-contract analysis;
certain airdrop/reward transactions;
future VINSS token analysis.
```

Important:

```text
token category
        ≠
automatic conclusion about every transaction involving the token.
```

The actual VINSS token facts and surrounding promises/transactions must be reviewed.

---

## 8.2 SEC — 2026 Interpretive Release Fact Sheet

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.sec.gov/files/33-11412-fact-sheet.pdf

Use as a summary only.

For a legal conclusion, read the full interpretive release.

---

## 8.3 SEC — Crypto / Rulemaking Monitoring

**Status:** `MONITOR`

Official rulemaking activity:

https://www.sec.gov/rules-regulations/rulemaking-activity

Use to monitor post-March-2026 developments that could affect a future VINSS token.

Do not rely on an old token memo without checking for later SEC/CFTC/Congress changes.

---

# 9. United States — Consumer / Privacy / Security

---

## 9.1 FTC — FinTech

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.ftc.gov/business-guidance/credit-finance/fintech

Use for:

```text
consumer-protection;
fintech marketing;
unfair/deceptive practices;
financial-technology business guidance.
```

---

## 9.2 FTC — Advertising & Marketing

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.ftc.gov/business-guidance/advertising-marketing

Use for:

```text
truthful claims;
non-deceptive claims;
substantiation;
endorsement/marketing issues.
```

Relevant VINSS claims include:

```text
private;
secure;
protected;
guaranteed;
token returns;
fee claims;
refund claims.
```

---

## 9.3 FTC — Protecting Personal Information

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business

Use for:

```text
data inventory;
data minimisation;
security;
retention;
secure disposal;
incident planning.
```

State privacy and consumer law still require separate analysis.

---

# 10. United States — State Law

**Status:** `RESEARCH REQUIRED`

No single source in this registry can establish nationwide U.S. money-transmission or consumer-law approval.

Required work:

```text
state money transmission;
state virtual-currency regulation;
state consumer law;
state privacy;
state breach notification;
other state-specific licensing.
```

Create state-specific sources when a U.S. launch strategy is selected.

Do not mark:

```text
United States
        =
LAUNCH-APPROVED
```

from federal sources alone.

---

# 11. United Kingdom — Current Crypto Perimeter

---

## 11.1 FCA — Who Needs to Register

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/firms/cryptoassets/who-needs-register

Current page:

```text
First published: 24 October 2023
Last updated: 5 August 2026
```

as verified during this review.

The FCA states that firms providing certain in-scope cryptoasset services by way of business in the UK must register before beginning those services.

Use for:

```text
current MLR perimeter;
UK business nexus;
registration baseline;
current transition context.
```

---

## 11.2 FCA — MLR Registration Ahead of New FSMA Regime

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/registration-under-mlrs-ahead-new-fsma-regime

Current page first published:

```text
26 March 2026
```

and updated:

```text
30 June 2026
```

at this review.

Use for:

```text
current MLR requirements;
transition;
registration before new regime;
relationship between MLR registration and future FSMA authorization.
```

---

# 12. United Kingdom — New FSMA Cryptoasset Regime

---

## 12.1 FCA — What You Need to Do

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/what-you-need-to-do

The FCA currently states:

```text
application period opens: 30 September 2026
application period closes: 28 February 2027
new regime starts: 25 October 2027
```

The FCA identifies the future framework as the:

```text
Financial Services and Markets 2000 (Cryptoassets) Regulations 2026
```

Use for transition planning.

---

## 12.2 FCA — Cryptoasset Regulated Activities: FSMA and Handbook

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/fsma-handbook

Use for:

```text
new regulated activities;
FSMA framework;
FCA Handbook relationship;
future authorization perimeter.
```

---

## 12.3 FCA — Our Standards

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/our-standards

Use for:

```text
future crypto-firm standards;
Threshold Conditions;
Principles;
Consumer Duty;
SM&CR.
```

---

## 12.4 FCA — Authorisation, Supervision and Enforcement

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/authorisation-supervision-enforcement

Use for:

```text
future authorization;
supervision;
enforcement;
minimum standards.
```

---

# 13. United Kingdom — Cryptoasset Financial Promotions

---

## 13.1 FCA FG23/3 — Cryptoasset Financial Promotions

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/publications/fg23-3-finalised-non-handbook-guidance-cryptoasset-financial-promotions

Finalised:

```text
2 November 2023
```

Page last updated:

```text
6 February 2026
```

at this review.

Use for:

```text
qualifying cryptoasset promotions;
fair, clear and not misleading standard;
consumer understanding;
promotion communication/approval.
```

The FCA notes these rules can apply across:

```text
websites;
mobile apps;
social media;
other communications.
```

---

## 13.2 FCA — s.21 Approvers

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/s21-approvers

Use for:

```text
promotion approval route;
overseas/unregistered firm considerations;
transition into new regime.
```

The current FCA page links the promotion framework to:

```text
PS23/6;
FG23/3.
```

---

# 14. United Kingdom — Data Protection

---

## 14.1 ICO — Controllers and Processors

**Status:** `OFFICIAL GUIDANCE`

Official:

https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/

Use for:

```text
controller;
processor;
joint-controller analysis;
vendor relationships.
```

Because UK data law changed through the Data (Use and Access) Act 2025, confirm the current ICO page and revision status when relying on detailed guidance.

---

## 14.2 ICO — International Transfers

**Status:** `OFFICIAL GUIDANCE`

Official:

https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/

Use for:

```text
restricted transfers;
transfer mechanisms;
risk assessment;
UK transfer tools.
```

Verify current DUAA-related changes before final Privacy Notice or vendor contracting.

---

# 15. United Kingdom — Consumer Protection

---

## 15.1 CMA — Unfair Commercial Practices (CMA207)

**Status:** `OFFICIAL GUIDANCE`

Official GOV.UK page:

https://www.gov.uk/government/publications/unfair-commercial-practices-cma207

Published:

```text
4 April 2025
```

Last updated:

```text
18 November 2025
```

at this review.

Use for:

```text
Digital Markets, Competition and Consumers Act 2024;
misleading actions;
misleading omissions;
aggressive practices;
pricing;
drip pricing;
commercial practices.
```

---

# 16. United Kingdom — Arbitration

---

## 16.1 Arbitration Act 2025 Commencement

**Status:** `PRIMARY`

Official legislation:

https://www.legislation.gov.uk/uksi/2025/905/contents/made

Use for:

```text
commencement of Arbitration Act 2025 amendments;
UK arbitration framework timing.
```

The relevant amendments came into force on:

```text
1 August 2025
```

for the provisions covered by the commencement instrument.

This source is relevant only if VINSS intentionally creates a legally recognized arbitration model.

A technical Rekber resolver is not automatically an arbitrator.

---

# 17. Global Arbitration Reference

---

## 17.1 UNCITRAL Model Law on International Commercial Arbitration

**Status:** `OFFICIAL INTERNATIONAL LEGAL REFERENCE`

Official:

https://uncitral.un.org/en/texts/arbitration/modellaw/commercial_arbitration

Use for:

```text
arbitration agreement;
tribunal;
jurisdiction;
court intervention;
procedure;
award;
recognition/enforcement.
```

This is a reference framework, not proof that VINSS Dispute constitutes arbitration in any jurisdiction.

---

# 18. Singapore — Payments / Digital Payment Tokens

---

## 18.1 MAS — Notice PSN05 Technology Risk Management

**Status:** `PRIMARY / BINDING NOTICE`

Official:

https://www.mas.gov.sg/-/media/mas-media-library/regulation/notices/trpd/psn05/psn05-technology-risk-management-notice---6-feb-2024.pdf

The Notice applies to specified payment-system operators/settlement institutions and holders of payment-services licences carrying on Digital Payment Token Service.

Last revision stated in the Notice:

```text
6 February 2024
```

Use for:

```text
evidence of regulated DPT-service framework;
technology-risk obligations for in-scope licensees.
```

It is not a complete Singapore licensing analysis.

---

## 18.2 MAS — Financial Institutions Directory: Digital Payment Token Service

**Status:** `OFFICIAL REGISTER`

Official directory:

https://eservices.mas.gov.sg/fid/institution?activity=Digital+Payment+Token+Service&sector=Payments

The directory was actively updated during August 2026 at this review.

Use for:

```text
current licensed-institution examples;
Digital Payment Token Service activity;
licence/status verification.
```

Do not infer VINSS classification from the fact that another firm appears in or outside the register.

---

# 19. Singapore — Personal Data

---

## 19.1 PDPC — Personal Data Protection Act

**Status:** `OFFICIAL GUIDANCE / PRIMARY FRAMEWORK INDEX`

Official:

https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act

Use for:

```text
collection;
use;
disclosure;
accountability;
protection;
retention;
transfers;
access/correction;
breach obligations.
```

Review detailed PDPC guidance when Singapore-directed processing is planned.

---

# 20. Singapore — Consumer Protection

---

## 20.1 CCCS — Fair Trading Practices

**Status:** `OFFICIAL GUIDANCE`

Official:

https://www.cccs.gov.sg/consumer-protection/fair-trading-practices

Use for:

```text
Consumer Protection (Fair Trading) Act;
unfair practices;
misleading/deceptive conduct;
price/service representations.
```

Obtain current Singapore counsel analysis for VINSS-specific application.

---

# 21. Indonesia — Digital Financial Assets / Crypto

Indonesia is one jurisdiction in the global VINSS framework.

Do not treat Indonesian rules as the global VINSS legal framework.

---

## 21.1 OJK — POJK 27 Tahun 2024

**Status:** `PRIMARY`

Official:

https://ojk.go.id/id/regulasi/Pages/POJK-27-2024-AKD-AK.aspx

Title:

```text
Penyelenggaraan Perdagangan Aset Keuangan Digital
Termasuk Aset Kripto
```

Effective:

```text
10 January 2025
```

Use for:

```text
Indonesian digital-financial-asset / crypto trading framework;
operator/perimeter research;
transition of regulatory authority to OJK.
```

Do not conclude that every VINSS function falls within this regulation.

---

## 21.2 OJK — POJK 23 Tahun 2025

**Status:** `PRIMARY`

Official:

https://ojk.go.id/id/regulasi/Pages/POJK-23-2025-Perubahan-POJK-27-Tahun-2024-tentang-Penyelenggaraan-Perdagangan-Aset-Keuangan-Digital-Termasuk-Aset-Kripto.aspx

Title:

```text
Perubahan Atas Peraturan Otoritas Jasa Keuangan
Nomor 27 Tahun 2024 tentang Penyelenggaraan
Perdagangan Aset Keuangan Digital Termasuk Aset Kripto
```

Effective:

```text
10 November 2025
```

The OJK page states that the amendment adjusts, among other matters, digital-financial-asset trading mechanisms and digital-financial-asset derivative arrangements.

Read:

```text
POJK 27/2024
+
POJK 23/2025
```

together for current perimeter research.

---

# 22. Indonesia — Financial-Sector Consumer Protection

---

## 22.1 OJK — POJK 22 Tahun 2023

**Status:** `PRIMARY`

Official:

https://ojk.go.id/id/regulasi/Pages/Pelindungan-Konsumen-dan-Masyarakat-di-Sektor-Jasa-Keuangan.aspx

Title:

```text
Pelindungan Konsumen dan Masyarakat di Sektor Jasa Keuangan
```

Effective:

```text
22 December 2023
```

Use if the relevant VINSS entity/product falls inside the regulated financial-services-sector perimeter.

The OJK material covers areas including:

```text
product/service design;
information;
marketing;
agreements;
service delivery;
complaint handling;
dispute resolution;
market conduct.
```

Do not assume applicability before the VINSS operator/perimeter is classified.

---

# 23. Indonesia — Personal Data

The VINSS privacy workstream should also review Indonesia's personal-data protection framework, including:

```text
Law No. 27 of 2022 on Personal Data Protection;
current implementing regulations/guidance;
cross-border transfer rules;
controller/processor obligations.
```

Before relying on a specific implementation rule, add the current official government/JDIH source to this registry and record the verification date.

Do not use an unofficial mirror when an official source is available.

---

# 24. VINSS Internal Technical Sources

Legal research must also be tied to current VINSS technical facts.

Important repository source-of-truth categories:

```text
contracts;
contract tests;
ABI;
deployment addresses;
deployment configuration;
frontend transaction construction;
FeePolicy;
backend/indexer;
Agent data flow;
Dispute data flow;
paymaster integration;
supported asset configuration.
```

Relevant internal documentation includes:

```text
docs/technical/smart-contracts/README.md
docs/legal/custody-and-money-transmission.md
docs/legal/privacy-and-data-protection.md
docs/legal/dispute-and-settlement.md
docs/legal/jurisdiction-matrix.md
```

Internal documentation is supporting evidence.

For a production fact, verify executable source and deployed configuration where possible.

---

# 25. Evidence-Level Rule

Do not collapse these states:

```text
planned
        ≠
implemented

implemented
        ≠
tested

tested
        ≠
deployed

testnet deployed
        ≠
mainnet deployed

mainnet deployed
        ≠
source verified

source verified
        ≠
mainnet E2E

mainnet E2E
        ≠
legal approval.
```

A legal memo should identify which evidence level it reviewed.

---

# 26. Citation Rule for VINSS Legal Documents

When a VINSS legal document states a current regulatory fact, prefer a nearby official source.

Example:

```text
Claim:
The FCA states that the new UK cryptoasset regime
starts on 25 October 2027.

Source:
current FCA new-regime page.

Review date:
2026-08-30.
```

For volatile information such as:

```text
application windows;
registration procedures;
regulator guidance;
licence lists;
sanctions lists;
effective dates;
transition arrangements;
```

check the live source before publication or launch.

---

# 27. Do Not Overread a Source

An official source may establish:

```text
what the law says;
what the regulator says;
what the regulator currently requires of an in-scope firm.
```

It may not establish:

```text
that VINSS is in scope;
that VINSS is out of scope;
that DXJ Labs is licensed;
that a specific feature is lawful;
that no other law applies.
```

Example:

```text
MiCA defines crypto-asset services
        ≠
VINSS is definitely a CASP.

FinCEN guidance describes money transmission
        ≠
VINSS is definitely an MSB.

FCA registration guidance describes in-scope firms
        ≠
VINSS definitely requires FCA registration.
```

Those conclusions require application of law to current product facts.

---

# 28. Historical-Source Rule

Do not delete an older source merely because a new source exists if:

```text
an existing legal memo relied on it;
it explains historical transition;
it remains legally relevant.
```

Instead label:

```text
SUPERSEDED / HISTORICAL
```

and add the current source.

Avoid silently replacing legal history.

---

# 29. Broken-Link Rule

During each legal review:

```text
check official URL;
check title;
check publication/effective date;
check whether page was updated;
check whether a successor source exists.
```

If an official URL breaks:

```text
do not replace it with an unofficial source immediately;
search the regulator/legislation site for the successor;
record the replacement date.
```

---

# 30. Regulatory Monitoring Topics

Monitor at least:

```text
FATF VA/VASP updates;
EU MiCA implementation/guidance;
EU AML framework changes;
EU consumer/digital-service changes;
U.S. FinCEN/CFTC/SEC crypto changes;
U.S. state virtual-currency rules;
OFAC crypto sanctions guidance;
UK FSMA cryptoasset transition;
UK financial promotions;
UK data-law guidance;
Singapore PSA/DPT changes;
Singapore AML/DPT notices;
Indonesia OJK AKD/crypto rules;
Indonesia payment/custody perimeter;
Indonesia PDP implementing rules;
AI regulation affecting Agent/Dispute;
token-offer rules;
stablecoin regulation.
```

---

# 31. Regulatory Change Impact Rule

When a material source changes, review whether it affects:

```text
README.md
global-regulatory-framework.md
jurisdiction-matrix.md
custody-and-money-transmission.md
privacy-and-data-protection.md
aml-sanctions.md
consumer-protection.md
dispute-and-settlement.md
token-regulatory-notes.md
legal-risk-register.md
```

Do not update only this registry if the underlying legal analysis became stale.

---

# 32. Update Log

Use:

```text
YYYY-MM-DD

Jurisdiction / layer:
Source:
Source type:
Published/effective:
Change:
VINSS implication:
Documents affected:
Action:
Reviewer:
```

---

# 33. Current Review Log

## 2026-08-30 — Global / FATF

Verified:

```text
FATF Seventh Targeted Update
published 16 July 2026;

FATF DeFi targeted report
published 21 July 2026;

2026 stablecoin/unhosted-wallet report;

2026 offshore-VASP report.
```

Impact:

```text
AML/sanctions framework;
global regulatory framework;
jurisdiction matrix.
```

---

## 2026-08-30 — United States / SEC

Verified:

```text
SEC Interpretive Release S7-2026-09
issued 17 March 2026
effective 23 March 2026.
```

Impact:

```text
future VINSS token analysis.
```

---

## 2026-08-30 — United Kingdom / FCA

Verified:

```text
current MLR registration page;
new FSMA cryptoasset transition pages;
application period:
30 September 2026 → 28 February 2027;
new regime:
25 October 2027;
FG23/3 financial-promotion guidance.
```

Impact:

```text
jurisdiction matrix;
global framework;
consumer protection;
token notes.
```

---

## 2026-08-30 — Singapore / MAS

Verified:

```text
PSN05 official notice;
MAS Financial Institutions Directory
for Digital Payment Token Service.
```

Impact:

```text
Singapore perimeter research;
custody/AML workstreams.
```

---

## 2026-08-30 — Indonesia / OJK

Verified:

```text
POJK 27/2024
effective 10 January 2025;

POJK 23/2025
effective 10 November 2025;

POJK 22/2023
effective 22 December 2023.
```

Impact:

```text
jurisdiction matrix;
consumer protection;
crypto/digital-financial-asset perimeter research.
```

---

# 34. Core Source Principle

The source registry exists to prevent legal conclusions from becoming detached from the authority that supports them.

The operating rule is:

```text
find official source
        ↓
verify date/status
        ↓
identify exactly what it says
        ↓
map it to actual VINSS facts
        ↓
obtain jurisdiction-specific analysis where needed
        ↓
record decision
        ↓
monitor for change.
```

The core rule is:

> **Official sources are the foundation of VINSS legal research, but they do not become a VINSS-specific legal conclusion until they are applied to the actual product, operator, jurisdiction, asset flow, data flow, and launch model.**
