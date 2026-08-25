# VINSS — Private Deal Room on Starknet

> **Deals do not begin with a transaction. They begin with trust.**

Two people can meet in a chat, negotiate a price, agree on terms, exchange wallet addresses, send funds, and still end up with no shared source of truth for what was actually agreed.

The conversation lives in one place.
The payment happens somewhere else.
The proof becomes a screenshot, a transaction hash, or whatever each side managed to save.

VINSS is built around a different idea:

> **A deal should move from conversation → agreement → settlement → evidence without forcing its private context into public view.**

VINSS is a **Private Deal Room on Starknet** for encrypted communication, structured Offers, Escrow Rekber, and verifiable settlement evidence.

```text
Invite
  → Private Chat
  → Structured Offer
  → Counter / Accept / Reject
  → Escrow Rekber
  → Settlement Evidence
  → NFT Settlement Certificate for each party
```

VINSS is not a general-purpose messenger.
Each room exists around a deal.

---

## Why this matters

A real transaction is more than moving money.

Before value changes hands, people need to answer:

- What is being exchanged?
- At what price?
- Under what conditions?
- Who acts first?
- What happens if one side does not deliver?
- How do both sides prove the final outcome?

Today, many crypto-native deals are still coordinated like this:

```text
Telegram / Discord / DM
        ↓
terms buried in conversation
        ↓
wallet address exchange
        ↓
direct payment / middleman / escrow
        ↓
screenshots + tx hashes as evidence
```

That creates real problems around fraud, impersonation, irreversible payments, fragmented deal context, and public blockchain exposure.

The VINSS product research documents those problems using public sources. Those sources prove that the **problem space is real**; they do not prove that VINSS already has product-market fit.

Customer demand, willingness to switch workflows, willingness to pay, and the best initial segment still need real user validation.

---

# The innovation

VINSS is not innovative because it “adds privacy to chat.”

The innovation is the **deal workflow built on top of privacy primitives**.

## 1. From private messaging to private economic coordination

VINSS was inspired by **STRK20 RFP-01 — Encrypted on-chain messaging**.

That idea showed that a privacy pool can support encrypted application coordination, not only private transfers.

VINSS extends that direction:

```text
Encrypted Messaging
        ↓
Private Negotiation
        ↓
Structured Offer
        ↓
Escrow Rekber
        ↓
Settlement Evidence
```

Messaging is the substrate.

**The product is the deal lifecycle.**

---

## 2. Conversation becomes structured state

Normal chat can contain:

> “I’ll pay 500 USDC if you deliver by Friday.”

But chat alone does not create a clean application state.

VINSS turns negotiation into a structured Offer lifecycle:

```text
create
→ counter
→ accept / reject
→ cancel / expire
→ prepare escrow
```

The current Offer model supports:

```text
OTC
Freelance / Service
Goods
Digital Goods
Bounty
NFT
Other
```

The deal classification, participant fields, asset, amount, payment terms, conditions, expiry, and Offer relationships can stay inside encrypted application payloads rather than being published as plaintext helper state.

**Status:** 🟡 previous build testnet-verified; current fee build requires redeployment and fresh evidence.

---

## 3. Settlement is connected to the agreement

VINSS does not treat escrow as a separate random feature.

An accepted Offer can become the reference point for **Escrow Rekber**.

```text
Accepted Offer
    ↓
Escrow Rekber coordination
    ↓
Funding
    ↓
Custody
    ↓
Release / Refund
```

This preserves a relationship between:

```text
what was agreed
and
what was settled
```

**Status:** 🟡 implemented/integration stage — end-to-end on-chain verification is still pending.

---

## 4. Settlement creates portable evidence

A deal should not end with only a green “Completed” label.

VINSS implements optional **NFT Settlement Certificates** that each party claims independently after a successful release.

```text
Successful Settlement
        ↓
Settlement Evidence
        ↓
NFT Certificate → Party A
NFT Certificate → Party B
```

The NFT is not intended as a collectible, reward, or speculative asset.

Its purpose is:

> **portable, verifiable evidence that a settlement occurred.**

The certificate must not re-expose private chat history, private Offer terms, channel keys, Escrow Rekber secrets, or other sensitive data protected earlier in the flow.

