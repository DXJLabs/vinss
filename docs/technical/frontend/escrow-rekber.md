# Escrow Rekber

## Status

**Implemented / integration stage. End-to-end on-chain verification is still pending.**

## Objective

Escrow Rekber connects accepted deal state to custody and settlement.

The frontend module contains two different technical layers:

```text
encrypted coordination
+
public commitment-based custody/settlement
```

They are layers of one product feature.

## 1. Encrypted coordination

Current coordination actions include:

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

The coordination payload is encrypted before submission.

The public envelope contains:

```text
version
action locator
sender tag
recipient tag
payload commitment
ciphertext
```

not the plaintext coordination action.

## 2. Client-generated settlement secrets

The frontend generates:

```ts
export function generateEscrowSecrets() {
  return {
    releaseSecret: randomFelt(),
    refundSecret: randomFelt(),
  };
}
```

The custody identifier is generated independently:

```ts
export function generateCustodyCommitment(): bigint {
  return randomFelt();
}
```

Release/refund commitments bind the secret to that custody commitment:

```ts
Poseidon(custodyCommitment, releaseSecret)
Poseidon(custodyCommitment, refundSecret)
```

## 3. Deposit

Current deposit calldata conceptually carries:

```text
deposit
custody commitment
release commitment
refund commitment
refund-after timestamp
token
principal amount
```

The frontend withdraws `principal + fee`, routes the fee to treasury through the OPEN note path, and deposits principal into Escrow Rekber.

Current code:

```ts
const principal = params.amount;
const fee = principal / 50n;
const total = principal + fee;
```

So the current implementation uses a **2% Rekber fee**.

## 4. Release / refund

Release:

```text
custody commitment
+ release secret
+ output note id
```

Refund:

```text
custody commitment
+ refund secret
+ output note id
```

The secrets are client-sensitive material.

They must not be sent to:

- backend discovery;
- logs;
- analytics;
- remote Agent context.

## 5. Privacy boundary

The current settlement path must not be described as fully private.

Current code exposes the settlement token and amount on the Rekber contract path.

The private part is primarily the deal context and coordination state.

## Verification gate

Do not change status to testnet on-chain verified until this succeeds end-to-end:

```text
accepted Offer
→ linked Escrow Rekber
→ funding
→ custody
→ release OR refund
→ expected recipient outcome
→ recorded transaction evidence
```
