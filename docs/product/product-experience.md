# VINSS Product Experience

VINSS is designed around the experience of completing a sensitive deal from beginning to end.

The user should not need to think in terms of:

```text
smart contracts,
privacy primitives,
commitments,
proof systems,
or backend architecture.
```

The experience should instead answer a sequence of practical questions:

```text
Who am I dealing with?

What are we discussing?

What exactly are the current terms?

Have we actually agreed?

Who must fund?

Who must fulfill?

How will fulfillment be verified?

What action is required next?

What happens if someone disappears?

What happens if someone lies?

What happens if we disagree?

How do I prove the final outcome?
```

The product experience is therefore organized around the **deal lifecycle**.

---

## 1. The Core Experience

The simplest VINSS journey is:

```text
Create Deal Room
    ↓
Invite Counterparty
    ↓
Private Conversation
    ↓
Create / Counter Offer
    ↓
Accept Agreement
    ↓
Start Rekber
    ↓
Fund
    ↓
Fulfillment
    ↓
Verification
    ↓
Release / Refund / Dispute
    ↓
Settlement
    ↓
Optional Settlement Certificate
```

This is not a rigid wizard.

Users should be able to move naturally through the deal while still understanding the state.

---

## 2. The Product Should Feel Like One Continuous Deal

VINSS should not feel like separate mini-apps for:

```text
chat,
offers,
escrow,
payments,
proof,
and certificates.
```

The user should experience one continuous relationship.

For example:

```text
The conversation explains the context.

The Offer captures the explicit terms.

The accepted Offer defines the deal.

Rekber protects the economic settlement.

Fulfillment determines whether the obligation was performed.

Verification determines what happens next.

Settlement closes the deal.

Evidence remains afterward.
```

Every stage should answer:

> **How did we get here, and what happens next?**

---

## 3. Entry: Create a Deal Room

The first meaningful action is not:

> Create a blockchain transaction.

It is:

> **Create a private place for this deal.**

The creator should be able to understand that the room is tied to a transaction context.

The Deal Room is not a generic social channel.

It should communicate:

```text
this room belongs to one deal;
this room has participants;
this room has a current state;
this room can progress into an agreement;
this room can progress into protected settlement.
```

The user should not need to understand the underlying privacy mechanics at this point.

---

## 4. Invitation: Bring the Correct Counterparty In

After creating a room, the creator shares an invitation.

The invitation experience should feel simple:

```text
Create room
→ Share invite
→ Counterparty joins
```

The important product outcome is confidence that:

```text
both parties are entering the same deal context.
```

The invitation should not expose more private information than needed to allow the intended participant to join.

---

## 5. Private Conversation: Build the Deal Context

Once both parties are inside the room, they can discuss the deal naturally.

Typical discussion may include:

```text
price;
asset;
scope;
deliverable;
quantity;
deadline;
payment terms;
delivery method;
review period;
special conditions.
```

The conversation is intentionally flexible.

But the product should make it clear that chat is **not yet the final agreement**.

A user should feel free to negotiate without accidentally changing the settlement simply by typing an informal message.

---

## 6. The Moment Conversation Becomes Agreement

When one party is ready to formalize the deal, they create an Offer.

The Offer should capture the terms that matter for settlement.

At the product level, the user should understand:

```text
What is being exchanged?

Who provides value?

Who receives value?

Who must fulfill?

What must be fulfilled?

When is the deadline?

How is completion verified?

How long is the review period?
```

The UI does not need to present every deal with identical wording.

Different Deal Types can adapt the language.

But the underlying meaning should remain clear.

---

## 7. Offer Creation

Creating an Offer should feel like:

> **Turn the current negotiation into a proposal that the other party can explicitly respond to.**

The Offer should summarize the important terms before submission.

The creator should be able to review:

```text
deal type;
asset / amount;
roles;
obligation;
deadline;
verification method;
review period;
other material conditions.
```

The product should avoid hiding settlement-relevant consequences behind vague labels.

---

## 8. Counter Offer

