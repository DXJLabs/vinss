# VINSS Custody, Control & Money-Transmission Analysis

**Status:** Product-law issue spotting  
**Last reviewed:** 2026-08-30  
**Not legal advice.**

---

# 1. Why This Is the Highest-Priority Legal Question

VINSS Rekber protects economic value.

The legal perimeter may depend less on the product label `Rekber` and more on:

```text
who receives value;
who controls value;
who can redirect value;
who executes transfers on behalf of users;
who determines settlement;
who receives the fee.
```

---

# 2. Current Technical Questions to Freeze Before Counsel Review

Counsel should receive exact answers to:

```text
Does DXJ Labs ever possess a user's private key?

Does DXJ Labs receive custody principal into a company wallet?

Is principal held only by an autonomous smart contract?

Who can upgrade that contract?

Who can pause it?

Who can change resolver?

Who can authorize release?

Who can authorize refund?

Who can authorize a partial split?

Can the resolver redirect value to itself?

Can the resolver redirect value to an unrelated third party?

Can DXJ Labs seize assets?

Can DXJ Labs freeze a user?

Can DXJ Labs change FeePolicy?

Who receives the Rekber fee?

Does the frontend submit transactions only after user wallet approval?
```

These facts matter more than marketing terms.

---

# 3. Technical Self-Custody Is Helpful, Not Conclusive

A design where:

```text
user holds keys
+
user signs transaction
+
principal sits in smart contract
```

can reduce operator custody.

It does not automatically prove:

```text
no regulated service exists.
```

The surrounding service may still involve transfer, settlement, intermediation, arranging, or other regulated activity depending on jurisdiction.

---

# 4. Resolver Authority

Current VINSS architecture contemplates a dispute resolver that can authorize an exact payer/payee split.

That is materially different from a resolver that can:

```text
take funds;
send funds to arbitrary addresses;
become beneficiary.
```

The following invariant is legally and technically useful:

```text
payer_amount + payee_amount = custody_principal
```

and:

```text
resolver cannot receive principal.
```

However, counsel should still analyse whether the ability to determine the split makes DXJ Labs or the resolver an intermediary under local law.

---

# 5. United States — FinCEN Issue

FinCEN has long focused on whether a person engages in accepting and transmitting convertible virtual currency/value.

The 2013 guidance states that a user is not an MSB merely for using virtual currency, while administrators/exchangers can be money transmitters unless an exemption or limitation applies.

The 2019 guidance applies the framework to additional business models.

Official sources:

- https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering
- https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

### VINSS questions

```text
Does DXJ accept value from one person?

Does DXJ transmit it to another?

Does the smart contract do so independently of DXJ?

Does DXJ control the smart contract?

Is DXJ providing the transfer as a business?

Is DXJ merely providing software used by users?

Does resolver authority change the answer?
```

A U.S. answer also requires state-level analysis.

---

# 6. European Union — MiCA Issue

MiCA defines multiple crypto-asset services.

Relevant categories include:

```text
custody and administration;
transfer services for crypto-assets on behalf of clients;
execution of orders;
reception and transmission of orders.
```

MiCA defines custody and administration around safekeeping or controlling crypto-assets or means of access on behalf of clients.

Official source:

https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng

### VINSS questions

```text
Does the Rekber contract create "control" by DXJ?

Is DXJ providing transfer service on behalf of clients?

Does DXJ merely provide a protocol/frontend used by clients?

Who is the legal service provider?

Does use of stablecoins create payment-service overlap?
```

---

# 7. United Kingdom

Current UK crypto regulation includes MLR registration for certain cryptoasset services carried on by way of business in the UK.

The FCA's new broader crypto regime is scheduled to start on 25 October 2027.

Sources:

- https://www.fca.org.uk/firms/cryptoassets/who-needs-register
- https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/what-you-need-to-do

VINSS should receive a UK-specific classification before actively carrying on an in-scope business there.

---

# 8. Singapore

The Payment Services Act regulates specified payment services, including digital-payment-token services.

VINSS should obtain Singapore-specific analysis if it actively targets Singapore or operates from there.

Relevant MAS materials:

https://www.mas.gov.sg/-/media/mas-media-library/regulation/notices/trpd/psn05/psn05-technology-risk-management-notice---6-feb-2024.pdf

---

# 9. Fee Does Not Decide Classification Alone

VINSS currently plans product fees, including a percentage Rekber fee.

The existence of a fee can strengthen the fact that:

```text
DXJ Labs operates a business.
```

But:

```text
2% fee
```

by itself does not decide whether the activity is custody, transmission, brokerage, escrow, or another regulated service.

Analyse the complete service.

---

# 10. Paymaster / Sponsored Transactions

Separate:

```text
gas sponsorship
```

from:

```text
custody of settlement principal.
```

A paymaster paying transaction execution costs does not necessarily mean it takes custody of principal.

However, record:

```text
who pays gas;
who chooses sponsored actions;
whether sponsorship can block users;
whether sponsorship is bundled into user fees.
```

---

# 11. Design Controls That Reduce Legal Surface

Without making legal conclusions, architecture can intentionally reduce unnecessary control:

```text
users retain private keys;
no DXJ omnibus custody wallet;
no arbitrary resolver beneficiary;
no hidden admin seizure;
bounded resolver authority;
transparent upgrade/admin policy;
user-authorized actions;
minimal privileged roles;
publicly documented custody invariants.
```

These controls also improve security.

---

# 12. Counsel Deliverable

For each launch jurisdiction, ask counsel to state:

```text
1. Is DXJ Labs a regulated custodian?
2. Is DXJ Labs a money/crypto transmitter?
3. Is DXJ Labs a VASP/CASP or equivalent?
4. Is registration/licensing required?
5. Does resolver authority change classification?
6. Does FeePolicy/revenue change classification?
7. Are particular assets restricted?
8. Are geographic restrictions recommended?
9. What terms/disclosures are required?
10. Which product changes reduce licensing risk?
```

Record the answer in `jurisdiction-matrix.md`.
