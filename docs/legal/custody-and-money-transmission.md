# VINSS Custody, Control & Money-Transmission Analysis

> **Purpose:** identify the custody, asset-control, transfer, and intermediary questions created by the current VINSS Rekber architecture before jurisdiction-specific legal conclusions are made.

**Status:** Product-law issue spotting
**Last reviewed:** 2026-08-30
**Owner:** DXJ Labs
**Product:** VINSS

> **Important:** This document is not legal advice and does not conclude that VINSS or DXJ Labs is, or is not, a custodian, escrow provider, money transmitter, VASP, CASP, payment service, or equivalent regulated provider in any jurisdiction.

---

# 1. Why This Is a Critical Legal Workstream

VINSS Rekber protects and settles economic value.

The relevant legal question is not simply:

```text
Who holds the user's private key?
```

The analysis must also ask:

```text
Who operates the service?

Who deploys and administers the settlement contracts?

Where does principal sit?

Who can affect settlement state?

Who can authorize a release, refund, or dispute split?

Who can replace privileged actors?

Who receives product fees?

Who constructs or sponsors transactions?

Who markets the settlement service?

Who is the service provider from the user's perspective?
```

A self-custody wallet can reduce one form of operator control while other forms of legally relevant control may remain.

---

# 2. Separate Four Different Concepts

VINSS documentation should keep the following concepts separate.

## 2.1 User Key Custody

```text
Who possesses or controls the user's private key?
```

Current intended VINSS model:

```text
user wallet
    ↓
user signs
    ↓
VINSS does not need the user's private key
```

This is an important technical and security property.

It does not, by itself, decide the legal classification of Rekber.

---

## 2.2 Settlement-Principal Custody

```text
Where does the asset principal sit while a Rekber is active?
```

Current technical model:

```text
Funder wallet
      ↓
VinssEscrowRekber
      ↓
settlement state
      ↓
authorized recipient claim
```

`VinssEscrowRekber` performs actual on-chain custody of supported settlement principal.

That fact must be stated accurately.

The next legal question is whether the operator of the surrounding service is legally treated as exercising custody or control over that principal.

---

## 2.3 Settlement Authority

```text
Who can cause or authorize an economic outcome?
```

Relevant VINSS paths include, depending on state:

```text
release;
refund;
dispute resolution;
objective verification;
claim.
```

Legal analysis must map each path to:

```text
actor;
authorization;
contract condition;
recipient;
operator discretion;
ability to override.
```

---

## 2.4 Service Operation

Even if users retain keys and principal is held by a smart contract, a separate question remains:

```text
Is DXJ Labs operating a settlement or transfer service as a business?
```

Facts can include:

```text
hosting the frontend;
operating backend infrastructure;
maintaining fee policy;
collecting fees;
choosing supported assets;
appointing resolver roles;
providing support;
sponsoring transactions;
marketing the service;
maintaining privileged contract roles.
```

---

# 3. Current Technical Baseline

Legal analysis should remain synchronized with the current source and deployed behavior.

The current smart-contract layer includes:

```text
VinssFeePolicy;
VinssInvite;
VinssMessageHelper;
VinssOfferHelper;
VinssPrivateEscrowHelper;
VinssEscrowRekber;
VinssSettlementCertificate.
```

For this legal workstream, the primary contract is:

```text
VinssEscrowRekber
```

Its documented responsibilities include:

```text
STRK / USDC custody;
funding;
Fulfillment state;
review;
revision;
refund;
dispute;
resolution;
settlement;
claim authorization.
```

Encrypted Message, Offer, and private Rekber coordination helpers do not themselves hold settlement principal.

Do not describe all VINSS contracts generically as either:

```text
custodial
```

or:

```text
non-custodial.
```

The custody function must be analysed contract by contract and service by service.

---

# 4. Current Rekber Fund Flow

The legal memo provided to counsel should contain a diagram equivalent to:

```text
Funder
  │
  │ user-authorized transaction
  ▼
VinssEscrowRekber
  │
  ├── service-fee handling
  │
  └── custody principal
          │
          ├── normal release path
          ├── refund path
          └── dispute-resolution allocation
                    │
                    ├── payer authorized share
                    └── payee authorized share
                              ↓
                       each party claims
```

For every supported asset record:

```text
token contract;
principal amount;
fee amount;
fee recipient;
when fee becomes non-refundable;
settlement recipient;
refund recipient;
claim mechanics;
rounding behavior;
failure behavior.
```

This fund-flow description should match deployed source exactly.

---

# 5. Resolver Authority Is Bounded but Legally Relevant

The current VINSS dispute architecture limits the resolver's economic authority.

The core invariant is:

```text
payer_amount + payee_amount = custody_principal
```

The resolver cannot authorize a distribution exceeding the custody principal.

