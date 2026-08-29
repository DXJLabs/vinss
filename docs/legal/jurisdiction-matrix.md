# VINSS Jurisdiction Matrix

**Status:** High-level research matrix — not launch approval  
**Last reviewed:** 2026-08-30  
**Not legal advice.**

This file is an advisor triage tool.

A row marked `HIGH-LEVEL RESEARCHED` does **not** mean VINSS may legally launch there without further review.

---

## Status Vocabulary

| Status | Meaning |
|---|---|
| `HIGH-LEVEL RESEARCHED` | Official framework identified; VINSS-specific counsel analysis still required |
| `COUNSEL REQUIRED` | Material licensing/classification question remains |
| `NOT YET ASSESSED` | No launch conclusion should be made |
| `RESTRICT` | Product should be blocked unless/until counsel clears it |
| `LAUNCH-APPROVED` | Reserved for a written, current jurisdiction-specific decision |

---

## Matrix

| Jurisdiction / Layer | Current status | Primary issues for VINSS | Official baseline |
|---|---|---|---|
| Global / FATF | HIGH-LEVEL RESEARCHED | VASP classification, AML/CFT, Travel Rule implementation by countries | FATF R.15 / VA-VASP guidance |
| EU / EEA | COUNSEL REQUIRED | MiCA CASP perimeter, transfer/custody, GDPR, consumer law, future token offer | MiCA, GDPR, EU consumer rules |
| United States — federal | COUNSEL REQUIRED | FinCEN MSB/money transmission, OFAC sanctions, SEC token/securities analysis, FTC consumer/privacy | FinCEN, OFAC, SEC, FTC |
| United States — state | NOT YET ASSESSED | State money-transmitter / virtual-currency licensing may differ | State-by-state analysis required |
| United Kingdom | COUNSEL REQUIRED | MLR crypto registration, financial promotions, future FSMA crypto regime, UK GDPR | FCA / ICO |
| Singapore | COUNSEL REQUIRED | Payment Services Act / DPT perimeter, PDPA, cross-border operations | MAS / PDPC |
| Indonesia | COUNSEL REQUIRED | OJK digital-asset/crypto perimeter, consumer/data rules, local entity/marketing questions | OJK / PDP framework |
| Other jurisdictions | NOT YET ASSESSED | Local crypto, payment, data, sanctions and consumer rules | Local counsel / regulator |

---

# Global / FATF

FATF standards influence how jurisdictions approach:

```text
virtual assets;
VASP licensing / registration;
AML/CFT;
risk-based controls;
Travel Rule.
```

FATF does not determine VINSS licensing directly.

Official sources:

- https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-rba-virtual-assets-2021.html
- https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html

---

# European Union / EEA

## Main issues

```text
Does DXJ Labs provide a MiCA crypto-asset service?

Does Rekber amount to custody/control?

Does VINSS provide transfer services on behalf of clients?

Are stablecoins / e-money tokens used?

Does future VINSS token fall under MiCA or another financial-instrument regime?

Does VINSS target EU consumers?

What personal data is processed?
```

MiCA includes regulated crypto-asset services such as custody and transfer services on behalf of clients.

Official MiCA:

https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng

EU consumer framework:

https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en

GDPR:

https://eur-lex.europa.eu/eli/reg/2016/679/oj

### Advisor state

```text
COUNSEL REQUIRED
```

No EU launch approval should be inferred from the fact that VINSS uses self-custody wallets.

---

# United States

## Federal

### FinCEN

Key question:

```text
Does the business accept and transmit value,
or otherwise operate as an administrator/exchanger/money transmitter?
```

Official guidance:

- 2013: https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering
- 2019: https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

### OFAC

Sanctions compliance can matter to virtual-currency businesses independently of FinCEN classification.

Official virtual-currency guidance:

https://ofac.treasury.gov/recent-actions/20211015

### SEC / Token

The SEC continues active rulemaking and policy work around crypto assets.

The future VINSS token should receive a fresh U.S. securities-law analysis based on its final facts.

Official current hub:

https://www.sec.gov/securities-topics/crypto-task-force

### State law

Federal analysis is insufficient.

State money-transmission and virtual-currency licensing can require separate review.

### Advisor state

```text
COUNSEL REQUIRED
```

---

# United Kingdom

The FCA states that firms providing certain cryptoasset services by way of business in the UK must register under the MLRs.

The FCA also states that financial-promotion rules can apply to cryptoasset promotions to UK consumers.

The new UK cryptoasset regulatory regime is scheduled to start on **25 October 2027**, with an authorisation gateway opening before then.

Official sources:

- https://www.fca.org.uk/firms/cryptoassets/who-needs-register
- https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/registration-under-mlrs-ahead-new-fsma-regime
- https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/what-you-need-to-do

Privacy:

https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/

### Advisor state

```text
COUNSEL REQUIRED
```

---

# Singapore

Important questions:

```text
Does the service fall within regulated payment / digital-payment-token activity?

Where is the operator established?

Who controls or transmits value?

What user data is collected, used, disclosed or transferred?
```

MAS materials confirm that Payment Services Act licensing includes digital-payment-token service licensees within relevant regulatory notices.

Example official MAS source:

https://www.mas.gov.sg/-/media/mas-media-library/regulation/notices/trpd/psn05/psn05-technology-risk-management-notice---6-feb-2024.pdf

PDPC baseline:

https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act

### Advisor state

```text
COUNSEL REQUIRED
```

---

# Indonesia

Indonesia is one jurisdiction in the global matrix, not the controlling framework for the whole product.

OJK regulates digital financial assets including crypto-assets through, among other instruments:

- POJK 27/2024, effective 10 January 2025;
- POJK 23/2025, amending POJK 27/2024.

Official sources:

- https://ojk.go.id/id/regulasi/Pages/POJK-27-2024-AKD-AK.aspx
- https://ojk.go.id/id/regulasi/Pages/POJK-23-2025-Perubahan-POJK-27-Tahun-2024-tentang-Penyelenggaraan-Perdagangan-Aset-Keuangan-Digital-Termasuk-Aset-Kripto.aspx

VINSS-specific perimeter analysis remains required.

### Advisor state

```text
COUNSEL REQUIRED
```

---

# Expansion Queue

Before targeted marketing, partnerships, or local payment integration, consider adding dedicated reviews for:

```text
Switzerland;
UAE / ADGM / DIFC;
Hong Kong;
Japan;
South Korea;
Australia;
Canada;
Brazil;
selected LATAM jurisdictions.
```

Do not copy conclusions between jurisdictions.

---

# Launch-Control Table

Maintain separately in private operations:

| Jurisdiction | Targeting allowed? | Product restrictions | Legal memo date | Counsel | Next review |
|---|---:|---|---|---|---|
| Example | No decision | — | — | — | — |

Do not put `Yes` unless a current decision exists.
