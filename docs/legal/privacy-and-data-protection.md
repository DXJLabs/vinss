# VINSS Privacy & Data-Protection Legal Notes

> **Purpose:** identify the personal-data, confidentiality, vendor, retention, security, and cross-border data-transfer obligations created by the actual VINSS architecture.

**Status:** Global privacy issue spotting
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** This document is not legal advice and does not conclude that any particular privacy law applies or does not apply to VINSS in a specific jurisdiction. Applicability depends on the operating entity, users targeted, data processed, vendors, establishment, and actual processing activities.

---

# 1. Privacy Architecture Does Not Mean No Personal Data

VINSS is designed to reduce unnecessary public exposure of private deal content.

That is a meaningful privacy property.

It does not mean:

```text
VINSS processes no personal data;
DXJ Labs sees nothing;
all users are anonymous;
wallet addresses are never personal data;
encrypted data is outside privacy law;
public blockchain data is outside privacy law;
Agent requests stay local;
Dispute evidence has no privacy risk.
```

The correct question is:

```text
What data is processed?

By whom?

For what purpose?

Where?

For how long?

With which recipients?

Under which legal basis or permission?

What can the user reasonably expect?
```

---

# 2. Current VINSS Data-Surface Map

The privacy review should map every technical layer separately.

```text
User device
   │
   ├── wallet
   ├── local application state
   ├── room secret / encryption material
   └── decrypted private content
        │
        ▼
VINSS Frontend
        │
        ├── public blockchain interaction
        ├── Privacy Pool / wallet provider
        ├── backend / indexer
        ├── Agent request
        ├── Dispute evidence workflow
        ├── feedback / support
        └── analytics / security tooling, if enabled
```

Each arrow may create a separate processing relationship.

Do not use one generic statement such as:

```text
everything is encrypted
```

to describe all layers.

---

# 3. Data Categories to Inventory

The data inventory should include all categories actually processed by production systems.

Potential categories include:

```text
wallet address;
account identifier;
room identifier;
room participation metadata;
transaction hash;
block number;
contract address;
public settlement state;
public token / amount / deadline state;
ciphertext;
ciphertext routing metadata;
payload commitments;
IP address;
device/browser information;
request logs;
timestamps;
support messages;
feedback;
email;
Telegram or social contact;
Agent prompts;
Agent responses;
Dispute evidence;
resolver records;
certificate identifiers;
security logs;
analytics identifiers;
fraud / abuse signals;
sanctions or wallet-screening results, if implemented.
```

Not every listed category is necessarily processed today.

The production data inventory must be verified against:

```text
frontend source;
backend source;
deployment configuration;
database schema;
logs;
vendors;
analytics;
support systems;
wallet/provider integrations;
Agent providers;
security tooling.
```

---

# 4. Data Inventory Table

Maintain a current record at least this detailed:

| Data category | Source | System / location | Purpose | Form | Recipient | Retention | User-facing disclosure |
|---|---|---|---|---|---|---|---|
| Wallet address | Wallet / chain | Frontend, chain, possibly backend | Transaction / settlement | Public identifier | Chain, VINSS systems | TBD | Required |
| Message ciphertext | Chain / indexer | Public chain + indexer | Private-message discovery | Encrypted | Public chain, backend | TBD | Required |
| Offer ciphertext | Chain / indexer | Public chain + indexer | Offer discovery | Encrypted | Public chain, backend | TBD | Required |
| Rekber coordination ciphertext | Chain / indexer | Public chain + indexer | Private settlement coordination | Encrypted | Public chain, backend | TBD | Required |
| Rekber public state | Chain | Public blockchain | Settlement execution | Public | Anyone | Blockchain-dependent | Required |
| IP / request metadata | Network/backend | Infrastructure logs | Security / operation | Plaintext metadata | Operator / infrastructure | TBD | Required if collected |
| Agent prompt | User | Backend / model provider | Requested AI assistance | Potential plaintext | DXJ / provider | TBD | Explicit disclosure |
| Dispute evidence | User | Dispute workflow | Resolution | Potentially sensitive plaintext | Authorized resolver / provider | Case policy | Explicit disclosure |
| Feedback/support | User | Support/feedback system | Support | Plaintext | DXJ / vendor | TBD | Required |
| Analytics identifier | Device | Analytics vendor | Product analytics | Identifier | DXJ / vendor | TBD | Required if enabled |

