# VINSS Legal Risk Register

**Status:** Advisor working register  
**Last reviewed:** 2026-08-30  
**Not legal advice.**

Severity is a product-priority estimate, not a legal conclusion.

---

## Risk Register

| ID | Risk | Severity | Current state | Required evidence / action |
|---|---|---:|---|---|
| L-01 | Rekber classified as regulated custody/escrow/crypto service in a target jurisdiction | Critical | Unresolved | Jurisdiction-specific custody/control memo |
| L-02 | DXJ classified as money transmitter / VASP / CASP | Critical | Unresolved | Asset-flow + operator-role analysis |
| L-03 | Resolver authority creates regulated intermediary or additional liability | High | Unresolved | Resolver powers + governance memo |
| L-04 | Active global marketing reaches restricted/unassessed jurisdictions | High | Unresolved | Launch-country policy + geo/marketing controls |
| L-05 | Sanctioned person/address uses VINSS | Critical | Unresolved | Sanctions applicability + screening/escalation policy |
| L-06 | Privacy claim overstates actual backend/Agent data handling | High | Manageable | Data inventory + claim review |
| L-07 | Dispute evidence exposes unnecessary personal/private data | High | Manageable | Selective disclosure + retention rules |
| L-08 | Dynamic fees insufficiently disclosed | Medium | Manageable | Quote UX + Terms |
| L-09 | “Refund” language causes users to expect fee refund as well as principal | Medium | Manageable | Principal/service-fee distinction |
| L-10 | “Protected / secure / non-custodial” claims are legally or technically overstated | High | Manageable | Marketing claim register |
| L-11 | User-v-user resolver described as legal arbitration without proper structure | High | Avoidable | Use product terminology; counsel review |
| L-12 | External LLM receives plaintext without accurate privacy disclosure | High | Manageable | Vendor/data-flow map |
| L-13 | Cross-border personal-data transfers lack required mechanism | High | Unresolved | GDPR/UK/SG transfer analysis |
| L-14 | Consumer Terms do not match smart-contract behavior | High | Manageable | Terms vs source audit |
| L-15 | Stablecoin/payment support triggers additional payment regulation | Critical | Unresolved | Asset-specific jurisdiction analysis |
| L-16 | Future VINSS token sale triggers securities/crypto-offer regulation | Critical | Future | Token counsel before marketing/sale |
| L-17 | Points/token incentives generate wash deals / sybil / illicit-finance activity | High | Future | Anti-farming + AML design |
| L-18 | VINSS → DXJ conversion creates redemption/investment/right implications | Critical | Future | Dedicated economic/legal memo |
| L-19 | OSS third-party licence/NOTICE obligations missed | Medium | Manageable | Dependency/vendor licence audit |
| L-20 | Mainnet launch is publicly described as regulatory approval | Medium | Avoidable | Claim controls |

---

# Critical Launch Questions

Before broad mainnet promotion:

```text
[ ] Who legally operates VINSS?
[ ] Who receives fees?
[ ] Does DXJ control custody principal?
[ ] What exact authority does resolver have?
[ ] Can admin keys change settlement behavior?
[ ] Which jurisdictions are actively targeted?
[ ] Which are restricted?
[ ] What sanctions controls apply?
[ ] What data does backend process?
[ ] What does Agent disclose?
[ ] Are Terms and Privacy Notice published?
[ ] Are fee/refund disclosures accurate?
```

---

# Critical Token Questions

Before any VINSS token announcement involving economic rights:

```text
[ ] Issuer entity chosen
[ ] Jurisdiction chosen
[ ] U.S. analysis current
[ ] EU/MiCA analysis current
[ ] UK promotion analysis current
[ ] Singapore analysis where targeted
[ ] Indonesia analysis where targeted
[ ] Sanctions/KYC plan
[ ] Tax/accounting plan
[ ] Token rights frozen
[ ] VINSS → DXJ rights frozen
[ ] Vesting documentation
[ ] Marketing claims approved
```

---

# Risk Acceptance Rule

A risk can move from `Unresolved` only when there is evidence.

Examples:

```text
product assumption
≠ resolved

developer opinion
≠ resolved

AI research
≠ resolved

official regulator source
= strong research input

written counsel conclusion based on current product facts
= legal decision input
```

---

# Advisor Review Cadence

Review:

```text
before new jurisdiction targeting;
before new asset support;
before resolver changes;
before fiat support;
before token marketing;
after major regulator changes;
at least quarterly while the product is scaling.
```