The resolver also cannot use the dispute-resolution mechanism to redirect principal to itself.

The allowed economic result is a split between the two settlement parties.

Example:

```text
100% payer / 0% payee
50% payer / 50% payee
0% payer / 100% payee
or another exact split whose total equals principal
```

Each party subsequently claims its own authorized share.

These limits are legally relevant because they distinguish the current resolver from an actor with unconstrained withdrawal or arbitrary beneficiary power.

However:

```text
bounded authority
        ≠
no legally relevant authority.
```

Counsel should still determine whether the ability to decide the economic split creates:

```text
intermediary status;
escrow-provider status;
custody/control;
fiduciary or contractual duties;
dispute-resolution obligations;
payment/crypto-service obligations;
other local regulatory consequences.
```

---

# 6. Objective Verifier Authority

Where VINSS supports objective-verification paths, document:

```text
who appoints the verifier;
what fact it can confirm;
what state transition follows;
whether verification is deterministic;
whether the verifier can redirect funds;
whether it can be replaced;
whether it can act after dispute;
what happens if the verifier fails or is compromised.
```

Objective verification may reduce subjective discretion.

It does not automatically remove legal responsibility from the operator.

---

# 7. Admin, Upgrade, Pause & Role Control

A legal conclusion about smart-contract custody is unreliable unless privileged controls are documented.

Freeze the following facts before counsel review:

```text
Is VinssEscrowRekber upgradeable?

Can any actor pause settlement?

Can any actor block funding?

Can any actor block claims?

Can any actor change the resolver?

Can any actor change the objective verifier?

Can any actor change FeePolicy?

Can any actor change fee recipient?

Can any actor change supported tokens?

Can any actor rescue or seize principal?

Can any actor bypass normal settlement states?

Can any actor rotate privileged keys?
```

For each privileged role record:

| Field | Required fact |
|---|---|
| Role | Admin / resolver / verifier / fee-policy authority / other |
| Controller | Wallet, multisig, contract, or entity |
| Powers | Exact callable actions |
| Can move principal? | Yes / No / bounded |
| Can redirect principal? | Yes / No / bounded |
| Can freeze user outcome? | Yes / No |
| Replaceable? | Yes / No |
| Replacement authority | Exact actor |
| Production address | Deployment record |

Do not infer legal decentralization from the number of contracts or wallets.

---

# 8. User Authorization Matters but Is Not Conclusive

VINSS generally constructs an action that the user approves through the user's wallet.

That distinction matters.

Compare:

```text
operator moves assets without user authorization
```

with:

```text
user signs a transaction that executes predefined contract logic.
```

They are materially different technical facts.

But legal analysis can still ask whether the business:

```text
accepts and transmits value;
provides transfer services;
arranges settlement;
controls a custody mechanism;
acts on behalf of users;
operates an intermediary service.
```

User signature is one fact in the analysis, not the whole analysis.

---

# 9. FeePolicy & Revenue

VINSS uses a fee model around product actions and Rekber.

The current legal analysis should distinguish:

```text
settlement principal
        ≠
VINSS service fee
        ≠
network gas
        ≠
sponsor/paymaster cost.
```

For Rekber, document exactly:

```text
principal;
percentage/minimum fee;
dynamic or oracle-based floor;
lifecycle reserve;
fee recipient;
when the fee is collected;
whether the fee is refundable;
whether the fee can change between quote and execution.
```

A percentage fee can support the factual conclusion that the service is operated commercially.

It does not independently determine whether the activity is legally:

```text
custody;
escrow;
money transmission;
brokerage;
payment service;
crypto-asset service.
```

---

# 10. Paymaster / Sponsored Transactions

Separate:

```text
paying transaction execution costs
```

from:

```text
holding settlement principal.
```

A paymaster or sponsor may pay gas without taking custody of Rekber principal.

Legal and operational documentation should still record:

```text
who operates the sponsor relationship;
which actions are sponsored;
whether sponsorship is discretionary;
whether a user can transact without sponsorship;
whether sponsorship can effectively block access;
whether sponsorship cost is included in user pricing;
what transaction metadata is shared with the provider.
```

Sponsorship should not be described as custody unless the underlying fund flow supports that conclusion.

---

# 11. United States — FinCEN / BSA

FinCEN's 2019 guidance applies Bank Secrecy Act principles to certain business models involving convertible virtual currencies.

Official source:

https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models

The guidance emphasizes underlying activity and facts rather than business-model labels.

VINSS-specific questions include:

```text
Does DXJ Labs accept value from one person?

Does DXJ Labs transmit value to another person or location?

Does the Rekber contract perform that transfer independently?

Who controls the Rekber contract and privileged roles?

Does DXJ Labs determine or materially control settlement?

Does resolver authority change the analysis?

Is DXJ Labs merely providing software?

Is DXJ Labs operating the transfer/settlement service as a business?
```