Replace `TBD` before a production Privacy Notice is finalized.

---

# 5. Privacy Boundaries by Product Feature

## 5.1 Private Message

The intended privacy model is:

```text
plaintext Message
        ↓
client-side encryption
        ↓
ciphertext committed / discoverable
        ↓
recipient-side decryption
```

The backend should not be described as decrypting Message content unless production behavior actually does so.

However, the system may still process:

```text
ciphertext;
routing information;
commitments;
timestamps;
transaction references;
network metadata.
```

---

## 5.2 Offer

Structured Offer semantics may be encrypted in the private coordination layer while other transaction facts remain public.

Document separately:

```text
private Offer content;
public transaction metadata;
public contract address;
public timestamp/block;
public settlement facts created later.
```

Do not imply that every fact associated with an Offer is private.

---

## 5.3 Rekber

`VinssEscrowRekber` is not a ciphertext-only system.

Public contract state can include legally or commercially meaningful facts such as:

```text
token;
principal;
fee;
deadlines;
policy/state;
commitments;
evidence commitments;
dispute state;
resolution amounts;
settlement state.
```

The Privacy Notice and product UI should not claim:

```text
the entire Rekber is private
```

if those facts are public on-chain.

Preferred wording should distinguish:

```text
private commercial coordination
```

from:

```text
public settlement state required for contract execution.
```

---

## 5.4 Settlement Certificate

A Settlement Certificate may create a persistent public link to qualifying settlement state.

Review:

```text
token/certificate identifier;
recipient wallet;
settlement reference;
issuance time;
public metadata;
image/metadata endpoint;
indexer records.
```

Do not include unnecessary plaintext personal or commercial information in certificate metadata.

---

# 6. Public Blockchain Data

Blockchain records may be:

```text
public;
globally observable;
persistent;
difficult or impossible to erase from the underlying network.
```

That does not automatically mean the records are legally irrelevant to data-protection analysis.

If a public identifier can be linked to an individual, transaction, account, or other identifying information, applicable law may treat the information as personal data or personal information depending on context.

Therefore:

```text
avoid plaintext names;
avoid plaintext contact details;
avoid private business terms;
avoid unnecessary evidence;
avoid unnecessary user identifiers;
prefer commitments / hashes / minimal state.
```

before data reaches an immutable public network.

---

# 7. Encrypted Data Still Requires Analysis

Encryption is a security and data-minimisation control.

It does not automatically mean encrypted data is outside privacy law.

Analyse:

```text
who possesses decryption capability;
whether the operator can re-identify a user;
whether routing metadata remains identifying;
whether encryption keys are user-controlled;
whether data can be linked with public chain data;
whether the backend or vendor ever receives plaintext.
```

The legal characterization of encrypted or pseudonymized data is jurisdiction-specific.

Do not equate:

```text
encrypted
```

with:

```text
anonymous.
```

---

# 8. Room Secrets & Encryption Material

Document where privacy-sensitive cryptographic material exists.

Questions:

```text
Where is roomSecret created?

Where is it stored?

Is it transmitted to VINSS infrastructure?

Can backend services recover it?

Is it contained in Invite material?

Can browser storage expose it?

Can backup/restore expose it?

What happens when a device is lost?

Can users rotate or revoke room access?
```

Security documentation and privacy documentation should remain consistent.

A backend that cannot decrypt private content should not accidentally acquire the keys through logging, support tooling, telemetry, or Agent workflows.

