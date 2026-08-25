# STRK20 Integration & Privacy Architecture — VINSS

**Updated:** 2026-08-20
**Status:** MVP / sprint-stage / pre-production

This document is the technical source of truth for VINSS's STRK20 integration.

It explains:

- the intended architecture currently being implemented;
- what is already implemented;
- what has already been proven on-chain on testnet;
- the privacy boundary;
- what remains publicly observable;
- what still requires Escrow Rekber verification;
- how settlement evidence and NFT certificates fit into the architecture.

Customer research, feature rationale, market validation, and Founder Basecamp methodology belong in the VINSS Product Documentation rather than this file.

---

# 1. Technical thesis

STRK20 is not the VINSS product.

STRK20 provides the privacy/execution substrate that makes a different application architecture possible.

VINSS adds:

```text
Encrypted Message
        ↓
Structured Offer
        ↓
Escrow Rekber
        ↓
Settlement Evidence
        ↓
NFT Settlement Certificate
```

The technical goal is to connect private application state with verifiable economic settlement while keeping sensitive deal context away from plaintext public state and trusted backend decryption.

---

# 2. Technical innovation

VINSS's integration is not just “private transfer + UI.”

The application layer introduces several connected primitives.

## 2.1 Application-specific encrypted coordination

VINSS helper contracts receive application-specific encrypted envelopes through privacy-enabled execution.

The Privacy Pool does not need to understand whether ciphertext represents:

- a Message;
- an Offer;
- an Escrow Rekber coordination action.

That semantic layer stays in VINSS.

---

## 2.2 Opaque per-action routing

Instead of storing reusable plaintext sender/recipient address fields in helper records, VINSS derives opaque routing tags tied to application context and fresh action locators.

This reduces direct public application-level identity exposure.

It does **not** claim complete resistance to metadata or traffic correlation.

---

## 2.3 Structured encrypted Offer state

VINSS moves beyond encrypted free-form chat.

The application can represent:

```text
create
counter
accept
reject
cancel
expire
```

while keeping sensitive terms inside ciphertext.

This creates an encrypted state machine for a deal rather than only an encrypted message stream.

**Status:** 🟡 previous build testnet-verified; current fee build requires redeployment.

---

## 2.4 Agreement-linked settlement

Escrow Rekber is designed to follow an accepted Offer rather than exist as an unrelated payment feature.

Target relationship:

```text
Accepted Offer
→ dealOfferLocator
→ Escrow Rekber
→ Settlement
```

This preserves a technical link between agreement state and settlement state.

---

## 2.5 Settlement as verifiable evidence

The final layer is not simply “transaction succeeded.”

VINSS is designed to derive Settlement Evidence from the completed economic action and issue one NFT Settlement Certificate to each party.

The certificate is an evidence artifact, not a reward mechanism.

---

# 3. Target architecture

```text
Invite
  ↓
Private Chat
  ↓
Structured Offer
  ↓
Counter / Accept / Reject
  ↓
Escrow Rekber
  ↓
Settlement Evidence
  ↓
NFT Settlement Certificate
  ├─ Party A
  └─ Party B
```

Current verification state:

```text
Message       ✅ testnet on-chain verified
Offer         ✅ testnet on-chain verified
Escrow Rekber 🟡 E2E on-chain verification pending
Evidence      🟡 pending settlement proof
Certificate   🟡 pending
Mainnet       🟡 pending
```

---

# 4. Role of STRK20

VINSS does not replace or modify the STRK20 Privacy Pool.

Architecture:

```text
VINSS Product Workflow
        ↓
VINSS Client Privacy Layer
        ↓
Privacy-enabled Wallet
        ↓
STRK20 Wallet API
        ↓
STRK20 Privacy Pool
        ↓
VINSS privacy_invoke Helpers
```

STRK20 provides the privacy/execution substrate.

VINSS adds:

- Message semantics;
- Offer semantics;
- Escrow Rekber semantics;
- local encryption/decryption;
- routing;
- commitments;
- discovery;
- evidence;
- certificate issuance logic;
- Agent-assisted workflow.

---

# 5. Inspiration: STRK20 RFP-01

VINSS was inspired by **STRK20 RFP-01 — Encrypted on-chain messaging**.

That direction showed that privacy-pool execution can support application-specific encrypted coordination.

VINSS extends it:

```text
Encrypted Message
        ↓
Private Negotiation
        ↓
Structured Offer
        ↓
Escrow Rekber
        ↓
Settlement Evidence
```

VINSS does not claim that its current key agreement and all implementation details are identical to the RFP.

The code is the source of truth.

---

# 6. Meaning of privacy / anonymity

In VINSS, privacy and anonymity are primarily about **public-observer privacy**.

The objective is to avoid exposing to a public blockchain observer:

- plaintext Message contents;
- plaintext Offer terms;
- plaintext Escrow Rekber coordination details;
- reusable plaintext participant identity fields in application helper state;
- client-side encryption keys.

This is not a claim that:

- legal obligations disappear;
- lawful disclosure is impossible;
- compliance does not apply;
- all metadata disappears;
- perfect unlinkability is guaranteed.

```text
Public-observer privacy
≠
authorized / lawful disclosure
```

Selective disclosure and compliance paths can coexist with public privacy.

---

# 7. Current stack

Current frontend package state:

```text
Next.js: ^16.3.1
React: ^19.2.8
TypeScript: ^5.5.0
starknet: 10.4.0
@starknet-io/get-starknet-discovery: ^6.0.4
@starknet-io/get-starknet-wallet-standard: ^6.0.4
@starknet-io/types-js: ^0.10.3
@avnu/avnu-sdk: ^4.2.0
```

Older documentation that says the frontend currently runs `starknet@10.7.0` is stale.

---

# 8. Application-level direct key agreement

Current direct messaging uses browser-side application key agreement:

```text
P-256 ECDH
→ shared secret
→ HKDF-SHA-256
→ room-scoped pairwise VINSS key
```

The private ECDH key is:

- generated in the browser;
- re-imported as a non-exportable `CryptoKey`;
- persisted in IndexedDB;
- never sent to the VINSS backend;
- never written as plaintext on-chain.

## Explicit non-claim

VINSS does not claim that its current P-256 application ECDH is the same key agreement mechanism used internally by STRK20 note encryption.

It is an application-layer mechanism.

---

# 9. Message architecture

Current module:

```text
frontend/lib/deal-room/messaging.ts
```

Flow:

```text
MessagePayload
    ↓
client encryption
    ↓
fresh action locator
    ↓
opaque senderTag / recipientTag
    ↓
payload commitment
    ↓
ciphertext envelope
    ↓
strk20InvokeTransaction(...)
    ↓
STRK20 Privacy Pool
    ↓
VinssMessageHelper.privacy_invoke(...)
```

The helper receives encrypted application data rather than plaintext Message content.

**Verification status:** 🟡 previous build testnet-verified; current fee build requires redeployment.

---

# 10. Opaque routing

VINSS uses per-action opaque routing tags.

Purpose:

- avoid reusable plaintext sender/recipient fields in helper state;
- avoid trivially exposing participant relationships at the application-record level;
- allow authorized clients to identify relevant encrypted actions.

Non-claim:

> Opaque routing does not mean zero metadata.

Public observers can still see:

- transaction timing;
- block metadata;
- pool interaction;
- helper interaction;
- ciphertext;
- commitments;
- public token legs;
- other activity patterns.

---

# 11. Offer architecture

Current module:

```text
frontend/lib/deal-room/offers.ts
```

Current deal types:

```text
otc
freelance
goods
digital_goods
bounty
nft
other
```

Current Offer lifecycle:

```text
create
counter
accept
reject
cancel
expire
```

Offer payload can include encrypted:

- participant fields;
- deal type;
- root/parent Offer relation;
- asset;
- amount;
- payment terms;
- conditions;
- expiration;
- reason.

Flow:

```text
Offer payload
    ↓
client encryption
    ↓
fresh locator
    ↓
opaque routing tags
    ↓
payload commitment
    ↓
STRK20 invoke
    ↓
VinssOfferHelper
```

**Verification status:** ✅ **testnet on-chain verified.**

The product rationale for each deal type belongs in Product Documentation.

---

# 12. Offer → Escrow Rekber transition

An encrypted Rekber `create` coordination action links the accepted agreement to settlement state. It does not create a paid OfferHelper action.

Target:

```text
Accepted Offer
    ↓
dealOfferLocator
    ↓
Escrow Rekber
```

This prevents the settlement layer from becoming disconnected from the agreement it is supposed to execute.

---

# 13. Escrow Rekber architecture

VINSS uses one product name:

> **Escrow Rekber**

Internally, the flow has two technical concerns:

```text
A. encrypted coordination
B. custody / settlement
```

They are two layers of one product feature, not two separate product features.

---

# 14. Escrow Rekber coordination

Current module:

```text
frontend/lib/deal-room/escrow.ts
```

Current coordination action model:

```text
create
fund_intent
accept
fund_confirm
cancel
refund
dispute
resolve
```

Encrypted EscrowActionPayload may include:

```text
dealOfferLocator
custodyCommitment
refundAfter
reason
```

The coordination layer keeps detailed state inside encrypted application payloads where possible.

**Verification status:** 🟡 implemented/integration stage.

---

# 15. Escrow Rekber custody / settlement

Current settlement design uses client-generated:

```text
custodyCommitment
payerReleaseAuthorizationSecret
payeeClaimSecret
refundSecret
releaseAuthorizationCommitment
payeeClaimCommitment
refundCommitment
payerCertificateCommitment
payeeCertificateCommitment
```

Conceptual actions:

### Deposit

```text
[
  deposit,
  custody_commitment,
  release_authorization_commitment,
  payee_claim_commitment,
  refund_commitment,
  payer_certificate_commitment,
  payee_certificate_commitment,
  refund_after,
  token,
  amount,
  revenue_open_note_id
]
```

### Release

```text
[
  release,
  custody_commitment,
  payer_release_authorization_secret,
  payee_claim_secret,
  output_note_id
]
```

### Refund

```text
[
  refund,
  custody_commitment,
  refund_secret,
  output_note_id
]
```

Sensitive secrets remain client-side.

They must never be:

- sent to discovery;
- logged;
- included in analytics;
- persisted server-side as plaintext.

**Verification status:** 🟡 E2E on-chain verification pending.

---

# 16. Escrow Rekber privacy boundary

Current settlement design must not be marketed as fully private settlement.

| Element | Current boundary |
|---|---|
| Negotiation context | Encrypted |
| Offer terms | Encrypted |
| Escrow coordination detail | Encrypted |
| Custody commitment | Public |
| Token | Public on current settlement path |
| Amount | Public on current settlement path |
| Tx timing | Public |
| Release/refund result | Verifiable |
| Release/refund secrets | Client-side sensitive |

Public-observer privacy protects the private deal context; it does not erase every settlement artifact.

---

# 17. Escrow Rekber verification gate

Current rule:

```text
implemented
≠
E2E verified
```

Minimum proof:

```text
Accepted Offer
→ linked Escrow Rekber
→ funding
→ custody state
→ release OR refund
→ expected recipient outcome
→ transaction hashes
→ hidden-vs-visible review
```

Only then should status change to:

```text
Testnet On-chain Verified
```

Mainnet is a separate evidence level.

---

# 18. Settlement Evidence

Settlement Evidence should be derived from an actual successful settlement.

Target link:

```text
deal / Offer reference
→ Escrow Rekber reference
→ settlement action
→ on-chain evidence
```