Do not conclude from this document alone that DXJ Labs is or is not an MSB.

A U.S. analysis also requires state-law review.

---

# 12. United States — State Money Transmission

Federal FinCEN classification does not resolve all state requirements.

State law may regulate:

```text
money transmission;
virtual-currency activity;
custody;
stored value;
escrow;
related financial services.
```

The exact perimeter varies.

Therefore:

```text
federal clearance
        ≠
nationwide U.S. launch approval.
```

Before broad U.S. targeting, create a state strategy identifying:

```text
states actively targeted;
states requiring separate analysis;
states requiring licensing/registration;
states subject to restrictions;
product changes required.
```

---

# 13. European Union — MiCA

MiCA, Regulation (EU) 2023/1114, defines multiple crypto-asset services, including custody and administration of crypto-assets on behalf of clients and transfer services for crypto-assets on behalf of clients.

Official text:

https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng

For custody providers, MiCA contains specific requirements around agreements, records, custody policy, and safeguarding/control of client crypto-assets or means of access.

VINSS-specific questions:

```text
Does DXJ Labs safeguard or control crypto-assets on behalf of clients?

Does control of Rekber roles constitute legally relevant control?

Does VINSS provide a transfer service on behalf of clients?

Does the contract itself change who is considered the service provider?

Who concludes the service relationship with the user?

Who receives the Rekber fee?

Does the resolver act on behalf of VINSS or independently?

Does support for USDC or another stablecoin create additional issues?

Is another EU payment-services regime also relevant?
```

MiCA should be analysed together with the actual contract and operating model.

Do not equate:

```text
user retains wallet key
```

with:

```text
MiCA custody/transfer perimeter cannot apply.
```

---

# 14. United Kingdom

The UK currently applies existing Money Laundering Regulations to certain cryptoasset activities while transitioning toward a broader FSMA cryptoasset regime.

The FCA states that the new broader cryptoasset regime starts on **25 October 2027**.

Official current sources:

https://www.fca.org.uk/firms/cryptoassets/how-apply-registration

https://www.fca.org.uk/firms/new-regime-cryptoasset-regulation/registration-under-mlrs-ahead-new-fsma-regime

Before actively carrying on an in-scope UK business, determine:

```text
whether existing MLR registration applies;
whether Rekber falls inside a current regulated category;
whether the forthcoming FSMA regime will apply;
whether a transition/application route is required;
whether financial-promotion rules apply;
whether local consumer rules apply.
```

Do not assume that waiting for the 2027 regime removes present obligations.

---

# 15. Singapore

Singapore requires a service-specific analysis under the Payment Services Act and related MAS framework.

MAS currently lists institutions licensed for Digital Payment Token Service under the payment-services framework.

VINSS-specific questions include:

```text
Does the operating entity provide a regulated payment service?

Does it provide a Digital Payment Token service?

Does it arrange or effect transfers?

Does Rekber custody change the classification?

Where is the service provider established?

Does it actively solicit Singapore users?

Are cross-border payment or token activities involved?
```

Use current MAS materials for the final analysis.

Do not conclude that VINSS is in or out of scope merely because settlement occurs through a smart contract.

---

# 16. Indonesia

Indonesia requires a VINSS-specific perimeter analysis rather than assuming the product is covered or excluded by crypto trading rules.

Relevant current baseline identified elsewhere in this legal directory includes:

```text
POJK 27/2024;
POJK 23/2025.
```

Questions include:

```text
Is VINSS performing activity regulated as digital-financial-asset or crypto-asset business?

Does Rekber create a custody, payment, transfer, or intermediary issue outside the trading perimeter?

Which entity operates the service?

Who receives fees?

Is the service actively marketed to Indonesian users?

Do supported stablecoins or settlement assets create separate obligations?
```

Record the answer in `jurisdiction-matrix.md`.

---

# 17. Stablecoins and Supported Assets

Do not analyse Rekber only as an abstract token-transfer mechanism.

Classification may differ by supported asset.

For each asset record:

```text
asset name;
issuer;
asset category;
jurisdictional treatment;
redemption characteristics;
payment/stablecoin status;
sanctions controls;
transfer restrictions;
contract address;
network.
```

A service using:

```text
native network asset
```

may raise different questions from one using:

```text
fiat-referenced stablecoin;
tokenized security;
tokenized deposit;
other regulated asset.
```

Adding a new settlement asset should trigger legal re-review.

---

# 18. Privacy Does Not Resolve Custody Classification

VINSS privacy features reduce unnecessary disclosure of business context.

They do not decide:

```text
who controls assets;
who provides settlement;
whether value is accepted/transmitted;
whether an operator is regulated.
```