**Status:** 🟡 contract and frontend implemented/Cairo-tested; deployment and E2E verification pending.

---

## 5. Privacy without pretending metadata disappears

VINSS treats privacy as a design boundary, not a checkbox.

The goal is not:

```text
“hide everything”
```

The goal is:

> **Hide what does not need to be public. Verify what needs to be proven.**

That means VINSS protects deal context from **public observers**, while preserving a path for verifiable settlement and, where required, authorized or lawful disclosure.

Public-observer privacy is not the same thing as avoiding compliance.

```text
Public-observer privacy
≠
authorized / lawful disclosure
```

VINSS does not claim:

- “no metadata”;
- “perfect anonymity”;
- “everything is private”;
- “lawful disclosure is impossible.”

---

# Core product flow

## Private Chat

A deal usually starts with communication.

VINSS encrypts Message payloads on the client before they are submitted through the privacy-enabled execution flow.

The objective is not “Web3 chat.”
The objective is to keep deal context private from public observers and connect that context to the rest of the deal lifecycle.

**Status:** 🟡 previous build testnet-verified; current fee build requires redeployment and fresh evidence.

---

## Structured Offer

Offers convert informal negotiation into explicit application state.

Current lifecycle:

```text
create
counter
accept
reject
cancel
expire
```

Current deal types:

```text
OTC
Freelance / Service
Goods
Digital Goods
Bounty
NFT
Other
```

**Status:** 🟡 previous build testnet-verified; current fee build requires redeployment and fresh evidence.

The deeper product rationale behind each Offer type belongs in the VINSS Product Documentation rather than this README.

---

## Escrow Rekber

VINSS uses one product name for the settlement layer:

> **Escrow Rekber**

It combines:

```text
private coordination
→ funding
→ custody
→ release / refund
```

The coordination model can represent:

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

The canonical settlement requires independent payer authorization and payee claim secrets for release, plus a payer timeout-refund secret.

**Status:** 🟡 integration / end-to-end on-chain verification pending.

---

## Settlement Evidence + NFT Certificate

After a valid release, VINSS lets each wallet claim its own optional public settlement certificate.

The evidence layer should connect:

```text
deal reference
→ escrow/custody reference
→ settlement action
→ verifiable on-chain result
```

without publishing the private contents of the deal.

**Status:** 🟡 implemented and Cairo-tested; canonical deployment and E2E evidence pending.

---

# Why STRK20?

STRK20 is a **privacy and execution substrate**, not the product value proposition by itself.

VINSS uses it where privacy materially improves the deal:

- reducing public exposure of private deal context;
- avoiding plaintext application identities and terms where they do not need to be public;
- enabling application-specific actions through privacy-aware execution;
- preserving verifiable settlement;
- keeping private application data out of backend plaintext storage.

VINSS does not add swaps, bridges, staking, tokens, or other Web3 features merely because they are available.

The rule is simple:

> **What real user problem becomes meaningfully better because this feature exists?**

If there is no good answer, it does not belong in the core product.

---

# Privacy boundary

| Element | Current treatment |
|---|---|
| Message plaintext | Client-side encrypted |
| Offer terms | Client-side encrypted |
| Escrow Rekber coordination details | Client-side encrypted |
| Pairwise application key | Client-only |
| Discovery backend | Ciphertext-only |
| Pool interaction | Public |
| Transaction timing / block metadata | Public |
| Helper contract interaction | Public |
| Ciphertext / commitments | Public but opaque without the required key |
| Rekber token / amount in the current settlement design | Public |
| Settlement result | Verifiable |
| NFT Settlement Certificate | Evidence artifact; final metadata follows the privacy boundary |

---

# How it works

```text
User Device
  │
  ├─ local identity / keys
  ├─ encrypt / decrypt
  ├─ build Message / Offer / Escrow Rekber payloads
  │
  ▼
Privacy-enabled Wallet
  │
  ▼
STRK20 Wallet API
  │
  ▼
STRK20 Privacy Pool
  │
  ▼
VINSS Cairo Helpers
  ├─ Message
  ├─ Offer
  └─ Escrow Rekber
  │
  ▼
Public events + ciphertext / commitments
  │
  ▼
VINSS Discovery Backend
  │
  └─ ciphertext only
  │
  ▼
Authorized User Device decrypts locally

After successful settlement:
  ↓
Settlement Evidence
  ↓
NFT Settlement Certificate
  ├─ Party A
  └─ Party B
```

