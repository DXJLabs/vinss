# VINSS Global Regulatory Framework

**Status:** Issue-spotting framework  
**Last reviewed:** 2026-08-30  
**Not legal advice.**

---

# 1. Why a Global Framework Is Needed

VINSS is intended to be globally accessible.

Global availability creates overlapping legal questions because jurisdictions regulate different combinations of:

```text
custody;
money transmission;
crypto-asset services;
payments;
AML/CFT;
sanctions;
consumer services;
data processing;
financial promotion;
token issuance.
```

There is no single “global crypto license”.

The correct model is:

```text
global product architecture
        ↓
jurisdiction-specific perimeter analysis
        ↓
launch / restrict / seek licence / change product
```

---

# 2. Global FATF Layer

The Financial Action Task Force (FATF) provides international AML/CFT standards used by jurisdictions when regulating virtual assets and virtual-asset service providers.

FATF's virtual-asset guidance is not itself a licence for VINSS and does not directly decide whether DXJ Labs is a VASP in every country.

It is an important global classification and risk-management reference.

The 2026 FATF targeted update continues to assess implementation of Recommendation 15 across jurisdictions.

Official sources:

- FATF 2021 VA/VASP Guidance: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Guidance-rba-virtual-assets-2021.html
- FATF 2026 Targeted Update: https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html

---

# 3. The VINSS Regulatory Perimeter Map

VINSS should be analysed as several layers rather than one product label.

```text
DXJ Labs
   │
   ├── Web frontend
   ├── Backend / indexer
   ├── Agent / Dispute services
   ├── Fee recipient
   ├── Smart-contract deployment / administration
   │
   └── VINSS product
          │
          ├── Invite
          ├── Private Message
          ├── Offer
          ├── Rekber
          ├── Fulfillment
          ├── Review / Dispute
          ├── Settlement
          └── Certificate
```

Each layer can create different obligations.

---

# 4. Software vs Service

A central legal question is whether DXJ Labs is merely publishing software or is operating a service.

Facts indicating an active service can include:

```text
hosting the frontend;
operating backend infrastructure;
charging product fees;
controlling FeePolicy parameters;
providing customer support;
selecting supported assets;
operating a resolver;
operating an objective verifier;
marketing directly to users;
sponsoring transactions;
maintaining privileged contract roles.
```

Open-source code does not erase those operational facts.

---

# 5. Custody / Control

The technical and legal meaning of custody may differ.

For VINSS, counsel should determine who can:

```text
move principal;
change the recipient;
refund principal;
split principal;
freeze settlement;
upgrade custody logic;
change privileged roles;
recover or rotate keys.
```

A resolver that can authorize an exact payer/payee split is different from:

```text
DXJ Labs taking user private keys
```

but it is still economically important authority that should be analysed.

See [`custody-and-money-transmission.md`](custody-and-money-transmission.md).

---

# 6. Transfer / Money Transmission

Examples of regulatory approaches:

## United States

FinCEN's virtual-currency guidance focuses heavily on whether a person accepts and transmits value that substitutes for currency.

FinCEN states that administrators or exchangers may be money transmitters depending on the facts, and its 2019 guidance applies those principles to multiple business models.

Sources:

- https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering
- https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

## European Union

MiCA defines categories of crypto-asset services including:

```text
custody and administration;
exchange;
execution of orders;
placing;
reception/transmission of orders;
advice;
portfolio management;
transfer services on behalf of clients.
```

Official MiCA text:

https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng

Whether VINSS performs one of these regulated services depends on the actual operational model.

---

# 7. Financial Promotion / Marketing

Regulatory exposure may arise from marketing even before custody questions are resolved.

Example:

The UK FCA states that the UK cryptoasset financial-promotions regime can apply to firms marketing qualifying cryptoassets to UK consumers regardless of where the firm is based.

Source:

https://www.fca.org.uk/firms/cryptoassets/who-needs-register

This becomes especially important for:

```text
future VINSS token;
presale;
yield / staking language;
investment-return claims;
DXJ conversion claims.
```

---

# 8. Privacy / Data

Privacy-preserving architecture is legally useful but must be described precisely.

VINSS may still process:

```text
identifiers;
wallet addresses;
network metadata;
support data;
Agent prompts;
Dispute evidence.
```

GDPR, UK GDPR, Singapore PDPA and other national privacy laws may apply depending on establishment, targeting, users, and data flows.

See [`privacy-and-data-protection.md`](privacy-and-data-protection.md).

---

# 9. Consumer Protection

VINSS may charge users directly.

That creates a separate legal layer even if the crypto-specific service is ultimately outside a licensing perimeter.

Important topics:

```text
price disclosure;
dynamic fee disclosure;
refund expectations;
complaint handling;
service failure;
misleading security claims;
irreversible transactions;
terms around disputes;
digital-service quality.
```

EU consumer rules, for example, contain information and digital-service protections.

See [`consumer-protection.md`](consumer-protection.md).

---

# 10. Dispute Authority

Dispute design needs separate review because a technical resolver can become an economically powerful actor.

Questions:

```text
Is resolver discretionary?

Can resolver receive principal?

Can resolver redirect to third parties?

Who appoints resolver?

What evidence is disclosed?

What law governs the process?

Is the decision final?

Is there an appeal?

Does DXJ describe the process as arbitration?
```

Avoid using legal terms such as:

```text
arbitration
court
guarantee
insured
trust account
fiduciary
```

unless legally accurate.

See [`dispute-and-settlement.md`](dispute-and-settlement.md).

---

# 11. Token Layer

A VINSS token should be analysed independently from the current product.

Token facts that matter can include:

```text
sale;
marketing;
expected profit;
team allocation;
investor allocation;
utility;
governance;
redemption;
burn;
staking;
secondary markets;
VINSS → DXJ mechanism.
```

Do not rely on labels such as:

```text
utility token
loyalty token
governance token
```

as legal conclusions.

See [`token-regulatory-notes.md`](token-regulatory-notes.md).

---

# 12. Global Launch Rule

Before actively targeting a jurisdiction:

```text
1. freeze product facts;
2. map legal entity;
3. map asset flow;
4. map data flow;
5. map marketing;
6. run local perimeter analysis;
7. classify:
   APPROVED / RESTRICT / LICENCE NEEDED / UNKNOWN;
8. implement geo / product controls if required;
9. retain the legal memo;
10. re-review after material product changes.
```

---

# 13. Product Design Principle

Legal architecture should influence product decisions without destroying the product thesis.

Preferred approach:

> **Minimize unnecessary custody, unnecessary operator discretion, unnecessary personal-data collection, and unnecessary token promises.**

That reduces legal surface while also aligning with VINSS's privacy and trust-minimization goals.