---

# 9. Agent Privacy Boundary

Agent processing must be documented separately from ordinary encrypted room operation.

A user may reasonably understand:

```text
private room content is encrypted
```

and incorrectly infer:

```text
an AI request never sends plaintext outside the device.
```

If Agent operation requires plaintext or user-selected context to be sent to a backend or external model provider, disclose that before or at invocation.

Minimum Agent disclosure should make clear:

```text
what context is sent;
whether the user chooses the context;
which provider receives it;
why it is processed;
whether it is retained;
whether it is used for provider training, if known;
whether subprocessors are involved;
where processing may occur;
how the user can avoid invoking the Agent.
```

---

# 10. Normal Agent vs Dispute Agent

Treat these as distinct processing contexts.

## Normal Agent

Preferred privacy model:

```text
user intentionally invokes;
minimum necessary context;
no automatic full-room disclosure;
clear external-provider boundary;
user can continue without Agent.
```

## Dispute Agent

Potential data sensitivity is higher.

The workflow may include:

```text
Offer terms;
chat excerpts;
Fulfillment evidence;
receipts;
shipping information;
screenshots;
identity information;
payment evidence;
documents;
counterparty allegations.
```

Preferred model:

```text
explicit Dispute action
        ↓
user selects relevant evidence
        ↓
minimum necessary evidence package
        ↓
authorized processing / resolver access
        ↓
decision / recommendation
        ↓
limited retention
```

A dispute should not automatically disclose the entire room history.

---

# 11. Dispute Evidence Governance

Create a case-level evidence policy covering:

```text
case identifier;
who submitted evidence;
what evidence was submitted;
purpose;
authorized recipients;
access log;
provider involvement;
retention deadline;
deletion/archive rule;
legal-hold exception;
decision record;
public commitment/reference.
```

Sensitive evidence should not be placed on-chain in plaintext.

Where possible use:

```text
commitment;
hash;
minimal status;
authorized off-chain storage.
```

Do not describe a hash as guaranteed anonymization.

---

# 12. Resolver Access

If a resolver can see private evidence, document:

```text
resolver identity/entity;
whether resolver is DXJ Labs or third party;
access mechanism;
confidentiality terms;
access logging;
security obligations;
data-protection role;
subprocessors;
retention;
incident obligations;
cross-border transfer.
```

Changing resolver provider should trigger privacy review.

---

# 13. LLM / AI Provider Register

Maintain a current provider register.

For every model provider record:

| Field | Required information |
|---|---|
| Provider | Legal/entity name |
| Service | API/model used |
| Data sent | Exact categories |
| Purpose | Agent / Dispute / other |
| Processing role | Controller / processor / other analysis |
| Retention | Current contract/provider terms |
| Training use | Current provider terms |
| Storage region | If known / contracted |
| Subprocessors | Current list/source |
| Transfer mechanism | Where applicable |
| Security terms | Contract / published standard |
| Deletion capability | Yes / No / conditions |
| Last reviewed | Date |

Do not rely indefinitely on a vendor's old privacy or training policy.

Provider terms change.

---

# 14. Backend / Indexer Privacy Boundary

A ciphertext-only or metadata-focused backend can materially reduce privacy risk.

The backend should document whether it stores or processes:

```text
ciphertext;
action locators;
payload commitments;
transaction hashes;
block numbers;
wallet identifiers;
public Rekber state;
certificate state;
IP addresses;
request logs;
headers;
rate-limit identifiers;
feedback;
Agent requests.
```

If production infrastructure logs information automatically, that is part of the real data inventory even if application code does not explicitly persist it.

Review:

```text
hosting logs;
reverse proxy logs;
Railway/platform logs;
database logs;
error reporting;
APM;
analytics;
CDN logs;
WAF/security logs.
```

---

# 15. Data Minimisation

The default rule should be:

```text
Do not collect data merely because it may be useful later.
```