See [`STRK20_INTEGRATION_PLAN.md`](STRK20_INTEGRATION_PLAN.md) for the technical architecture and verification boundaries.

---

# Ciphertext-only backend

VINSS discovery is deliberately not a trusted plaintext messaging server.

`POST /discover` may return:

- action locator;
- payload commitment;
- opaque routing tags;
- ciphertext;
- block number;
- transaction hash.

The backend does not receive the channel key and does not decrypt private Message, Offer, or Escrow Rekber coordination payloads.

Decryption remains on the authorized user's device.

---

# VINSS Agent

VINSS Agent is an assistive layer, not an autonomous wallet operator.

```text
Observe permitted context
→ Reason
→ Propose
→ Ask approval
→ User signs / executes
```

The Agent can help prepare:

- Messages;
- Offers;
- Counter Offers;
- Escrow Rekber actions;
- Rekber review.

It does not receive wallet private keys or silently move funds.

---

# Verification status

VINSS separates:

```text
Designed
Implemented
Tested
Testnet On-chain Verified
Mainnet Verified
Customer Validated
```

Current status:

| Component | Status |
|---|---|
| Encrypted Message | 🟡 Current 7 STRK build redeploy/E2E pending |
| Structured Offer | 🟡 Current 10 STRK build redeploy/E2E pending |
| Ciphertext-only discovery | ✅ Implemented |
| Client-side decryption | ✅ Implemented |
| Escrow Rekber coordination | 🟡 Integration / verification pending |
| Escrow Rekber funding | 🟡 On-chain E2E verification pending |
| Escrow Rekber release / refund | 🟡 On-chain E2E verification pending |
| NFT Settlement Certificate for each party | 🟡 Implemented/Cairo-tested; deployment pending |
| Mainnet sprint evidence | 🟡 Pending |

Earlier Message and Offer builds have testnet evidence; the current fee builds require fresh deployment evidence.

Escrow Rekber and settlement certificates are not promoted to “verified” until that evidence exists.

---

# Product truth vs technical truth

VINSS keeps three types of evidence separate.

### Problem evidence

Public research can show that fraud, impersonation, irreversible transfers, fragmented coordination, and blockchain metadata exposure are real problems.

### Technical evidence

On-chain tests can prove that a VINSS primitive works.

Earlier Message and Offer builds have testnet evidence; current fee builds are not yet re-verified.

### Customer evidence

Only real users can prove:

- repeated pain;
- real workarounds;
- willingness to move a deal into VINSS;
- repeat usage;
- willingness to pay.

A smart contract is not customer validation.

---

# Repository

| Path | Purpose |
|---|---|
| `frontend/` | Next.js Deal Room UI, wallet integration, local privacy logic |
| `frontend/lib/deal-room/` | Messaging, Offer, invitation, Escrow Rekber |
| `frontend/lib/privacy/` | Encryption, participant keys, routing, commitments |
| `backend/` | Ciphertext discovery/indexing and Agent backend |
| `contracts/` | Cairo application helpers |
| `docs/` | Product and technical documentation |
| `STRK20_INTEGRATION_PLAN.md` | STRK20 architecture, privacy boundaries, verification status |
| `TEST_REPORT.md` | Test evidence and explicit non-claims |
| `strk20.json` | Mainnet sprint evidence when available |

---

# Private Sprint

VINSS is participating in the STRK20 Private Sprint.

The sprint is useful because it forces the privacy integration to become real and demonstrable.

But the sprint is not the long-term product roadmap.

VINSS should continue to follow:

```text
real problem
→ evidence
→ product decision
→ implementation
→ real usage
```

---

# The thesis

VINSS started from encrypted messaging, but encrypted messaging is not the destination.

> **VINSS turns private communication into private economic coordination — and turns settlement into evidence.**

The product succeeds only if that workflow becomes useful enough that real people choose it for real deals.

---

# License

MIT — see [`LICENSE`](LICENSE).
