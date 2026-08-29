# VINSS Business Documentation

> **Private deals. Clear agreements. Protected settlement. Sustainable economics.**

This directory defines the business strategy around VINSS.

The purpose is to keep product economics, market assumptions, positioning, competition, go-to-market, and execution priorities separate from technical implementation details.

VINSS should not treat:

```text
working code
=
validated business
```

and should not treat:

```text
large adjacent market
=
VINSS market
```

The business strategy is built around a simpler question:

> **Can VINSS repeatedly help real users complete real direct deals, charge enough to operate sustainably, and become the workflow they choose again for the next deal?**

---

## Business Documentation

Read the business documentation in this order.

### 1. [`business-model.md`](business-model.md)

Defines:

```text
who pays;
what users pay for;
pricing;
dynamic fee floors;
Rekber economics;
variable transaction costs;
contribution margin;
infrastructure costs;
refund economics;
dispute economics;
loyalty boundaries;
future token economics.
```

Core principle:

> **VINSS should be able to sustain its product economics without depending permanently on grants, subsidies, or token appreciation.**

---

### 2. [`positioning.md`](positioning.md)

Defines the category VINSS wants to occupy.

VINSS is positioned as:

```text
PRIVATE DEAL ROOM
```

not merely:

```text
private messenger;
escrow app;
wallet;
marketplace.
```

The strategic distinction is:

> **Messaging is the substrate. The product is the deal lifecycle.**

The intended lifecycle is:

```text
Private Conversation
        ↓
Structured Offer
        ↓
Accepted Agreement
        ↓
Rekber
        ↓
Fulfillment
        ↓
Verification
        ↓
Settlement
        ↓
Evidence
```

---

### 3. [`market.md`](market.md)

Defines the market VINSS is actually attempting to serve.

The market is not:

```text
all crypto users;
all stablecoin volume;
all freelancers;
all P2P commerce.
```

The relevant transaction pattern is narrower:

```text
bilateral deal
+
negotiation
+
meaningful value at risk
+
incomplete trust
+
settlement conditions
+
verification need
+
privacy relevance
```

The document separates:

```text
market context;
serviceable market;
beachhead hypothesis;
bottom-up revenue scenarios.
```

VINSS should use real user behavior to build a formal TAM / SAM / SOM later.

---

### 4. [`competitive-landscape.md`](competitive-landscape.md)

Defines the alternatives VINSS competes against.

Competition includes:

```text
private escrow applications;
OTC protocols;
general on-chain escrow;
invoice / payment products;
marketplaces;
human middlemen;
direct wallet transfers;
messaging + wallet DIY workflows.
```

The most important strategic rule is:

> **VINSS must differentiate above shared privacy and escrow primitives.**

The intended differentiation is continuity across:

```text
negotiation
→ agreement
→ Rekber
→ Fulfillment
→ verification
→ evidence
```

---

### 5. [`go-to-market.md`](go-to-market.md)

Defines how VINSS should acquire early users and discover a beachhead.

The initial GTM unit is:

```text
successful real deal
```

not:

```text
wallet connection;
page view;
Points issued;
community follower.
```

The recommended early motion is:

```text
find real direct deal
        ↓
bring both parties into VINSS
        ↓
complete protected settlement
        ↓
measure willingness to pay
        ↓
observe repeat usage
        ↓
observe referral
        ↓
identify beachhead
```

Founder-led customer discovery comes before scaled acquisition.

---

### 6. [`roadmap.md`](roadmap.md)

Defines execution order.

The roadmap is evidence-driven rather than feature-driven.

Recommended sequence:

```text
1. Establish current production truth
        ↓
2. Harden the mainnet lifecycle
        ↓
3. Measure real transaction economics
        ↓
4. Finalize universal settlement semantics
        ↓
5. Run real customer deals
        ↓
6. Validate pricing and business economics
        ↓
7. Identify beachhead
        ↓
8. Build repeatable GTM
        ↓
9. Productionize loyalty / reputation
        ↓
10. Expand through partners
        ↓
11. Decide whether VINSS token is justified
        ↓
12. Expand Deal Types and markets based on evidence
```

---

# Business Model Summary

VINSS uses a transaction-oriented business model.

Current public planning baseline:

| Action | Public pricing baseline |
| --- | ---: |
| Private Room activation | $0.25 / room |
| Message | $0.15 |
| Fulfillment | $0.15 |
| Review / Approve | $0.15 |
| Offer / Counter / Accept | $0.25 |
| Rekber | max($0.75, 2% of deal value) |
| Release | Included |
| Claim payment | Included |
| Settlement Soulbound Certificate | Free from VINSS; claimant pays gas |

The production pricing model must also account for changing:

```text
STRK price;
privacy cost;
paymaster / sponsor cost;
Starknet execution cost.
```

Therefore the intended pricing rule is conceptually:

```text
effective charge
=
max(
    public baseline,
    dynamic cost floor
)
```

Static USD pricing alone is not sufficient.

---

# Revenue Model

Core transaction revenue can come from:

```text
Private Room activation;
Messages;
Offer lifecycle actions;
Fulfillment;
Review;
Rekber.
```

The simplified economic model is:

```text
Product usage
        ↓
Gross revenue
        ↓
Variable transaction cost
        ↓
Contribution margin
        ↓
Infrastructure / operations
        ↓
Business overhead
        ↓
Business result
```

Contribution margin must not be confused with net profit.

---

# Rekber Economics

Rekber uses:

```text
max(
    minimum fee,
    percentage of protected deal value
)
```

Planning baseline:

```text
minimum = $0.75
percentage = 2%
```

Rekber economics must cover the supported settlement lifecycle, including actions that can be presented to the user as:

```text
Release → included
Claim   → included
```

Included does not mean zero cost to VINSS.

---

# Market Thesis

VINSS does not need to win:

```text
all messaging;
all escrow;
all freelancing;
all crypto;
all payments.
```

The market thesis is narrower:

> **VINSS is relevant when two parties need to negotiate a direct deal, do not fully trust each other, have meaningful value at risk, care about privacy, and need clear rules for fulfillment and settlement.**

Candidate segments include:

```text
crypto-native freelancers;
digital-goods sellers;
selected bounty relationships;
crypto-native teams / vendors;
private NFT / asset deals;
OTC participants;
wallet / marketplace partners.
```

These remain candidate segments until real usage establishes a beachhead.

---

# Current vs Target Design

Business documentation must remain consistent with product and technical documentation.

Some capabilities exist in current source.

Some are stronger Target Design rules.

Do not collapse these into one claim.

### Current source direction includes

```text
Private Deal Room;
Messages;
Offers;
Accepted Agreement;
Rekber;
Fulfillment;
Review / Revision;
Refund;
Dispute / Resolution;
Settlement;
Settlement Certificate;
FeePolicy.
```

### Target settlement design continues to refine

```text
agreement-derived Funder / Fulfiller / Beneficiary;
universal role semantics across Deal Types;
Verification Policy behavior;
two-sided post-Fulfillment protection;
objective deterministic settlement;
final dispute UX / evidence architecture.
```

External claims must reflect the actual evidence level.

---

# Loyalty

VINSS loyalty is separate from business revenue.

Three layers:

```text
Points
Referral
Settlement SBT Multiplier
```

Core rule:

```text
Points
≠ revenue
≠ cash
≠ VINSS token
```

---

# Future VINSS Token

VINSS token is a future economic layer.

It is not required for the current business model.

Future token work should follow real product usage, stable loyalty accounting, anti-farming, utility, legal review, and sustainable product economics.

Points should not convert in real time.

Never promise:

```text
1 Point = fixed VINSS
```

before a real conversion mechanism exists.

---

# Relationship to Product Documentation

Product strategy lives in:

```text
docs/product/
```

Product documentation explains:

```text
what VINSS is;
why it exists;
how the product should behave;
who may use it;
what remains hypothetical.
```

---

# Relationship to Technical Documentation

Technical truth lives in:

```text
docs/technical/
```

Technical documentation explains:

```text
contracts;
frontend;
backend;
privacy boundaries;
FeePolicy;
Rekber;
testing;
deployment evidence.
```

Business documentation must never override source or technical evidence.

The hierarchy is:

```text
source / chain evidence
        ↓
technical documentation
        ↓
product / business claims
```

If business strategy and implementation diverge, document the difference explicitly.

---

# Business Documentation Principles

1. **Product revenue must be separated from token financing.**
2. **Points must be separated from revenue.**
3. **Market context must be separated from TAM.**
4. **Current capability must be separated from Target Design.**
5. **Technical evidence must be separated from customer evidence.**
6. **Customer evidence must be separated from business validation.**
7. **Contribution margin must not be called net profit.**
8. **Grants and subsidies must not be treated as permanent unit economics.**
9. **The beachhead must be discovered through behavior.**
10. **Token incentives must not hide weak product retention.**
11. **Privacy primitives are infrastructure, not a durable moat by themselves.**
12. **Rekber pricing must account for the whole settlement lifecycle.**
13. **Real production cost should replace assumptions over time.**
14. **Real paid behavior should replace hypothetical willingness to pay.**
15. **Roadmap priority should follow risk and evidence, not feature count.**

---

# Business Thesis

The strongest business version of VINSS is not:

```text
a token project;
an escrow primitive;
an encrypted messenger;
a collection of Web3 features.
```

It is:

> **A private Deal Room that real users repeatedly choose for direct transactions because it gives them clearer agreement, better settlement protection, appropriate privacy, and useful evidence — while generating enough transaction revenue to operate sustainably.**

Everything in this directory should help prove or disprove that thesis.
