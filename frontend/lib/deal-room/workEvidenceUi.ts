import type { DealType } from "@/types/deal-room";

/*
 * Rekber fulfillment copy is security-sensitive product policy.
 *
 * Calling submit_fulfillment changes user rights: once submitted, the payer
 * can no longer use the unilateral "no fulfillment" timeout refund. Labels
 * therefore describe the point where the fulfiller is claiming the actual
 * obligation has been completed.
 *
 * Physical Goods invariant:
 * "shipped" is only progress. VINSS must submit fulfillment only when the
 * seller claims delivery/hand-over occurred.
 */
interface EvidenceUiCopy {
  actionLabel: string;
  submittedLabel: string;
  composerTitle: string;
  placeholder: string;
  submitButton: string;
  approveButton: string;
  revisionButton: string;
  rejectButton: string;
}

export function evidenceUiForDealType(
  dealType?: DealType,
): EvidenceUiCopy {
  switch (dealType) {
    case "freelance":
      return {
        actionLabel: "Submit work",
        submittedLabel: "Work submitted ✓",
        composerTitle: "Submit work evidence",
        placeholder:
          "Describe what was completed, delivery note, link…",
        submitButton: "Submit Work →",
        approveButton: "Approve work",
        revisionButton: "Request revision",
        rejectButton: "Open dispute",
      };

    case "bounty":
      return {
        actionLabel: "Submit result",
        submittedLabel: "Result submitted ✓",
        composerTitle: "Submit bounty result",
        placeholder:
          "Describe the completed result and supporting evidence…",
        submitButton: "Submit Result →",
        approveButton: "Approve result",
        revisionButton: "Request revision",
        rejectButton: "Open dispute",
      };

    case "digital_goods":
      return {
        actionLabel: "Deliver files",
        submittedLabel: "Digital delivery submitted ✓",
        composerTitle: "Deliver digital goods",
        placeholder:
          "Describe the delivered files, keys, links, or license details…",
        submitButton: "Deliver Files →",
        approveButton: "Accept delivery",
        revisionButton: "Request changes",
        rejectButton: "Open dispute",
      };

    case "goods":
      return {
        actionLabel: "Confirm delivered",
        submittedLabel: "Delivery claimed ✓",
        composerTitle: "Confirm physical delivery",
        placeholder:
          "Add delivery confirmation, tracking, hand-over, or receipt details. Do not mark delivered while the item is only shipped.",
        submitButton: "Mark Delivered →",
        approveButton: "Confirm received",
        revisionButton: "Open dispute",
        rejectButton: "Open dispute",
      };

    case "otc":
      return {
        actionLabel: "Submit settlement proof",
        submittedLabel: "Settlement proof submitted ✓",
        composerTitle: "Submit settlement evidence",
        placeholder:
          "Add the off-chain payment or settlement evidence agreed in the Offer…",
        submitButton: "Submit Proof →",
        approveButton: "Confirm received",
        revisionButton: "Open dispute",
        rejectButton: "Open dispute",
      };

    case "nft":
      return {
        actionLabel: "Submit NFT transfer proof",
        submittedLabel: "NFT transfer submitted ✓",
        composerTitle: "Submit NFT transfer evidence",
        placeholder:
          "Add the expected collection, token ID, transfer transaction, or supporting note…",
        submitButton: "Submit Transfer Proof →",
        approveButton: "Confirm NFT",
        revisionButton: "Request correction",
        rejectButton: "Open dispute",
      };

    case "other":
    default:
      return {
        actionLabel: "Submit fulfillment",
        submittedLabel: "Fulfillment submitted ✓",
        composerTitle: "Submit deal evidence",
        placeholder:
          "Describe how the agreed completion condition was fulfilled…",
        submitButton: "Submit Fulfillment →",
        approveButton: "Approve",
        revisionButton: "Request changes",
        rejectButton: "Open dispute",
      };
  }
}

/*
 * Every current Rekber template needs a fulfillment path before principal can
 * be released. OTC and NFT used to be disabled here, which could leave funded
 * deals unable to progress through the current contract.
 *
 * `undefined` stays enabled for encrypted legacy Offers and uses generic copy.
 */
export function supportsDealEvidence(
  _dealType?: DealType,
): boolean {
  return true;
}