The counterparty may disagree with one or more terms.

A Counter Offer should create a new explicit proposal rather than silently editing history.

The experience should make it clear that:

```text
previous proposal
≠
current proposal
```

The user should be able to understand which version is awaiting response.

This helps prevent agreement drift.

---

## 9. Reject

Rejecting an Offer should simply mean:

> **I do not accept these terms.**

It should not imply:

```text
room deleted;
relationship terminated;
funds moved;
or deal permanently impossible.
```

The parties may continue negotiating.

---

## 10. Accept

Accept is one of the most important product actions.

The user should understand:

> **Accepting the Offer establishes the agreement. It does not silently move money.**

That distinction keeps the lifecycle understandable:

```text
negotiate
→ agree
→ protect / fund
→ fulfill
→ verify
→ settle
```

Before acceptance, the user should see the important deal summary.

---

## 11. Accepted Agreement

After acceptance, the product should present one clear shared source of truth.

The accepted agreement should answer:

```text
What was accepted?

Who is the funder?

Who is the beneficiary?

Who must fulfill?

What must happen before settlement?

What is the deadline?

How will fulfillment be verified?

What is the review period?
```

The user should not need to scroll through old messages to reconstruct these facts.

---

## 12. Start Rekber

Rekber should begin from the accepted agreement.

The experience should communicate:

> **You are now moving from agreement into protected settlement.**

The user should not be creating an unrelated escrow object from scratch.

The product should already know the deal context.

Before Rekber begins, both parties should be able to review the economic roles.

---

## 13. Rekber Preflight

Before funding, VINSS should show a clear preflight summary.

For example:

```text
Funder
Alice

Beneficiary
Bob

Protected asset
500 USDC

Fulfillment
Website delivery

Deadline
30 August

Verification
Submission + review

Review period
48 hours
```

The purpose is to catch mistakes before value is committed.

---

## 14. Funding

Funding should feel distinct from acceptance.

The user is now authorizing value to enter the protected settlement flow.

The UI should explain:

```text
what asset;
what amount;
what fee;
who ultimately receives the value;
what conditions must be met before release;
whether refund is possible;
when refund becomes possible.
```

A user should never need to infer these consequences from protocol terminology.

---

## 15. After Funding: Waiting for Fulfillment

After funding, the deal changes from:

```text
awaiting money
```

to:

```text
awaiting obligation.
```

The Deal Room should clearly show:

```text
what the other party must do;
the deadline;
the verification policy;
the next expected action.
```

This is where the experience becomes different for each Deal Type.

---

# DEAL-TYPE EXPERIENCES

## 16. Freelance Experience

Example:

```text
Alice funds 500 USDC.

Bob must build a website.
```

The experience becomes:

```text
FUNDED
→ Bob prepares work
→ Submit Work
→ Alice reviews
→ Approve / Dispute
```

### Bob performs correctly

Bob submits the agreed work.

The room should show:

```text
submission received;
review period started;
deadline for Alice's response;
available actions.
```

Alice approves.

```text
→ RELEASE
→ settlement complete
```

---

## 17. Freelance: Bob Mangkir

Bob never submits work.

The room should not remain ambiguous forever.

The UI should show:

```text
Fulfillment overdue

No valid submission was received.
```

When the agreed condition permits:

```text
→ Alice can recover the protected funds
```

This is the non-performance path.

---

## 18. Freelance: Bob Submits Bad Work

Bob submits something.

But Alice believes it does not satisfy the agreement.

The product should not treat:

```text
submission exists
```

as:

```text
work accepted.
```

Alice should be able to:

```text
review;
state disagreement;
open dispute;
attach relevant evidence.
```

The money should not automatically release merely because Bob clicked Submit.

---

## 19. Freelance: Alice Acts Dishonestly

Bob submits valid work.

Alice obtains the source code or deliverable.

Alice then tries to reject everything and recover all funds.

VINSS should not treat this as if Bob never performed.

Once valid fulfillment has entered verification:

```text
unilateral full-refund power should be restricted.
```

Alice may disagree.

But disagreement should move toward:

```text
DISPUTE
```

rather than a simple rollback of the deal.

---

## 20. Physical Goods Experience

Example:

```text
Alice funds 1,000 USDC.

Bob sells a laptop.
```

A physical-goods experience should not use the same milestones as freelance work.

The progression may be:

```text
FUNDED
→ SHIPPED
→ DELIVERED
→ INSPECTION
→ APPROVE / DISPUTE
```

The user should understand that:

```text
shipment
is not the same as
delivery.
```

And:

```text
delivery
is not automatically the same as
accepted condition.
```

---

## 21. Physical Goods: Seller Mangkir

Bob never ships.

When the shipping or fulfillment deadline passes without valid progress:

```text
→ Alice should receive a recovery path.
```

The room should explain why that path is available.

---

## 22. Physical Goods: Fake Shipment

Bob submits a tracking number that is invalid or does not correspond to meaningful delivery evidence.

The product should not start an inspection countdown merely because Bob pressed:

```text
Shipped
```

The relevant transition should depend on the agreed verification policy.

---

## 23. Physical Goods: Buyer Acts Dishonestly

The item is delivered.

Alice receives it.

Alice then claims:

> It never arrived.

VINSS cannot automatically know every real-world truth.

But if the verification policy includes:

```text
courier confirmation;
tracking;
delivery timestamp;
or other agreed evidence,
```

the system should preserve that evidence and move disagreement into a review/dispute path rather than pretending delivery never happened.

---

## 24. Digital Goods Experience

Example:

```text
Alice funds.

Bob must deliver a file, source code package, license, or digital artifact.
```

The flow can be:

```text
FUNDED
→ DELIVER DIGITAL ITEM
→ DELIVERY PROOF
→ REVIEW
→ APPROVE / DISPUTE
```

VINSS can help preserve evidence that:

```text
an artifact was delivered;
when it was delivered;
which deal it belonged to.
```

But the product should not automatically claim that the artifact is correct or high quality.

---

## 25. Digital Goods: Seller Mangkir

No artifact arrives by the deadline.

The room should make the situation explicit:

```text
No fulfillment received.
```

When the agreed rules permit:

```text
→ funder recovery
```

---

## 26. Digital Goods: Wrong or Broken File

Bob delivers a file.

Alice can access it.

But the file is:

```text
empty;
broken;
wrong;
incomplete;
or inconsistent with the agreed terms.
```

The product can prove delivery happened.

It may not be able to prove quality.

Therefore:

```text
delivery proof
→ review
→ dispute if necessary
```

---

## 27. Digital Goods: Funder Denies Receipt

Alice receives the encrypted package.

She later claims:

> Nothing was delivered.

VINSS should be able to preserve evidence that a delivery event occurred.

That evidence does not automatically resolve every quality dispute.

But it prevents the transaction history from being reduced to a pure “he said / she said” about whether delivery happened at all.

---

## 28. Bounty Experience

Example:

```text
Alice funds a bounty.

Bob submits a result.
```

A bounty should emphasize agreed success criteria.

The experience can show:

```text
Task
Fix bug X

Success criteria
Tests pass
```

The flow becomes:

```text
FUNDED
→ SUBMIT RESULT
→ REVIEW AGAINST CRITERIA
→ APPROVE / DISPUTE
```

---

## 29. Bounty: No Submission

No valid result arrives before the deadline.

```text
→ funder recovery
```

---

## 30. Bounty: Result Is Submitted but Fails Criteria

The fact that a PR or artifact exists does not mean the bounty has been earned.

The product should help both parties compare:

```text
accepted criteria
vs
submitted result.
```

If disagreement remains:

```text
→ dispute
```

---

## 31. NFT Deal Experience

Example:

```text
Alice funds 1,000 USDC.

Bob must transfer NFT #482.
```

The agreement can define:

```text
expected contract;
expected token ID;
expected recipient.
```

The flow becomes:

```text
FUNDED
→ NFT TRANSFER
→ ON-CHAIN VERIFICATION
→ SETTLEMENT
```

This is different from freelance or physical goods because the relevant fulfillment fact can be objectively verified.

---

## 32. NFT Deal: Wrong Asset

Bob transfers:

```text
wrong token;
wrong contract;
wrong token ID.
```

The verification fails.

The product should not treat it as successful fulfillment.

---

## 33. NFT Deal: Buyer Refuses to Acknowledge

The exact agreed NFT is already owned by Alice.

If the product can verify that condition objectively, Alice should not need to press:

> Yes, I received it.

The verified state should be more authoritative than unnecessary human discretion.

---

## 34. Token Trade Experience

Token Trade depends heavily on the settlement rails.

Example:

```text
Bob provides STRK.

Alice pays IDR through bank transfer.
```

The blockchain can verify the STRK side.

It cannot automatically know whether Bob's bank account received IDR.

The experience therefore should not imply that:

```text
payment screenshot
=
verified payment
```

Instead:

```text
Alice submits payment evidence
→ Bob confirms receipt
→ settlement
```

If Bob disagrees:

```text
→ dispute
```

---

## 35. Token Trade: Fake Payment Evidence

Alice uploads a screenshot claiming payment.

Bob did not receive the money.

The product should not automatically release the protected asset.

This is an off-chain verification problem.

---

## 36. Token Trade: Counterparty Denies Real Fiat Payment

Alice really sends the bank payment.

Bob receives it.

Bob refuses to confirm.

The product cannot independently know the bank truth unless an agreed external source is available.

The user should therefore understand:

```text
why confirmation is required;
what evidence can be submitted;
how to start dispute.
```

---

## 37. On-Chain Token Trade

If both sides of a future trade are objectively on-chain assets:

```text
STRK ↔ USDC
```

the product should prefer a more deterministic or atomic model when appropriate.

The principle is:

> **Do not introduce human confirmation when the system can verify the required exchange objectively.**

---

## 38. Custom Deal Experience

Custom Deal provides flexibility but creates more responsibility.

Before protected settlement begins, the product should ask:

```text
Who funds?

Who receives?

Who must fulfill?

What must be delivered?

What is the deadline?

How is completion verified?

How long is the review period?
```

A Custom Deal should not allow ambiguity to hide behind a generic text field.

---

## 39. Subjective Custom Conditions

A user may write:

> Deal is complete if I am satisfied.

That condition is too subjective for deterministic settlement.

VINSS should warn:

> **Completion condition is subjective. A disagreement may require manual dispute resolution.**

The goal is not to prevent subjective deals.

It is to make the consequences explicit before funding.

---

# UNIVERSAL FAILURE AND PROTECTION FLOWS

## 40. Universal Non-Performance Flow

Across Deal Types, the simplest common rule is:

```text
FUNDED
    ↓
awaiting fulfillment
    ↓
deadline passes
    ↓
no valid fulfillment
    ↓
FUNDER RECOVERY
```

The wording can differ by template.

Examples:

```text
No Work Submitted
No Shipment
No Digital Delivery
No Bounty Result
No NFT Transfer
No Payment Confirmation
```

But the economic meaning is the same.

---

## 41. Universal Fulfillment Flow

When meaningful fulfillment begins:

```text
FUNDED
    ↓
FULFILLMENT
    ↓
VERIFICATION
```

The product should now show:

```text
what evidence exists;
what verification policy applies;
who must act next;
what the review deadline is;
what happens if the parties disagree.
```

---

## 42. Universal Approval Flow

If the required verification succeeds:

```text
VERIFIED
    ↓
RELEASE
    ↓
SETTLEMENT COMPLETE
```

For subjective deals, this may happen because the reviewing party approves.

For objective deals, this may happen because the relevant condition is verified directly.

---

## 43. Universal Dispute Flow

A dispute should exist for situations where:

```text
fulfillment happened
but
the parties disagree about whether it satisfied the agreement.
```