For each category ask:

```text
Is it necessary?

Can the purpose be achieved with less data?

Can plaintext be avoided?

Can a commitment be used?

Can it stay client-side?

Can retention be shorter?

Can access be narrower?
```

VINSS's privacy product thesis should be reflected in operational data handling.

---

# 16. Retention

No production Privacy Notice should use vague language such as:

```text
we retain data as long as necessary
```

without an internal retention schedule explaining what that means.

Create categories such as:

| Category | Proposed retention driver |
|---|---|
| Public blockchain data | Network persistence; operator cannot erase underlying chain |
| Ciphertext index data | Operational necessity / reindex capability |
| Server request logs | Security and troubleshooting |
| Agent request records | Minimum necessary or disabled if not needed |
| Dispute case evidence | Case lifecycle + legal/contract requirement |
| Support tickets | Support lifecycle |
| Security incidents | Incident/legal requirement |
| Sanctions/compliance records | Applicable legal requirement if in scope |
| Analytics | Product need / user preference / consent where required |

Do not set final periods without verifying actual infrastructure and legal requirements.

---

# 17. Deletion & Blockchain Immutability

The product must distinguish:

```text
data controlled by DXJ Labs
```

from:

```text
data already recorded on a public blockchain.
```

A user request may permit deletion of:

```text
support records;
off-chain profile information;
analytics identifiers;
backend records;
Agent records;
Dispute evidence;
other operator-controlled records
```

subject to applicable retention duties.

It may not be technically possible for DXJ Labs to erase historical blockchain data.

User-facing privacy disclosures should state this accurately.

Do not promise:

```text
we can delete all information about you
```

if public chain history persists.

---

# 18. EU GDPR

The EU General Data Protection Regulation is Regulation (EU) 2016/679.

Official text:

https://eur-lex.europa.eu/eli/reg/2016/679/oj

Important VINSS workstreams include:

```text
territorial scope;
controller / processor / joint-controller roles;
lawful basis;
transparency;
purpose limitation;
data minimisation;
accuracy;
storage limitation;
security;
data-subject rights;
DPIA;
automated decision-making where relevant;
processor contracts;
international transfers;
breach response.
```

A non-EU operating entity can still fall within GDPR territorial scope depending on establishment, offering of goods/services, or relevant monitoring of individuals in the Union.

Do not assume:

```text
no EU company
        =
no GDPR.
```

Before targeted EU launch, determine which VINSS entity is controller for each processing purpose.

---

# 19. GDPR Controller / Processor Mapping

Do not classify every vendor automatically as a processor.

For each relationship determine:

```text
Who decides why the data is processed?

Who decides essential means?

Is the provider processing only documented instructions?

Does the provider use data for independent purposes?

Are there joint decisions?
```

Potential relationships to analyse:

```text
DXJ Labs ↔ hosting provider;
DXJ Labs ↔ database provider;
DXJ Labs ↔ analytics provider;
DXJ Labs ↔ LLM provider;
DXJ Labs ↔ resolver;
DXJ Labs ↔ wallet/provider;
DXJ Labs ↔ paymaster;
DXJ Labs ↔ support provider.
```

Roles may differ by processing purpose.

---

# 20. EU International Transfers

If personal data subject to GDPR is transferred outside the EEA, determine the applicable transfer mechanism.

Possible workstreams include:

```text
adequacy;
Standard Contractual Clauses;
transfer impact assessment;
supplementary measures;
processor/subprocessor flow-down;
derogations where legally appropriate.
```

Encryption can be an important supplementary safeguard but does not replace the legal transfer analysis.

Map the actual location/access pattern of every relevant vendor.

---

# 21. UK Data Protection

The UK data-protection framework includes the UK GDPR and Data Protection Act 2018, as amended by subsequent legislation including the Data (Use and Access) Act 2025.

The ICO currently notes that some controller/processor guidance is under review because of changes made by the Data (Use and Access) Act.

