# VINSS Privacy & Data-Protection Legal Notes

**Status:** Global privacy issue spotting  
**Last reviewed:** 2026-08-30  
**Not legal advice.**

---

# 1. Privacy Architecture ≠ No Personal Data

VINSS can encrypt Message, Offer, and coordination content while still processing personal data.

Potential personal data includes:

```text
wallet address;
IP address;
device/browser identifiers;
account identifier;
support requests;
feedback;
transaction history;
room participation metadata;
Agent prompts;
Dispute evidence;
email / Telegram / social contact;
analytics.
```

Whether a wallet address is personal data depends on context and applicable law.

Do not market:

```text
VINSS stores no personal data
```

unless a verified data inventory supports it.

---

# 2. Data Inventory

Maintain a table:

| Data | Where collected | Purpose | Public / encrypted / plaintext | Retention | Recipient |
|---|---|---|---|---|---|
| Wallet address | Frontend/backend | Account / settlement | Public chain + app | TBD | DXJ / chain |
| Message ciphertext | Chain/indexer | Discovery | Ciphertext | TBD | Public / backend |
| Agent prompt | Backend | Requested assistance | Plaintext boundary | TBD | DXJ / LLM provider |
| Dispute evidence | Dispute workflow | Resolution | Intentional disclosure | TBD | DXJ/resolver |
| Support data | Support channel | Support | Plaintext | TBD | DXJ |

Complete this from source before publishing a Privacy Policy.

---

# 3. EU GDPR

Official GDPR:

https://eur-lex.europa.eu/eli/reg/2016/679/oj

Important workstreams include:

```text
territorial scope;
controller / processor roles;
lawful basis;
transparency;
data minimisation;
retention;
security;
data-subject rights;
international transfers;
processors/subprocessors;
breach response.
```

A global service can become subject to GDPR based on establishment or relevant offering/monitoring of individuals in the EU.

Do not treat lack of a European company as automatic exclusion.

---

# 4. UK GDPR

The ICO explains that controller/processor classification depends on who determines purposes and means of processing.

Official guidance:

- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/who-does-the-uk-gdpr-apply-to/

The ICO also states that UK GDPR can apply to organisations outside the UK that offer goods/services to individuals in the UK.

International-transfer guidance:

https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-brief-guide-to-international-transfers/

---

# 5. Singapore PDPA

The Singapore PDPC describes PDPA as a baseline data-protection regime governing collection, use, disclosure and care of personal data.

Official source:

https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act

Key themes include:

```text
purpose;
notification / consent where applicable;
protection;
accuracy;
retention limitation;
transfer limitation;
breach notification;
accountability.
```

---

# 6. U.S. Privacy / Security

The U.S. does not have one GDPR-equivalent omnibus federal privacy law covering every situation.

Federal and state rules may apply depending on facts.

The FTC provides business security guidance emphasizing:

```text
know what data you hold;
keep only what you need;
secure it;
dispose of it;
plan for incidents.
```

Official source:

https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business

State privacy laws require separate analysis where applicable.

---

# 7. VINSS Agent Boundary

Normal Agent and Dispute Agent should be legally documented as distinct processing contexts.

## Normal Agent

Target principle:

```text
user chooses to invoke;
privacy-reduced context;
no automatic full timeline;
clear provider disclosure.
```

## Dispute Agent / Resolver

Target principle:

```text
explicit disclosure;
specific evidence set;
specific purpose;
access logging;
limited retention;
limited recipients.
```

Do not use one generic privacy statement for both.

---

# 8. LLM Provider

If VINSS sends prompts/context to an external model provider, record:

```text
provider;
data location;
processor/controller role;
retention;
training policy;
subprocessors;
international transfer mechanism;
security terms.
```

The user should not be told:

```text
everything stays local
```

if an Agent request sends plaintext to an external backend/provider.

---

# 9. Dispute Evidence

Dispute evidence is especially sensitive because users may intentionally disclose:

```text
chat excerpts;
delivery evidence;
identifying information;
payment evidence;
documents.
```

Design:

```text
selective disclosure;
purpose limitation;
case-level access;
minimum necessary evidence;
retention schedule;
deletion where legally permitted;
audit trail.
```

---

# 10. Public Blockchain Data

A blockchain record may be:

```text
public
immutable
```

while still being relevant to personal-data analysis.

Avoid intentionally placing unnecessary personal data on-chain.

Preferred pattern:

```text
commitment / hash / status
instead of
plaintext identity / private terms.
```

---

# 11. Privacy Policy Gate

Do not finalize a Privacy Policy from product descriptions alone.

Before publication:

```text
1. map actual code and vendors;
2. map data categories;
3. map purposes;
4. map jurisdictions;
5. map retention;
6. map user rights;
7. map transfers;
8. map incident process;
9. map Agent/Dispute disclosure;
10. have counsel review.
```

---

# 12. Product Principle

> **Encrypting private deal content is both a product feature and a data-minimisation control, but compliance must describe the remaining data truthfully.**