The dispute experience should keep the user focused on:

```text
accepted terms;
fulfillment evidence;
verification criteria;
relevant transaction history.
```

It should not encourage dumping unrelated private conversation into the dispute by default.

---

## 44. Mutual Cancellation

Sometimes neither party is necessarily dishonest.

The deal may become impossible or no longer desirable.

If both agree, VINSS should support an understandable path such as:

```text
mutual cancellation
→ refund
or
→ agreed split
```

The outcome should be explicit and mutually authorized.

---

## 45. Timeout After Fulfillment

A silent funder creates a different problem from a missing fulfiller.

Example:

```text
Bob fulfilled.

Alice does nothing.
```

The correct result depends on the Deal Type and verification policy.

VINSS should **not** apply one universal timeout release rule blindly.

For example:

```text
objective on-chain verification
→ deterministic settlement may be appropriate

digital subjective work
→ review window + defined fallback

physical goods
→ countdown may depend on actual delivery

off-chain fiat
→ counterparty confirmation / dispute may remain necessary
```

The user should be able to see the applicable rule before funding.

---

## 46. The Product Must Explain Why an Action Is Available

Actions such as:

```text
Refund
Release
Dispute
Approve
Claim
```

should not simply appear as buttons.

The interface should communicate:

```text
why the action is currently available;
what condition enabled it;
what will happen if the user proceeds.
```

This is especially important for irreversible financial actions.

---

## 47. State Before Buttons

The product should prioritize state clarity over action density.

Instead of showing many controls at once, VINSS should first explain:

```text
Current state
What happened
What is expected next
Deadline
Available action
```

Then show the relevant action.

---

## 48. One Primary Action at a Time

Whenever possible, each party should have one obvious primary action.

Examples:

```text
Review Offer

Fund Rekber

Submit Work

Confirm Delivery

Review Submission

Approve Settlement

Open Dispute
```

Secondary actions may exist.

But the user should not face a wall of equally prominent buttons.

---

## 49. Deal-Type Language

The underlying lifecycle can be universal while the UI language adapts.

Examples:

| Deal type | Fulfillment language |
| --- | --- |
| Freelance | Submit Work |
| Physical Goods | Confirm Shipment / Delivery |
| Digital Goods | Deliver Item |
| Bounty | Submit Result |
| NFT Deal | Transfer NFT / Verify Transfer |
| Token Trade | Confirm Payment / Transfer |
| Custom | Submit Completion |

This helps VINSS avoid forcing every deal into freelance vocabulary.

---

## 50. Role-Aware Language

The UI should avoid assuming:

```text
Offer creator = payer
```

or:

```text
room creator = buyer
```

Instead, the product should show economic roles explicitly.

For example:

```text
You fund this Rekber.

Bob must deliver the item.
```

or:

```text
Bob provides the STRK.

You must complete the fiat payment.
```

This is easier to understand than abstract participant ordering.

---

## 51. Deadlines Must Be Visible

Deadlines determine important rights.

The user should always be able to see:

```text
fulfillment deadline;
review deadline;
refund eligibility timing;
dispute timing;
other time-sensitive conditions.
```

A timeout that materially changes settlement rights should never be hidden in secondary text.

---

## 52. Privacy Status Should Be Understandable

The user should not have to understand cryptography.

But they should understand the privacy outcome.

The product can communicate concepts such as:

```text
Deal content is private to participants.

Settlement evidence may be publicly verifiable.

Some transaction and protocol metadata can remain observable.

A public certificate is optional.
```

Avoid absolute claims such as:

```text
nothing is visible;
fully anonymous;
zero metadata.
```

---

## 53. Transaction Confirmation

When a wallet action is required, the product should explain:

```text
what business action the user is approving;
what value moves;
what fee applies;
whether the action is reversible;
what state should appear afterward.
```

The wallet should not be the first place the user learns what the transaction does.

---

## 54. Interrupted Wallet Flow

Mobile users may:

```text
switch apps;
open a wallet;
return to VINSS;
lose focus;
experience network delay.
```

