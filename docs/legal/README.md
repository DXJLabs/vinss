# VINSS Legal & Regulatory Research

> **Purpose:** issue-spotting and regulatory research for VINSS as a global product of DXJ Labs.

**Status:** Advisor research baseline  
**Last reviewed:** 2026-08-30  
**Owner:** DXJ Labs  
**Product:** VINSS  
**Important:** This directory is **not legal advice, a legal opinion, or a statement that VINSS is licensed or lawful in every jurisdiction**.

VINSS is designed as a global Private Deal Room with encrypted coordination, structured Offers, Rekber settlement, Fulfillment, review/dispute paths, and optional settlement evidence.

That creates several regulatory questions that cannot be answered only by reading smart-contract code.

The key legal question is not:

```text
Is VINSS decentralized?
```

The useful questions are:

```text
Who provides the service?

Who controls the user relationship?

Who controls or can redirect assets?

Who determines settlement outcomes?

Who receives fees?

Who processes personal data?

Who markets the product into each jurisdiction?

What changes if VINSS token launches?
```

---

## Read in This Order

1. [`global-regulatory-framework.md`](global-regulatory-framework.md)
2. [`jurisdiction-matrix.md`](jurisdiction-matrix.md)
3. [`custody-and-money-transmission.md`](custody-and-money-transmission.md)
4. [`privacy-and-data-protection.md`](privacy-and-data-protection.md)
5. [`aml-sanctions.md`](aml-sanctions.md)
6. [`consumer-protection.md`](consumer-protection.md)
7. [`dispute-and-settlement.md`](dispute-and-settlement.md)
8. [`token-regulatory-notes.md`](token-regulatory-notes.md)
9. [`legal-risk-register.md`](legal-risk-register.md)
10. [`regulatory-sources.md`](regulatory-sources.md)

---

# Research Principle

The product should distinguish:

```text
software capability
        ≠
regulated service classification
```

A smart contract can be non-custodial in one technical sense while the surrounding operator, frontend, resolver, fee model, or business process may still create regulatory obligations in a jurisdiction.

Likewise:

```text
open source
≠
regulatory exemption

self-custody
≠
automatic exemption

privacy
≠
AML exemption

global website
≠
lawful global offering
```

---

# Current Legal Workstreams

## 1. Custody / Control

Determine whether DXJ Labs or any designated actor:

- holds private keys;
- controls user assets;
- can unilaterally release, refund, redirect, freeze, or seize principal;
- operates a resolver that can determine economic outcomes;
- operates contracts or admin keys that materially change custody behavior.

This is a primary classification issue.

---

## 2. Money / Crypto Transmission

Determine whether VINSS or DXJ Labs is:

- accepting and transmitting value;
- arranging transfer services;
- providing crypto-asset transfer services on behalf of clients;
- operating only user-directed software;
- providing a broader settlement/intermediation service.

The answer can differ by jurisdiction.

---

## 3. AML / CFT / Sanctions

Assess:

- VASP/CASP/MSB perimeter;
- sanctions exposure;
- geographic restrictions;
- wallet/address screening;
- suspicious activity obligations if regulated;
- recordkeeping;
- Travel Rule exposure where applicable.

Do not assume privacy architecture removes these questions.

---

## 4. Privacy / Data Protection

Map what DXJ Labs actually processes:

```text
wallet addresses;
account metadata;
IP / device logs;
backend activity;
support / feedback;
Agent prompts;
Dispute evidence;
email or social contact data;
analytics;
transaction references.
```

Encrypted payloads reduce exposure but do not automatically mean VINSS processes no personal data.

---

## 5. Consumer / Contract Protection

Review:

- fee disclosure;
- dynamic pricing;
- irreversible transaction warnings;
- refund rules;
- Rekber role disclosures;
- dispute process;
- complaint handling;
- service availability disclaimers;
- Terms acceptance;
- privacy notice;
- marketing claims.

---

## 6. Token / Loyalty

Keep legally separate:

```text
Points
Settlement SBT
VINSS token
VINSS presale
VINSS → DXJ conversion
```

A future token launch creates regulatory questions that do not need to exist for the current product.

---

# Jurisdiction Strategy

VINSS should not claim:

> “Available legally worldwide.”

Use three operational categories instead:

```text
ASSESSED / LAUNCH-APPROVED
RESTRICTED
NOT YET ASSESSED
```

A country should move into `ASSESSED / LAUNCH-APPROVED` only after product facts and local legal analysis support it.

---

# Product Facts Counsel Must Receive

Any external legal counsel should receive a concrete product memo covering:

```text
1. entity operating VINSS;
2. entity receiving product fees;
3. smart-contract ownership/admin rights;
4. FeePolicy control;
5. Rekber custody mechanics;
6. resolver authority;
7. objective verifier authority;
8. whether DXJ can redirect funds;
9. whether DXJ can freeze transactions;
10. frontend transaction construction;
11. paymaster / sponsor role;
12. backend role;
13. Agent data flow;
14. Dispute evidence flow;
15. supported assets;
16. supported countries;
17. marketing channels;
18. Points / SBT design;
19. future VINSS token;
20. future VINSS → DXJ design.
```

Legal analysis based on an inaccurate architecture description is not useful.

---

# Current Non-Claims

This repository should not state that:

```text
VINSS is globally licensed;
VINSS is exempt from money-transmission regulation;
VINSS is not a VASP/CASP/MSB;
VINSS token is not a security;
VINSS has no AML obligations;
smart-contract custody is legally non-custodial everywhere;
privacy makes users legally anonymous;
all jurisdictions permit the same settlement model.
```

Those are jurisdiction- and fact-dependent conclusions.

---

# Update Rule

Review this directory when any of the following changes:

```text
custody architecture;
resolver powers;
supported asset;
supported country;
entity structure;
fee recipient;
token launch plan;
presale plan;
wallet integration;
payment rail;
fiat support;
Agent data access;
Dispute workflow.
```

Regulatory rules also change. Source dates matter.

See [`regulatory-sources.md`](regulatory-sources.md) for the current official-source registry.
