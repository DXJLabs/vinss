import type { DealType } from "@/types/deal-room";

/*
 * Deal-specific work-evidence wording is domain presentation policy.
 * Keeping it outside the chat component prevents new deal types from
 * growing DirectConversationPanel with another large switch statement.
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
        rejectButton: "Reject",
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
        rejectButton: "Reject",
      };

    case "digital_goods":
      return {
        actionLabel: "Deliver files",
        submittedLabel: "Delivery submitted ✓",
        composerTitle: "Deliver digital goods",
        placeholder:
          "Describe the delivered files, keys, links, or notes…",
        submitButton: "Deliver Files →",
        approveButton: "Accept delivery",
        revisionButton: "Request changes",
        rejectButton: "Reject delivery",
      };

    case "goods":
      return {
        actionLabel: "Delivery proof",
        submittedLabel: "Delivery evidence ✓",
        composerTitle: "Submit delivery evidence",
        placeholder:
          "Add tracking, handover, receipt, or delivery details…",
        submitButton: "Submit Evidence →",
        approveButton: "Confirm received",
        revisionButton: "Report issue",
        rejectButton: "Reject delivery",
      };

    default:
      return {
        actionLabel: "Submit evidence",
        submittedLabel: "Evidence submitted ✓",
        composerTitle: "Submit deal evidence",
        placeholder:
          "Describe the delivery or evidence for this deal…",
        submitButton: "Submit Evidence →",
        approveButton: "Approve",
        revisionButton: "Request changes",
        rejectButton: "Reject",
      };
  }
}

export function supportsDealEvidence(
  dealType?: DealType,
): boolean {
  return (
    dealType !== "otc" &&
    dealType !== "nft"
  );
}