The product should not treat this automatically as failure.

After returning, VINSS should reconcile the actual deal state and show:

```text
Succeeded
Pending
Not submitted
Needs retry
```

rather than encouraging blind resubmission.

---

## 55. Recovery After Reload

A user should be able to reload the Deal Room and still understand:

```text
the accepted agreement;
the Rekber state;
the current obligation;
the latest fulfillment;
the verification stage;
the next action.
```

The experience should not depend on remembering what happened before the browser closed.

---

## 56. Evidence Timeline

The final timeline should read like a deal story.

For example:

```text
Offer created

Offer countered

Offer accepted

Rekber funded

Work submitted

Submission approved

Funds released

Settlement completed
```

This is more useful than a raw list of transactions.

---

## 57. Evidence Detail

When a user opens a specific event, they may see:

```text
action type;
timestamp;
transaction reference;
relevant deal reference;
verification status;
public evidence when appropriate.
```

The product should avoid exposing unrelated private data simply because the user wants proof of one action.

---

## 58. Settlement Completion

A successful settlement should feel final.

The room should communicate:

```text
Settlement complete

Final outcome
Released / Refunded / Resolved

Relevant evidence
Available

Certificate
Eligible / Not eligible
```

The user should not need to guess whether one more hidden action remains.

---

## 59. Settlement Certificate Experience

When eligible, each party may claim an optional Settlement Certificate.

The product should explain:

```text
what the certificate proves;
what it does not prove;
what information becomes public;
whether claiming is optional.
```

The certificate should not be framed as a speculative reward.

Its purpose is portable evidence.

---

## 60. What the Certificate Should Feel Like

A user should interpret the certificate as:

> **This wallet participated in an eligible VINSS settlement that reached a valid completed state.**

Not:

> VINSS guarantees every real-world fact about this transaction.

That distinction protects the credibility of the product.

---

# EXPERIENCE BY ACTOR

## 61. The Funder Experience

The funder should always understand:

```text
what value is being protected;
what the other party must do;
when the obligation is due;
how fulfillment is verified;
when recovery is possible;
when recovery becomes restricted;
how to dispute.
```

The funder should feel protected against non-performance without receiving unlimited power over a party who has already fulfilled.

---

## 62. The Fulfiller Experience

The fulfiller should always understand:

```text
what must be delivered;
by when;
what counts as valid submission;
what evidence will be preserved;
how long review lasts;
what happens if the funder remains silent;
how to dispute an unfair rejection.
```

The fulfiller should not feel that the funder can consume the benefit and then simply undo the deal.

---

## 63. Shared State

The strongest part of the VINSS experience is shared state.

Both parties should see the same current answer to:

```text
What did we agree?

Who must act?

What has happened?

What is being verified?

What is the current settlement status?
```

This is more important than exposing technical internals.

---

# EXPERIENCE PRINCIPLES

## 64. Deal First

Every major screen should answer:

> What is happening with this deal?

not:

> What contract are we interacting with?

---

## 65. One Action, One Meaning

A user action should have one clear business meaning.

```text
Accept
means agreement.

Fund
means value enters Rekber.

Submit
means fulfillment is presented.

Approve
means verification succeeded.

Dispute
means the parties disagree.

Release
means protected value is settled.
```

Avoid hidden bundled consequences.

---

## 66. Conversation Is Not Agreement

Chat remains flexible.

Offer state remains authoritative for explicit terms.

---

## 67. Agreement Defines Roles

Economic roles come from the accepted deal.

They are not inferred from who created the room or Offer first.

---

## 68. Verification Follows Truth

Objective facts should use objective verification.

Subjective facts should use review.

Off-chain facts should use appropriate evidence, confirmation, oracle, or dispute.

---

## 69. Protect Both Sides

A missing fulfiller should not trap funds forever.

A dishonest funder should not receive the benefit and then recover everything unilaterally.

---

## 70. Make Time Visible

If a deadline changes rights, display it prominently.

---