The evidence layer must not require private deal contents to become public.

**Verification status:** 🟡 pending Escrow Rekber proof.

---

# 19. NFT Settlement Certificate

After a valid release, VINSS lets each party independently claim an optional NFT Settlement Certificate.

```text
Successful Settlement
        ↓
Settlement Evidence
        ↓
NFT Certificate → Party A
NFT Certificate → Party B
```

The NFT is an evidence artifact.

It is not:

- a reward;
- a loyalty point;
- a speculative token;
- a collectible feature added for Web3 optics.

## Privacy requirement

The certificate must not re-publish:

- private Message history;
- private Offer terms;
- channel keys;
- release/refund secrets;
- any sensitive application data that is not required for verification.

The final metadata schema should be locked only after Escrow Rekber settlement is proven and the evidence model is reviewed.

**Verification status:** 🟡 contract/frontend implemented and Cairo-tested; deployment/E2E pending.

---

# 20. Ciphertext-only discovery

Current endpoint:

```text
POST /discover
```

Current implementation:

```text
backend/src/routes/discover.ts
```

Backend may return:

- actionLocator;
- payloadCommitment;
- senderTag;
- recipientTag;
- ciphertextChunks;
- blockNumber;
- transactionHash.

Backend must not receive:

- channelKeyHex;
- pairwise private key;
- wallet private key;
- viewing key.

The current route explicitly rejects `channelKeyHex`.

Decryption stays on the authorized client.

---

# 21. Hidden vs visible matrix

| Element | Hidden / protected | Public / observable |
|---|---|---|
| Message plaintext | Yes | Ciphertext |
| Offer terms | Yes | Ciphertext + commitment |
| Escrow Rekber coordination detail | Yes | Ciphertext + commitment |
| Plaintext participant fields in helper state | Not exposed directly | Opaque tags |
| Pairwise app key | Client-only | No |
| Client private ECDH key | Client-only | No |
| Backend channel-key access | None | — |
| Pool interaction | No | Yes |
| Helper interaction | No | Yes |
| Transaction timing | No | Yes |
| Block / tx metadata | No | Yes |
| Action locator | No | Yes |
| Payload commitment | No | Yes |
| Ciphertext | Content protected | Yes |
| Rekber token | No | Yes |
| Rekber amount | No | Yes |
| Settlement result | — | Verifiable |
| NFT certificate | Evidence artifact | Public fields depend on final schema |

---

# 22. Payment Memo boundary

Private Payment Memo remains a product direction:

```text
payment + private context
```

But the integration documentation must not claim an atomic payment+memo flow is verified until there is transaction evidence for that exact path.

---

# 23. Agent authorization boundary

Current Agent pattern:

```text
Observe permitted context
→ Reason
→ Propose
→ Ask approval
→ User signs / executes
```

The Agent can assist with:

- Messages;
- Offers;
- Counter Offers;
- Escrow Rekber preparation;
- Rekber review.

It must not receive:

- wallet private keys;
- ECDH private keys;
- channel keys;
- settlement secrets.

Financial execution remains behind explicit wallet authorization.

---

# 24. Verification levels

VINSS uses these evidence levels:

### Designed
Architecture or product behavior has been defined.

### Implemented
Code exists and can be inspected.

### Tested
Relevant tests pass.

### Testnet On-chain Verified
A real testnet transaction succeeded.

### Mainnet Verified
Real mainnet evidence exists.

### Customer Validated
Real user behavior supports the product hypothesis.

Current state:

```text
Message → Current 7 STRK build redeploy/E2E pending
Offer → Current 10 STRK build redeploy/E2E pending
Escrow Rekber → Canonical source + Cairo tests / redeploy/E2E pending
NFT Settlement Certificate → Source + Cairo tests / deployment pending
```

---

# 25. Next E2E target

Because Message and Offer are already proven, the next core technical test is:

```text
Private Deal Room
→ verified Message
→ verified Offer
→ Accepted Offer
→ Escrow Rekber funding
→ Release OR Refund
→ Settlement Evidence
→ NFT Certificate Party A
→ NFT Certificate Party B
```

For each step, record:

- tx hash;
- contract address;
- wallet behavior;
- public data;
- encrypted/protected data;
- failure mode;
- retry behavior;
- final recipient outcome.

---

# 26. Negative tests

Minimum Escrow Rekber / evidence tests:

- wrong payer authorization secret fails;
- wrong payee claim secret fails;
- wrong refund secret fails;
- invalid timing fails as expected;
- wrong Offer cannot silently bind to Escrow Rekber;
- duplicate funding does not create duplicate custody state;
- retry does not duplicate settlement;
- failed signing does not create false success;
- secrets do not appear in logs;
- certificate cannot be issued from an invalid settlement;
- certificate metadata does not leak private deal payload.

---

# 27. Mainnet qualification

README prose is not mainnet evidence.

Private Sprint evidence belongs in:

```text
strk20.json
```

Mainnet completion requires real successful transactions and the required demo artifacts.

Testnet proof for Message and Offer must remain labeled testnet until equivalent mainnet evidence exists.

---

# 28. Documentation claim rules

1. Earlier Message builds have testnet evidence; the current 7 STRK build requires fresh evidence.
2. Earlier Offer builds have testnet evidence; the current 10 STRK build requires fresh evidence.
3. Escrow Rekber must not be described as E2E verified yet.
4. NFT Settlement Certificate is implemented/Cairo-tested but not live until deployed issuance is proven.
5. Privacy/anonymity means primarily privacy from public observers.
6. Do not claim privacy removes compliance or lawful disclosure.
7. Do not claim `no metadata`.
8. Do not claim the backend decrypts.
9. Do not equate current P-256 app ECDH with STRK20 note encryption.
10. Do not describe current Rekber amount as private.
11. Do not equate technical proof with customer validation.
12. Do not let hackathon scoring redefine the product roadmap.

---

# 29. Current priorities

## P0 — Escrow Rekber correctness

- bind accepted Offer to Escrow Rekber;
- verify coordination state;
- protect settlement secrets;
- review calldata against Cairo;
- confirm hidden-vs-visible boundary.

## P1 — Escrow Rekber testnet proof

- funding;
- custody confirmation;
- release;
- refund;
- repeatable recipient outcome;
- transaction evidence.

## P2 — Settlement Evidence

- canonical settlement reference;
- evidence derived from actual settlement;
- privacy-safe evidence model.

## P3 — NFT Settlement Certificate

- issuance rule;
- one certificate for each party;
- privacy-safe metadata;
- verifiable settlement linkage;
- negative tests.

## P4 — Mainnet

- minimum required deployments;
- successful STRK20 mainnet actions;
- valid `strk20.json`;
- public demo;
- demo video.

---

# 30. Repository map

```text
frontend/types/deal-room.ts

frontend/lib/deal-room/messaging.ts
frontend/lib/deal-room/offers.ts
frontend/lib/deal-room/escrow.ts
frontend/lib/deal-room/invitation.ts

frontend/lib/privacy/participantKeys.ts
frontend/lib/privacy/messageRouting.ts
frontend/lib/privacy/envelope.ts

frontend/lib/agent.ts

backend/src/routes/discover.ts
backend/src/indexer/

contracts/
docs/
```

---

# 31. Definition of technical completion

The core integration is not technically complete until:

```text
Message ✅
+
Offer ✅
+
Escrow Rekber verified
+
Settlement Evidence verified
+
NFT Certificate issuance verified
```

and the privacy boundary is documented for every stage.

---

# 32. Definition of product success

Technical completion is still not product success.

Product success requires:

```text
real user
+
real repeated problem
+
real deal
+
successful settlement
+
useful evidence
+
repeat usage / willingness to pay
```

VINSS must prove both the technical system and the customer value without confusing one for the other.