Do not use privacy language as a custody or money-transmission argument.

Likewise, do not collect unnecessary plaintext private data merely to make a financial-regulatory model easier to operate.

Legal controls should be proportionate to actual obligations.

---

# 19. Design Controls That Reduce Unnecessary Control

Without claiming a legal exemption, the architecture should continue to avoid unnecessary operator powers.

Preferred controls include:

```text
users retain private keys;

no DXJ omnibus wallet for Rekber principal;

no resolver ability to receive principal;

no arbitrary third-party dispute beneficiary;

exact principal-conservation invariant;

party-specific claims;

state-dependent settlement paths;

no hidden seizure path;

minimal privileged roles;

transparent role rotation;

transparent fee recipient;

documented upgrade/pause behavior;

user authorization where technically possible.
```

These improve both security and legal analysability.

---

# 20. Claims VINSS Should Avoid

Unless supported by a current jurisdiction-specific legal opinion, do not state:

```text
VINSS is legally non-custodial;

VINSS is not an escrow provider;

VINSS is not a money transmitter;

VINSS is not a VASP or CASP;

smart-contract custody is unregulated;

self-custody wallets make VINSS exempt;

DXJ never controls settlement;

the resolver has no legal significance;

VINSS can legally operate worldwide;

mainnet proves regulatory compliance.
```

Preferred language is factual:

```text
users retain their wallet keys;

settlement principal is held by VinssEscrowRekber;

resolver authority is contractually bounded on-chain;

resolver cannot receive settlement principal through resolution;

each party claims its authorized share;

legal classification remains jurisdiction-specific.
```

---

# 21. Counsel Product-Fact Pack

Before requesting a custody or money-transmission opinion, provide counsel with:

```text
[ ] current VinssEscrowRekber source
[ ] deployed address and verified bytecode/source status
[ ] ABI
[ ] fund-flow diagram
[ ] supported assets
[ ] fee-flow diagram
[ ] FeePolicy behavior
[ ] fee recipient
[ ] admin roles
[ ] resolver role
[ ] verifier role
[ ] upgradeability
[ ] pause/freeze capabilities
[ ] claim mechanics
[ ] refund mechanics
[ ] dispute mechanics
[ ] frontend transaction flow
[ ] wallet approval flow
[ ] Privacy Pool role
[ ] paymaster role
[ ] backend role
[ ] operator legal entity
[ ] target jurisdictions
[ ] marketing model
```

A legal opinion based on a generic description of "decentralized escrow" is not sufficient.

---

# 22. Required Counsel Questions

For every jurisdiction considered for active launch, ask:

```text
1. Is the relevant VINSS operator a regulated custodian?

2. Is Rekber legally an escrow or equivalent service?

3. Does the operator accept or transmit value?

4. Is the operator a money transmitter, MSB, VASP, CASP,
   payment service, DPT service, or local equivalent?

5. Does smart-contract custody change the conclusion?

6. Does bounded resolver authority change the conclusion?

7. Does the objective-verifier role change the conclusion?

8. Do admin, upgrade, pause, or role-replacement powers
   change the conclusion?

9. Does the percentage/minimum fee model change the analysis?

10. Does transaction sponsorship create additional obligations?

11. Are STRK and USDC treated differently?

12. Are stablecoin-specific requirements triggered?

13. Is licensing or registration required?

14. Is a local entity or local presence required?

15. Which product restrictions are required?

16. Which disclosures and Terms are required?

17. Which AML/sanctions duties follow from the classification?

18. What product changes would materially reduce regulatory risk?

19. What facts would change the legal conclusion?

20. When must the opinion be reviewed again?
```

Record the jurisdiction-level conclusion in `jurisdiction-matrix.md`.

---

# 23. Change-Control Rule

Re-open this analysis when any of the following changes:

```text
Rekber contract;
custody path;
supported asset;
fee recipient;
fee formula;
FeePolicy;
resolver;
resolver powers;
objective verifier;
admin role;
upgradeability;
pause/freeze behavior;
claim behavior;
refund behavior;
new payment rail;
fiat support;
paymaster model;
operating entity;
target jurisdiction.
```

A legal conclusion must remain tied to the architecture it actually reviewed.

---

# 24. Core Principle

The correct legal analysis is not:

```text
VINSS is decentralized,
therefore regulation does not apply.
```

Nor is it:

```text
a smart contract holds value,
therefore DXJ Labs is automatically a regulated custodian.
```

The correct approach is:

```text
freeze the actual technical facts
        ↓
identify every actor and power
        ↓
map the asset flow
        ↓
map the service relationship
        ↓
apply the law of each target jurisdiction
        ↓
implement the resulting controls.
```

VINSS should minimize unnecessary custody and operator discretion while documenting the control that actually remains.
