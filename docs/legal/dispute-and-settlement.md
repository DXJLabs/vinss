# VINSS Dispute & Settlement Legal Notes

**Status:** Product-law issue spotting  
**Last reviewed:** 2026-08-30  
**Not legal advice.**

---

# 1. Why Dispute Design Needs Legal Review

A resolver can affect who receives economic value.

That can create legal questions beyond ordinary software functionality.

VINSS should document the exact difference between:

```text
smart-contract state transition;
commercial dispute resolution;
legal arbitration;
court judgment.
```

Do not describe a technical resolver as legal arbitration unless counsel confirms that structure.

---

# 2. Current Desired Safety Boundaries

The dispute architecture should preserve:

```text
resolver cannot receive principal;
resolver cannot redirect principal to arbitrary third party;
resolution total equals custody principal;
each party claims only its authorized share;
state prevents duplicate settlement.
```

These are useful security and governance constraints.

---

# 3. Resolver Governance Questions

Counsel should receive:

```text
Who is resolver?

DXJ Labs?
independent company?
DAO?
human panel?
Agent + human?
contract verifier?

Who appoints and removes resolver?

Can resolver be upgraded?

Can resolver be bribed or conflicted?

What rules bind resolver?

What evidence can resolver see?

What records are retained?
```

---

# 4. Agent Is Not Judge

The Agent may:

```text
assemble chronology;
compare Offer terms;
summarize evidence;
detect inconsistencies;
recommend outcome.
```

The Agent should not be described as:

```text
court;
judge;
arbitrator;
legally binding authority
```

unless that status has been intentionally created and reviewed.

---

# 5. Evidence Disclosure

Private evidence should be disclosed selectively.

Recommended model:

```text
private Deal Room
        ↓
dispute starts
        ↓
party explicitly selects evidence
        ↓
evidence package / commitment
        ↓
authorized resolver access
        ↓
decision
        ↓
minimal public settlement result.
```

Do not make all room history public merely because a dispute exists.

---

# 6. Objective Verification

Objective verifier paths can reduce subjective dispute.

Example:

```text
agreed NFT contract
+
token id
+
recipient
+
on-chain owner
```

If objective verification was agreed in advance, the product may be able to execute a deterministic rule.

Counsel should still review:

```text
Terms enforceability;
oracle/verifier failure;
incorrect external data;
contract upgrade risk.
```

---

# 7. Off-Chain Evidence

Physical goods, fiat settlement and custom deals may require:

```text
tracking;
receipts;
screenshots;
inspection;
human confirmation.
```

Do not describe such evidence as cryptographically proving the real-world fact unless it actually does.

---

# 8. Governing Law / Forum

Terms should specify appropriate:

```text
governing law;
forum;
consumer mandatory-right carve-outs;
process for disputes against DXJ Labs.
```

This is separate from:

```text
user-v-user Rekber dispute.
```

A user may dispute the counterparty and separately have a legal complaint against DXJ Labs.

---

# 9. Resolver Liability / Independence

Before externalizing resolver work, define:

```text
contract with resolver;
conflict policy;
confidentiality;
data protection;
security;
decision standard;
liability allocation;
record retention.
```

Do not assume an external resolver automatically removes DXJ Labs liability.

---

# 10. Jurisdiction Risk

A dispute service may be characterised differently across jurisdictions.

Possible issues include:

```text
escrow;
payment service;
crypto service;
alternative dispute resolution;
consumer complaint obligations;
professional-service rules.
```

Obtain counsel before representing the mechanism as formal arbitration or regulated escrow.

---

# 11. Product Language

Preferred product wording:

```text
Dispute
Resolver
Resolution
Evidence
Settlement split
```

Use legal-specific terms only after legal design exists.

---

# 12. Required Counsel Memo

Ask counsel:

```text
1. Does VINSS's resolver role create regulated intermediary status?
2. Does it constitute an escrow service?
3. Does it create fiduciary duties?
4. Can Terms validly bind users to the resolution mechanism?
5. Are consumer users subject to mandatory ADR/consumer rules?
6. What evidence/privacy rules apply?
7. What liability does DXJ assume by operating resolver?
8. Should resolver be independent?
9. What jurisdiction/governing-law wording is appropriate?
10. Which claims must VINSS avoid?
```