## 71. Recovery Over Retry

When transaction status is ambiguous:

```text
reconcile first;
retry second.
```

Do not encourage duplicate actions.

---

## 72. Privacy Must Be Legible

Users should understand:

```text
what stays private;
what is verifiable;
what becomes public;
what they may disclose voluntarily.
```

---

## 73. Evidence Should Be Human-Readable

A block explorer is useful.

But the Deal Room should explain what the transaction means in the context of the deal.

---

## 74. Mobile Is a Primary Environment

The experience should be designed for:

```text
small screens;
wallet switching;
interrupted focus;
limited visible context;
thumb-driven interaction.
```

Important state should remain visible without requiring desktop-sized layouts.

---

# END-TO-END EXAMPLES

## 75. Happy Path — Freelance

```text
Alice creates Deal Room
        ↓
Bob joins
        ↓
They discuss website scope
        ↓
Alice creates 500 USDC Offer
        ↓
Bob counters deadline
        ↓
Alice accepts
        ↓
Rekber starts
        ↓
Alice funds 500 USDC
        ↓
Bob submits website
        ↓
Alice reviews
        ↓
Alice approves
        ↓
Funds released to Bob
        ↓
Settlement complete
        ↓
Optional certificate
```

---

## 76. Mangkir Path — Freelance

```text
Agreement accepted
        ↓
Alice funds
        ↓
Bob never submits
        ↓
Fulfillment deadline passes
        ↓
No valid fulfillment
        ↓
Alice receives refund path
        ↓
Rekber refunded
```

---

## 77. Dispute Path — Digital Goods

```text
Agreement accepted
        ↓
Funder deposits
        ↓
Seller delivers digital artifact
        ↓
Delivery evidence exists
        ↓
Funder says artifact is invalid
        ↓
Seller disagrees
        ↓
DISPUTE
        ↓
evidence + accepted terms reviewed
        ↓
resolution
```

---

## 78. Objective Path — NFT

```text
Agreement:
NFT contract X
token #482
to Alice
for 1,000 USDC
        ↓
Alice funds
        ↓
Bob transfers NFT
        ↓
VINSS verifies exact ownership condition
        ↓
objective fulfillment satisfied
        ↓
settlement
```

Human confirmation is minimized because the relevant truth is objectively verifiable.

---

## 79. Physical Delivery Path

```text
Agreement accepted
        ↓
Buyer funds
        ↓
Seller ships
        ↓
delivery evidence
        ↓
item delivered
        ↓
inspection window begins
        ↓
buyer approves
        ↓
release
```

If the buyer disputes condition:

```text
inspection
→ dispute
```

not automatic refund.

---

## 80. Fiat Token Trade Path

```text
Agreement accepted
        ↓
crypto side protected
        ↓
fiat payer sends bank payment
        ↓
payment evidence submitted
        ↓
counterparty confirms receipt
        ↓
crypto released
```

If receipt is disputed:

```text
→ dispute
```

because the blockchain cannot independently know the bank truth without an external source.

---

## 81. Dishonest Funder Path

```text
Agreement accepted
        ↓
funder deposits
        ↓
fulfiller makes valid submission
        ↓
verification stage begins
        ↓
funder attempts unilateral full refund
        ↓
action unavailable / restricted
        ↓
Approve or Dispute
```

The product protects the fulfiller without assuming the submission automatically deserves payment.

---

## 82. Mutual Cancellation Path

```text
Agreement accepted
        ↓
Rekber funded
        ↓
circumstances change
        ↓
both parties agree to cancel
        ↓
mutual authorization
        ↓
refund / agreed split
        ↓
settlement closed
```

---

# VALIDATING THE EXPERIENCE

## 83. First-Time User Test

A first-time user should be able to explain:

```text
what a Deal Room is;
what an Offer is;
what Accept means;
what Rekber protects;
what they must do next;
what happens if the other party disappears.
```

If they cannot, the interface is too complicated.

---

## 84. Offer Comprehension Test

Before Accept, ask the user:

```text
Who funds?

Who receives?

Who must fulfill?

What must be delivered?

What is the deadline?

How is completion verified?
```

If the answers differ between the two participants, the agreement experience has failed.

---

## 85. Rekber Comprehension Test

After funding, both parties should correctly answer:

```text
Where are we in the deal?

Can the funder refund now?

What would prevent refund?

What happens after fulfillment?

Who reviews?

What happens on disagreement?
```

---

## 86. Verification Comprehension Test

Users should understand why:

```text
NFT ownership
can be verified automatically,
```

while:

```text
freelance quality
may require review.
```

The product should not require them to learn technical vocabulary to understand the distinction.

---

## 87. Privacy Comprehension Test

Users should correctly distinguish:

```text
private deal content
from
public/verifiable settlement evidence.
```

If users assume “private” means “nothing anywhere is visible,” the privacy UX needs improvement.

---

## 88. Failure Recovery Test

Interrupt users during:

```text
wallet approval;
funding;
submission;
release.
```

Then return them to the room.

They should be able to tell:

```text
whether the action succeeded;
whether it is pending;
whether retry is safe;
what the current deal state is.
```

---

## 89. Evidence Recall Test

After time has passed, ask a user to reopen a completed deal.

They should be able to identify:

```text
the accepted agreement;
the final settlement outcome;
the important evidence;
the certificate if claimed.
```

without reconstructing the history from screenshots or external notes.

---

## 90. Willingness-to-Pay Test

Do not ask:

> Would you pay for VINSS?

Observe:

```text
which stage users value;
which stage they hesitate at;
which fees they accept;
whether Rekber changes perceived safety;
whether users complete another paid deal.
```

Behavior is stronger evidence than hypothetical enthusiasm.

---

# EXPERIENCE STATUS DISCIPLINE

## 91. Designed Is Not Usable

A flow can exist in documentation without being understandable to users.

---

## 92. Implemented Is Not Reliable

A feature can work once without being resilient to:

```text
mobile switching;
network delay;
wallet rejection;
two-user timing;
recovery.
```

---

## 93. Tested Is Not Customer Validated

A passing technical test does not prove:

```text
users understand the product;
users want the product;
users trust the product;
users will pay.
```

---

## 94. Product Experience Success

VINSS should consider the product experience strong when users can repeatedly:

```text
enter the correct Deal Room;
negotiate privately;
identify the current Offer;
accept the intended agreement;
understand their economic role;
fund without confusion;
fulfill correctly;
understand verification;
handle disagreement;
complete settlement;
recover after interruption;
and retrieve meaningful evidence afterward.
```

---

# PRODUCT EXPERIENCE IN ONE PARAGRAPH

## 95. Public Experience Narrative

A VINSS deal begins when two parties enter a private Deal Room, discuss the transaction, and convert the negotiation into a structured Offer. Once both sides accept the terms, the agreement defines who funds, who fulfills, the deadline, and how completion will be verified. Rekber then protects the settlement while the obligated party performs. Objective deals can use deterministic verification, while subjective or off-chain deals use evidence, review, and dispute. After release, refund, or resolution, the Deal Room preserves understandable settlement evidence and may offer an optional Settlement Certificate without exposing the full private negotiation.

---

## 96. Short Experience Narrative

> **Discuss privately. Agree explicitly. Protect the settlement. Fulfill. Verify appropriately. Settle with evidence.**

---

## 97. Experience Principle

> **At every moment, both parties should know what was agreed, what has happened, who must act next, and why the next action is legitimate.**

---

## 98. Relationship to Other Product Documentation

```text
problem.md
    Why the product problem exists.

solution.md
    How VINSS proposes to solve it.

innovation.md
    What is differentiated about the product approach.

product-experience.md
    How the deal feels from entry to completion.

target-users.md
    Who is likely to need the product most.

use-cases.md
    Concrete transaction scenarios.

validation.md
    Which assumptions have evidence and which remain hypotheses.

README.md
    Concise product overview.
```
