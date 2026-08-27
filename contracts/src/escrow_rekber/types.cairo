use starknet::ContractAddress;

// -----------------------------------------------------------------------------
// Verification policy classes
// -----------------------------------------------------------------------------
//
// The public contract sees only a broad verification class. The encrypted
// Offer still carries the real business template and plaintext terms.

// A payee submission immediately starts the payer review window.
// Good for freelance, digital goods, bounty, and subjective custom deals.
pub const POLICY_SUBMISSION_REVIEW: u8 = 1;

// Submission alone does NOT start review. The payer must confirm receipt first.
// Good for physical delivery and crypto<->fiat where "I sent it" is not enough.
pub const POLICY_COUNTERPARTY_CONFIRM: u8 = 2;

// A configured verifier confirms the exact submitted evidence commitment.
// This is available for future objective on-chain/NFT verifier adapters.
pub const POLICY_EXTERNAL_VERIFY: u8 = 3;

#[derive(Copy, Drop, Serde, starknet::Store, PartialEq, Debug)]
pub struct EscrowRekberCustody {
    pub custody_commitment: felt252,

    // Clean successful settlement capabilities.
    pub release_authorization_commitment: felt252,
    pub payee_claim_commitment: felt252,

    // Payer recovery before fulfillment.
    pub refund_commitment: felt252,

    // Policy-specific receipt confirmation.
    pub payer_confirmation_commitment: felt252,

    // Either side can lock a disputed custody using an independent capability.
    pub payer_dispute_commitment: felt252,
    pub payee_dispute_commitment: felt252,

    // After fulfillment, a full refund requires explicit payee consent.
    pub payee_refund_consent_commitment: felt252,

    // Bounded one-way chains for repeated fulfillment/revision actions.
    pub fulfillment_chain_head: felt252,
    pub revision_chain_head: felt252,

    // Optional public settlement certificate commitments.
    pub payer_certificate_commitment: felt252,
    pub payee_certificate_commitment: felt252,

    pub token: ContractAddress,
    pub amount: u128,
    pub fee_amount: u128,

    // No fulfillment by this deadline => payer timeout refund is available.
    pub fulfillment_deadline: u64,

    // Once fulfillment is confirmed, payer gets this long to act.
    pub review_window: u64,
    pub review_deadline: u64,

    // A requested revision gets its own bounded resubmission deadline.
    pub revision_deadline: u64,

    pub verification_policy: u8,
    pub fulfillment_rounds_remaining: u8,
    pub revision_rounds_remaining: u8,

    // Public commitments only. Evidence plaintext/file bytes stay encrypted.
    pub fulfillment_evidence_commitment: felt252,
    pub dispute_evidence_commitment: felt252,

    // Resolver can authorize only an exact split of this custody's principal.
    // The existing payer/payee secrets claim their own portions; the resolver
    // never receives funds and cannot redirect a payout to another address.
    pub resolution_commitment: felt252,
    pub resolution_payer_amount: u128,
    pub resolution_payee_amount: u128,

    pub fulfillment_submitted: bool,
    pub fulfillment_confirmed: bool,
    pub revision_pending: bool,
    pub disputed: bool,
    pub resolution_authorized: bool,
    pub resolution_payer_claimed: bool,
    pub resolution_payee_claimed: bool,

    pub consumed: bool,
    pub refunded: bool,

    pub created_at: u64,
    pub fulfilled_at: u64,
    pub settled_at: u64,
}