Current ICO controller/processor guidance:

https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/

Current ICO international-transfer guidance:

https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/

Therefore VINSS should not rely indefinitely on a pre-2025 UK privacy memo.

Before actively targeting UK users, review:

```text
territorial scope;
controller / processor roles;
transparency;
lawful processing;
rights;
security;
international transfers;
current DUAA-related changes;
vendor contracts.
```

---

# 22. Singapore PDPA

Singapore's Personal Data Protection Act provides a baseline standard of protection for personal data and regulates collection, use, disclosure, and care of personal data by organizations.

Official PDPC overview:

https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act

Relevant obligations to assess include:

```text
accountability;
notification;
consent where required;
purpose limitation;
accuracy;
protection;
retention limitation;
transfer limitation;
access/correction;
data-breach notification;
DPO/accountability requirements.
```

The exact obligation depends on the processing context and applicable exceptions.

A Singapore payment/crypto regulatory analysis does not replace the PDPA analysis.

---

# 23. United States

The United States does not have a single GDPR-equivalent federal privacy law covering all processing.

VINSS should separately analyse:

```text
FTC Act;
data-security obligations;
sector-specific federal laws where applicable;
state comprehensive privacy laws;
state breach-notification laws;
biometric/sensitive-data rules if ever relevant;
consumer-protection rules.
```

FTC business guidance emphasizes inventorying data, minimizing what is retained, protecting it, securely disposing of it, and planning for incidents.

Official FTC source:

https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business

State-law scope should be assessed against:

```text
business thresholds;
user location;
data categories;
sale/share definitions;
targeted advertising;
sensitive data;
consumer rights.
```

Do not use one generic "U.S. privacy compliant" statement.

---

# 24. Indonesia — Personal Data Protection

For Indonesia-directed operations, analyse the Indonesian personal-data protection framework, including Law No. 27 of 2022 on Personal Data Protection and applicable implementing rules/guidance.

VINSS-specific questions include:

```text
Who is the personal-data controller?

Which processors/vendors are used?

What legal basis applies?

What notices are required?

Which data is specific/sensitive personal data?

Where is data stored?

Are cross-border transfers involved?

What rights and response process are required?

What security and breach duties apply?
```

Do not assume that blockchain or wallet identifiers are automatically outside the framework.

The regulatory-source registry should maintain the current official Indonesian source and implementing-rule status.

---

# 25. Wallet & Blockchain Identifiers

Wallet addresses require context-specific analysis.

A wallet address may become linked with:

```text
exchange KYC;
ENS/name service;
social profile;
support request;
transaction history;
room relationship;
certificate;
IP/device metadata;
analytics identifier.
```

Therefore avoid absolute statements such as:

```text
wallet addresses are anonymous
```

or:

```text
wallet addresses are always personal data.
```

Use a jurisdiction- and context-specific analysis.

---

# 26. Analytics & Tracking

Before enabling analytics, advertising pixels, session replay, fingerprinting, or behavioral tracking, determine:

```text
exact vendor;
data collected;
cookie/local-storage behavior;
device identifiers;
IP treatment;
cross-site tracking;
purpose;
retention;
consent requirement;
opt-out requirement;
regional configuration.
```

Privacy-friendly product analytics should be preferred.

Do not introduce high-surveillance analytics into a privacy product without explicit review.

---

# 27. Cookies / Local Storage

VINSS may use browser storage for:

```text
room state;
encrypted local history;
wallet/session state;
preferences;
security;
analytics, if enabled.
```

Not every browser-storage operation is legally equivalent to an advertising cookie.

Inventory each storage key and classify:

```text
strictly necessary;
functional;
analytics;
advertising/tracking;
security.
```

Determine jurisdiction-specific consent and notice requirements.

---

# 28. Security Obligations

Privacy compliance requires security controls, not only disclosures.

Minimum areas to document:

```text
encryption in transit;
encryption at rest where applicable;
secret management;
least privilege;
MFA;
access logging;
database access;
vendor access;
backup security;
incident response;
dependency security;
key management;
production/test separation;
security patching;
data export controls.
```

For Dispute evidence and Agent context, access should be narrower than ordinary operational access wherever practical.

---

# 29. Incident Response

Maintain a written incident process covering:

```text
detection;
containment;
preservation of evidence;
scope;
affected data;
affected users;
vendor involvement;
legal assessment;
regulator notification;
user notification;
remediation;
post-incident review.
```

Notification deadlines differ by jurisdiction.

Do not invent a universal notification deadline in product documentation.

---

# 30. Data-Subject / Consumer Rights Operations

Where applicable, VINSS should be able to handle requests concerning:

```text
access;
correction;
deletion;
restriction;
objection;
portability;
withdrawal of consent;
opt-out;
appeal.
```

The response process should distinguish:

```text
operator-controlled data
```

from:

```text
immutable public-chain records.
```

Identity verification for rights requests should be proportionate and should not collect excessive new personal data.

---

# 31. Privacy Notice Gate

Do not finalize a production Privacy Notice solely from product descriptions.

Before publication verify:

```text
[ ] operating entity
[ ] contact method
[ ] real data inventory
[ ] production database schema
[ ] infrastructure logs
[ ] hosting provider
[ ] wallet/provider integrations
[ ] Privacy Pool integration
[ ] paymaster provider
[ ] analytics
[ ] support/feedback tools
[ ] Agent providers
[ ] Dispute Agent flow
[ ] resolver
[ ] evidence storage
[ ] subprocessors
[ ] retention schedule
[ ] international transfers
[ ] user-rights process
[ ] incident process
[ ] targeted jurisdictions
```

The Privacy Notice must describe production reality, not planned architecture.

---

# 32. Privacy Claims VINSS Should Avoid

Unless verified against current production behavior, do not state:

```text
VINSS stores no personal data;

VINSS sees nothing;

everything is anonymous;

everything stays on your device;

all data is end-to-end encrypted;

all Rekber information is private;

the backend stores only anonymous information;

public blockchain data is not personal data;

Agent data is never retained;

Agent data is never used by providers;

Dispute evidence is fully private forever;

we can delete every record;

privacy technology eliminates legal obligations.
```

Preferred claims should be narrow and factual.

Examples:

```text
private Message/Offer coordination is encrypted client-side;

the backend is designed not to decrypt supported private coordination payloads;

settlement contracts expose the public state required for on-chain execution;

Agent and Dispute workflows have separate disclosure boundaries;

public blockchain records may remain permanently observable.
```

Only publish a preferred claim after verifying it against current source and production configuration.

---

# 33. Change-Control Rule

Re-open the privacy analysis whenever any of the following changes:

```text
backend storage;
database schema;
logging;
hosting provider;
analytics;
cookies/tracking;
wallet provider;
Privacy Pool;
paymaster;
Agent provider;
Agent context;
Dispute Agent;
resolver;
Dispute evidence storage;
support provider;
email provider;
data-retention period;
new public on-chain field;
Settlement Certificate metadata;
new jurisdiction;
new local marketing;
new identity/KYC flow;
sanctions/wallet screening;
token launch.
```

Vendor-policy changes can also trigger review.

---

# 34. Core Privacy Principle

VINSS should treat privacy as an architectural constraint, not only a marketing feature.

Preferred design:

```text
keep private content client-side where possible;
encrypt before public transport/storage;
do not centralize decryption keys unnecessarily;
minimize metadata;
minimize logs;
minimize retention;
use selective Dispute disclosure;
send minimum Agent context;
keep public chain state minimal;
document every external recipient;
give users accurate expectations.
```

The core rule is:

> **Collect less, expose less, retain less, disclose selectively, and describe the remaining data flow exactly as it exists in production.**
