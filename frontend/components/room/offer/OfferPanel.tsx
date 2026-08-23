"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { VinssWalletSession } from "@/lib/starknet/walletClient";
import type { AgentProposal } from "@/lib/agent";
import type { DealType } from "@/types/deal-room";
import type { RoomParticipant } from "@/lib/privacy/participantKeys";
import type { ConversationEntry } from "@/components/room/conversation/ConversationPanel";
import type { OfferTermsInput } from "@/hooks/room/useRoomOffers";

type OfferTemplateId =
  | "freelance"
  | "token_trade"
  | "physical_goods"
  | "digital_goods"
  | "bounty"
  | "nft_deal"
  | "custom_deal";

type OfferHelpTopic = "terms";

const OFFER_HELP: Record<
  OfferHelpTopic,
  {
    title: string;
    paragraphs: string[];
  }
> = {
  terms: {
    title: "How does this Offer work?",
    paragraphs: [
      "An Offer is a private proposal between you and the other participant. Use it to record the deal terms both sides should understand before agreeing.",
      "Choose the Deal Type that best matches the agreement. VINSS adapts the form so you only enter terms relevant to that kind of deal.",
      "Complete the main terms first. Optional fields can be left empty when they are not important to your agreement.",
      "More Terms is for additional conditions that can make the agreement clearer, such as deadlines, acceptance requirements, revisions, delivery conditions or inspection periods.",
      "Before anything is sent, Review Offer lets you check the complete proposal. The other participant can then Accept, Reject or Counter it.",
      "The 1 STRK Private Offer action fee is separate from the value of the deal. It does not fund Escrow.",
      "When an Offer or Counter is accepted, it becomes the agreed basis for the deal. Accepting it still does not move funds.",
      "The wallet that sends the original Offer is the Escrow Payer and deposits the agreed token. The other wallet is the Payee. Counter Offers do not swap these roles.",
      "Escrow is a separate step after agreement. Funds are only secured when Escrow is started from the accepted agreement and the funding action is completed.",
      "VINSS keeps the deal terms private while recording proof of the private action on Starknet.",
    ],
  },
};

type TemplateFieldType =
  | "text"
  | "number"
  | "textarea"
  | "choice"
  | "payment_asset";

interface TemplateChoice {
  value: string;
  label: string;
}

interface OfferTemplateField {
  id: string;
  label: string;
  placeholder?: string;
  type: TemplateFieldType;
  optional?: boolean;
  advanced?: boolean;
  choices?: TemplateChoice[];
}

interface OfferTemplateDefinition {
  id: OfferTemplateId;
  storedDealType: DealType;
  label: string;
  description: string;
  fields: OfferTemplateField[];
}

interface OfferPanelProps {
  session: VinssWalletSession | null;
  channelKey: Uint8Array | null;
  messageTarget: string;
  participants: RoomParticipant[];
  counterSource: ConversationEntry | null;
  busy: boolean;
  agentDraft?: Extract<
    AgentProposal,
    {
      type:
        | "draft_offer"
        | "draft_counter_offer";
    }
  > | null;
  onCreate: (
    peerAddress: string,
    terms: OfferTermsInput,
  ) => Promise<boolean>;
  onCounter: (
    source: ConversationEntry,
    terms: OfferTermsInput,
  ) => Promise<boolean>;
  onCancelCounter: () => void;
  onSubmitted: () => void;
}

const OFFER_TEMPLATES: OfferTemplateDefinition[] = [
  {
    id: "freelance",
    storedDealType: "freelance",
    label: "Freelance",
    description:
      "Work agreement with deliverables, deadline, revisions and acceptance terms.",
    fields: [
      {
        id: "freelance_project",
        label: "Project or service",
        type: "text",
        placeholder:
          "e.g. Build a responsive landing page",
      },
      {
        id: "freelance_payment_amount",
        label: "Payment amount",
        type: "number",
        placeholder: "500",
      },
      {
        id: "freelance_payment_asset",
        label: "Payment token",
        type: "payment_asset",
      },
      {
        id: "freelance_deadline",
        label: "Delivery deadline",
        type: "text",
        optional: true,
        placeholder:
          "e.g. 2026-08-30 or 7 days",
      },
      {
        id: "freelance_deliverables",
        label: "Deliverables",
        type: "textarea",
        optional: true,
        placeholder:
          "e.g. Responsive website, source code and production build",
      },
      {
        id: "freelance_acceptance_criteria",
        advanced: true,
        label: "Acceptance criteria",
        type: "textarea",
        optional: true,
        placeholder:
          "e.g. Required pages work on mobile and desktop",
      },
      {
        id: "freelance_revision_limit",
        advanced: true,
        label: "Revision limit",
        type: "text",
        optional: true,
        placeholder: "e.g. 2 revisions",
      },
      {
        id: "freelance_work_stages",
        advanced: true,
        label: "Work stages",
        type: "text",
        optional: true,
        placeholder:
          "e.g. Design → Build → Handover",
      },
    ],
  },
  {
    id: "token_trade",
    // The encrypted payload schema still uses the existing value until a later data migration.
    storedDealType: "otc",
    label: "Token Trade",
    description:
      "Private crypto-for-fiat agreement with bank or other off-chain payment terms.",
    fields: [
      {
        id: "token_trade_direction",
        label: "Your side",
        type: "choice",
        choices: [
          {
            value: "sell_crypto",
            label: "Sell crypto",
          },
          {
            value: "buy_crypto",
            label: "Buy crypto",
          },
        ],
      },
      {
        id: "token_trade_crypto_amount",
        label: "Crypto amount",
        type: "number",
        placeholder: "1000",
      },
      {
        id: "token_trade_crypto_asset",
        label: "Crypto token",
        type: "payment_asset",
      },
      {
        id: "token_trade_fiat_amount",
        label: "Fiat amount",
        type: "number",
        placeholder: "450000",
      },
      {
        id: "token_trade_fiat_currency",
        label: "Fiat currency",
        type: "text",
        placeholder: "IDR",
      },
      {
        id: "token_trade_payment_method",
        label: "Fiat payment method",
        type: "text",
        optional: true,
        placeholder:
          "e.g. Bank transfer",
      },
      {
        id: "token_trade_payment_deadline",
        advanced: true,
        label: "Payment deadline",
        type: "text",
        optional: true,
        placeholder:
          "e.g. Within 30 minutes",
      },
    ],
  },
  {
    id: "physical_goods",
    storedDealType: "goods",
    label: "Physical Goods",
    description:
      "Item purchase with quantity, delivery and inspection terms.",
    fields: [
      {
        id: "physical_goods_item",
        label: "Item",
        type: "text",
        placeholder: "e.g. Used laptop",
      },
      {
        id: "physical_goods_quantity",
        label: "Quantity",
        type: "number",
        placeholder: "1",
      },
      {
        id: "physical_goods_total_price",
        label: "Total price",
        type: "number",
        placeholder: "700",
      },
      {
        id: "physical_goods_payment_asset",
        label: "Payment token",
        type: "payment_asset",
      },
      {
        id: "physical_goods_delivery_method",
        label: "Delivery method",
        type: "text",
        optional: true,
        placeholder:
          "e.g. Courier with tracking",
      },
      {
        id: "physical_goods_delivery_deadline",
        advanced: true,
        label: "Delivery deadline",
        type: "text",
        optional: true,
        placeholder: "e.g. 2026-08-28",
      },
      {
        id: "physical_goods_inspection_window",
        advanced: true,
        label: "Inspection window",
        type: "text",
        optional: true,
        placeholder:
          "e.g. 24 hours after delivery",
      },
    ],
  },
  {
    id: "digital_goods",
    storedDealType: "digital_goods",
    label: "Digital Goods",
    description:
      "Files, software, licenses or digital access with delivery rights.",
    fields: [
      {
        id: "digital_goods_item",
        label: "Digital item",
        type: "text",
        placeholder:
          "e.g. Source code license",
      },
      {
        id: "digital_goods_price",
        label: "Price",
        type: "number",
        placeholder: "250",
      },
      {
        id: "digital_goods_payment_asset",
        label: "Payment token",
        type: "payment_asset",
      },
      {
        id: "digital_goods_license_rights",
        advanced: true,
        label: "License or usage rights",
        type: "textarea",
        optional: true,
        placeholder:
          "e.g. Commercial use, one project, no resale",
      },
      {
        id: "digital_goods_delivery_method",
        label: "Delivery method",
        type: "text",
        optional: true,
        placeholder:
          "e.g. Encrypted download link",
      },
      {
        id: "digital_goods_acceptance_window",
        advanced: true,
        label: "Acceptance window",
        type: "text",
        optional: true,
        placeholder:
          "e.g. 24 hours after delivery",
      },
    ],
  },
  {
    id: "bounty",
    storedDealType: "bounty",
    label: "Bounty",
    description:
      "Reward agreement for a clearly defined task, result or contribution.",
    fields: [
      {
        id: "bounty_task",
        label: "Task or result",
        type: "text",
        placeholder:
          "e.g. Fix the mobile wallet reconnect bug",
      },
      {
        id: "bounty_reward_amount",
        label: "Reward amount",
        type: "number",
        placeholder: "200",
      },
      {
        id: "bounty_reward_asset",
        label: "Reward token",
        type: "payment_asset",
      },
      {
        id: "bounty_deadline",
        label: "Deadline",
        type: "text",
        optional: true,
        placeholder: "e.g. 2026-08-25",
      },
      {
        id: "bounty_success_criteria",
        label: "Success criteria",
        type: "textarea",
        optional: true,
        placeholder:
          "e.g. Reconnect works after wallet background return and tests pass",
      },
      {
        id: "bounty_submission_method",
        advanced: true,
        label: "Submission method",
        type: "text",
        optional: true,
        placeholder:
          "e.g. GitHub pull request",
      },
    ],
  },
  {
    id: "nft_deal",
    storedDealType: "nft",
    label: "NFT Deal",
    description:
      "Private negotiated NFT purchase with price and transfer terms.",
    fields: [
      {
        id: "nft_deal_collection",
        label: "Collection or contract",
        type: "text",
        placeholder:
          "e.g. Collection name or Starknet contract",
      },
      {
        id: "nft_deal_token_id",
        label: "Token ID",
        type: "text",
        placeholder: "e.g. 482",
      },
      {
        id: "nft_deal_price",
        label: "Price",
        type: "number",
        placeholder: "3500",
      },
      {
        id: "nft_deal_payment_asset",
        label: "Payment token",
        type: "payment_asset",
      },
      {
        id: "nft_deal_transfer_deadline",
        advanced: true,
        label: "Transfer deadline",
        type: "text",
        optional: true,
        placeholder:
          "e.g. Within 1 hour after funding",
      },
      {
        id: "nft_deal_transfer_condition",
        advanced: true,
        label: "Transfer condition",
        type: "textarea",
        optional: true,
        placeholder:
          "e.g. Exact token must be transferred to the buyer wallet",
      },
    ],
  },
  {
    id: "custom_deal",
    storedDealType: "other",
    label: "Custom Deal",
    description:
      "Flexible agreement for a deal that does not fit another template.",
    fields: [
      {
        id: "custom_deal_title",
        label: "Deal title",
        type: "text",
        placeholder:
          "e.g. Private equipment rental",
      },
      {
        id: "custom_deal_value",
        label: "Deal value",
        type: "number",
        placeholder: "500",
      },
      {
        id: "custom_deal_value_asset",
        label: "Value token",
        type: "payment_asset",
      },
      {
        id: "custom_deal_terms",
        label: "Terms",
        type: "textarea",
        optional: true,
        placeholder:
          "Describe what each party agrees to do",
      },
      {
        id: "custom_deal_completion_condition",
        advanced: true,
        label: "Completion condition",
        type: "textarea",
        optional: true,
        placeholder:
          "Describe what must happen before the deal is complete",
      },
      {
        id: "custom_deal_deadline",
        advanced: true,
        label: "Deadline",
        type: "text",
        optional: true,
        placeholder: "e.g. 2026-09-01",
      },
    ],
  },
];

const INITIAL_TEMPLATE_VALUES: Record<
  string,
  string
> = {
  token_trade_direction:
    "sell_crypto",
  token_trade_crypto_asset: "STRK",
  freelance_payment_asset: "STRK",
  physical_goods_quantity: "1",
  physical_goods_payment_asset: "STRK",
  digital_goods_payment_asset: "STRK",
  bounty_reward_asset: "STRK",
  nft_deal_payment_asset: "STRK",
  custom_deal_value_asset: "STRK",
};

function shortAddress(
  address: string,
): string {
  if (address.length <= 14) {
    return address;
  }

  return `${address.slice(
    0,
    7,
  )}…${address.slice(-5)}`;
}

function templateIdFromStoredDealType(
  dealType: string | undefined,
): OfferTemplateId {
  switch (dealType) {
    case "freelance":
      return "freelance";
    case "otc":
      return "token_trade";
    case "goods":
      return "physical_goods";
    case "digital_goods":
      return "digital_goods";
    case "bounty":
      return "bounty";
    case "nft":
      return "nft_deal";
    case "other":
      return "custom_deal";
    default:
      return "freelance";
  }
}

function isPositiveNumber(
  value: string,
): boolean {
  const numberValue = Number(value);

  return (
    Number.isFinite(numberValue) &&
    numberValue > 0
  );
}

export function OfferPanel({
  session,
  channelKey,
  messageTarget,
  participants,
  counterSource,
  busy,
  agentDraft,
  onCreate,
  onCounter,
  onCancelCounter,
  onSubmitted,
}: OfferPanelProps) {
  const [
    selectedTemplateId,
    setSelectedTemplateId,
  ] =
    useState<OfferTemplateId>(
      "freelance",
    );

  const [
    templateValues,
    setTemplateValues,
  ] =
    useState<
      Record<string, string>
    >(INITIAL_TEMPLATE_VALUES);

  const [
    choosingTemplate,
    setChoosingTemplate,
  ] = useState(false);

  const [
    reviewing,
    setReviewing,
  ] = useState(false);

  const [
    showMoreTerms,
    setShowMoreTerms,
  ] = useState(false);

  const [
    helpTopic,
    setHelpTopic,
  ] =
    useState<OfferHelpTopic | null>(
      null,
    );

  const counterAction =
    counterSource?.offerAction;

  const selectedParticipant =
    useMemo(
      () =>
        messageTarget === "chat" ||
        messageTarget === "groups" ||
        messageTarget.startsWith(
          "group:",
        )
          ? null
          : participants.find(
              (participant) =>
                participant.address.toLowerCase() ===
                messageTarget.toLowerCase(),
            ) ?? null,
      [
        messageTarget,
        participants,
      ],
    );

  const selectedTemplate =
    OFFER_TEMPLATES.find(
      (template) =>
        template.id ===
        selectedTemplateId,
    ) ?? OFFER_TEMPLATES[0]!;

  const targetAddress =
    counterAction?.senderAddress ??
    selectedParticipant?.address ??
    null;

  function setTemplateValue(
    fieldId: string,
    value: string,
  ) {
    setTemplateValues(
      (previous) => ({
        ...previous,
        [fieldId]: value,
      }),
    );
  }

  function valueOf(
    fieldId: string,
  ): string {
    return (
      templateValues[fieldId] ??
      ""
    );
  }

  function prefillGenericOffer(
    templateId: OfferTemplateId,
    asset: string,
    amount: string,
    paymentTerms: string,
    conditions?: string,
  ) {
    const split = (
      value?: string,
    ) =>
      value
        ?.split(/\s*·\s*/)
        .map((part) =>
          part.trim(),
        )
        .filter(Boolean) ?? [];

    const terms =
      split(paymentTerms);

    const conditionParts =
      split(conditions);

    const prefixed = (
      parts: string[],
      label: string,
    ): string => {
      const prefix =
        `${label}:`;

      const part =
        parts.find((candidate) =>
          candidate
            .toLowerCase()
            .startsWith(
              prefix.toLowerCase(),
            ),
        );

      return part
        ? part
            .slice(
              prefix.length,
            )
            .trim()
        : "";
    };

    const plain = (
      parts: string[],
      labels: string[],
    ): string => {
      return (
        parts.find(
          (part) =>
            !labels.some(
              (label) => {
                const prefix =
                  `${label}:`;

                return part
                  .toLowerCase()
                  .startsWith(
                    prefix.toLowerCase(),
                  );
              },
            ),
        ) ?? ""
      );
    };

    const loose = (
      value: string,
    ) =>
      value
        .replace(
          /^[A-Za-z][A-Za-z ]{1,30}:\s*/,
          "",
        )
        .trim();

    if (
      templateId ===
      "freelance"
    ) {
      const extra =
        plain(
          conditionParts,
          [
            "Deliverables",
            "Acceptance",
            "Revisions",
            "Work stages",
          ],
        );

      setTemplateValues(
        (previous) => ({
          ...previous,

          freelance_project:
            prefixed(
              terms,
              "Project",
            ) ||
            plain(
              terms,
              ["Deadline"],
            ) ||
            paymentTerms,

          freelance_payment_amount:
            amount,

          freelance_payment_asset:
            asset,

          freelance_deadline:
            prefixed(
              terms,
              "Deadline",
            ),

          freelance_deliverables:
            prefixed(
              conditionParts,
              "Deliverables",
            ),

          freelance_acceptance_criteria:
            prefixed(
              conditionParts,
              "Acceptance",
            ) ||
            loose(extra),

          freelance_revision_limit:
            prefixed(
              conditionParts,
              "Revisions",
            ),

          freelance_work_stages:
            prefixed(
              conditionParts,
              "Work stages",
            ),
        }),
      );

      return;
    }

    if (
      templateId ===
      "token_trade"
    ) {
      const trade =
        terms[0] ?? "";

      const tradeMatch =
        trade.match(
          /^(Buy|Sell)\s+(.+?)\s+for\s+(.+?)\s+([A-Za-z]{2,10})$/i,
        );

      setTemplateValues(
        (previous) => ({
          ...previous,

          token_trade_direction:
            tradeMatch?.[1]
              ?.toLowerCase() ===
            "buy"
              ? "buy_crypto"
              : "sell_crypto",

          token_trade_crypto_amount:
            amount,

          token_trade_crypto_asset:
            asset,

          token_trade_fiat_amount:
            tradeMatch?.[3] ??
            "",

          token_trade_fiat_currency:
            tradeMatch?.[4] ??
            "",

          token_trade_payment_method:
            prefixed(
              terms,
              "Payment",
            ),

          token_trade_payment_deadline:
            prefixed(
              terms,
              "Deadline",
            ),
        }),
      );

      return;
    }

    if (
      templateId ===
      "physical_goods"
    ) {
      let itemLine =
        plain(
          terms,
          [
            "Delivery",
            "Due",
          ],
        );

      let quantity = "1";
      let item = itemLine;

      const quantityMatch =
        itemLine.match(
          /^(.+?)\s*×\s*(.+)$/,
        );

      if (quantityMatch) {
        quantity =
          quantityMatch[1]
            ?.trim() || "1";

        item =
          quantityMatch[2]
            ?.trim() || itemLine;

        // Repair old:
        // 1 × 1 × Item
        const repeated =
          item.match(
            /^(.+?)\s*×\s*(.+)$/,
          );

        if (
          repeated &&
          repeated[1]
            ?.trim() ===
            quantity
        ) {
          item =
            repeated[2]
              ?.trim() ||
            item;
        }
      }

      const inspection =
        prefixed(
          conditionParts,
          "Inspection window",
        ) ||
        loose(
          conditions ?? "",
        );

      setTemplateValues(
        (previous) => ({
          ...previous,

          physical_goods_item:
            item,

          physical_goods_quantity:
            quantity,

          physical_goods_total_price:
            amount,

          physical_goods_payment_asset:
            asset,

          physical_goods_delivery_method:
            prefixed(
              terms,
              "Delivery",
            ),

          physical_goods_delivery_deadline:
            prefixed(
              terms,
              "Due",
            ),

          physical_goods_inspection_window:
            inspection,
        }),
      );

      return;
    }

    if (
      templateId ===
      "digital_goods"
    ) {
      setTemplateValues(
        (previous) => ({
          ...previous,

          digital_goods_item:
            plain(
              terms,
              ["Delivery"],
            ) ||
            paymentTerms,

          digital_goods_price:
            amount,

          digital_goods_payment_asset:
            asset,

          digital_goods_delivery_method:
            prefixed(
              terms,
              "Delivery",
            ),

          digital_goods_license_rights:
            prefixed(
              conditionParts,
              "Rights",
            ),

          digital_goods_acceptance_window:
            prefixed(
              conditionParts,
              "Acceptance",
            ),
        }),
      );

      return;
    }

    if (
      templateId ===
      "bounty"
    ) {
      setTemplateValues(
        (previous) => ({
          ...previous,

          bounty_task:
            prefixed(
              terms,
              "Task",
            ) ||
            plain(
              terms,
              ["Deadline"],
            ) ||
            paymentTerms,

          bounty_reward_amount:
            amount,

          bounty_reward_asset:
            asset,

          bounty_deadline:
            prefixed(
              terms,
              "Deadline",
            ),

          bounty_success_criteria:
            prefixed(
              conditionParts,
              "Success",
            ) ||
            loose(
              conditions ?? "",
            ),

          bounty_submission_method:
            prefixed(
              conditionParts,
              "Submit",
            ),
        }),
      );

      return;
    }

    if (
      templateId ===
      "nft_deal"
    ) {
      const nftLine =
        plain(
          terms,
          ["Transfer"],
        );

      const nftMatch =
        nftLine.match(
          /^(.*)\s+#([^#]+)$/,
        );

      setTemplateValues(
        (previous) => ({
          ...previous,

          nft_deal_collection:
            nftMatch?.[1]
              ?.trim() ||
            nftLine ||
            paymentTerms,

          nft_deal_token_id:
            nftMatch?.[2]
              ?.trim() ??
            "",

          nft_deal_price:
            amount,

          nft_deal_payment_asset:
            asset,

          nft_deal_transfer_deadline:
            prefixed(
              terms,
              "Transfer",
            ),

          nft_deal_transfer_condition:
            loose(
              conditions ?? "",
            ),
        }),
      );

      return;
    }

    const dealTitle =
      prefixed(
        terms,
        "Deal",
      ) ||
      terms[0] ||
      paymentTerms;

    const customTerms =
      terms
        .filter(
          (part) =>
            !part
              .toLowerCase()
              .startsWith(
                "deal:",
              ) &&
            !part
              .toLowerCase()
              .startsWith(
                "deadline:",
              ),
        )
        .join(" · ");

    setTemplateValues(
      (previous) => ({
        ...previous,

        custom_deal_title:
          dealTitle,

        custom_deal_value:
          amount,

        custom_deal_value_asset:
          asset,

        custom_deal_terms:
          customTerms,

        custom_deal_completion_condition:
          loose(
            conditions ?? "",
          ),

        custom_deal_deadline:
          prefixed(
            terms,
            "Deadline",
          ),
      }),
    );
  }

  useEffect(() => {
    if (counterAction) {
      const templateId =
        templateIdFromStoredDealType(
          counterAction.dealType,
        );

      setSelectedTemplateId(
        templateId,
      );
      prefillGenericOffer(
        templateId,
        counterAction.asset,
        counterAction.amount,
        counterAction.paymentTerms,
        counterAction.conditions,
      );
      setReviewing(false);
      setChoosingTemplate(false);
      setShowMoreTerms(false);
      return;
    }

    if (agentDraft) {
      prefillGenericOffer(
        selectedTemplateId,
        agentDraft.payload.asset,
        agentDraft.payload.amount,
        agentDraft.payload
          .paymentTerms,
      );
      setReviewing(false);
      setChoosingTemplate(false);
      setShowMoreTerms(false);
    }
  }, [
    counterAction,
    agentDraft,
  ]);

  useEffect(() => {
    setReviewing(false);
    setChoosingTemplate(false);
    setShowMoreTerms(false);
  }, [messageTarget]);

  function currentTemplateIsValid(): boolean {
    return selectedTemplate.fields.every(
      (field) => {
        if (field.optional) {
          return true;
        }

        const value =
          valueOf(field.id).trim();

        if (!value) {
          return false;
        }

        if (
          field.type === "number"
        ) {
          return isPositiveNumber(
            value,
          );
        }

        return true;
      },
    );
  }

  function buildOfferTerms(): OfferTermsInput {
    if (
      selectedTemplateId ===
      "freelance"
    ) {
      const project =
        valueOf(
          "freelance_project",
        ).trim();
      const paymentAmount =
        valueOf(
          "freelance_payment_amount",
        ).trim();
      const paymentAsset =
        valueOf(
          "freelance_payment_asset",
        ).trim();
      const deadline =
        valueOf(
          "freelance_deadline",
        ).trim();
      const deliverables =
        valueOf(
          "freelance_deliverables",
        ).trim();
      const acceptanceCriteria =
        valueOf(
          "freelance_acceptance_criteria",
        ).trim();
      const revisionLimit =
        valueOf(
          "freelance_revision_limit",
        ).trim();
      const workStages =
        valueOf(
          "freelance_work_stages",
        ).trim();

      return {
        dealType:
          selectedTemplate.storedDealType,
        asset: paymentAsset,
        amount: paymentAmount,
        paymentTerms: [
          `Project: ${project}`,
          deadline &&
            `Deadline: ${deadline}`,
        ]
          .filter(Boolean)
          .join(" · "),
        conditions: [
          deliverables &&
            `Deliverables: ${deliverables}`,
          acceptanceCriteria &&
            `Acceptance: ${acceptanceCriteria}`,
          revisionLimit &&
            `Revisions: ${revisionLimit}`,
          workStages &&
            `Work stages: ${workStages}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (
      selectedTemplateId ===
      "token_trade"
    ) {
      const direction =
        valueOf(
          "token_trade_direction",
        );
      const cryptoAmount =
        valueOf(
          "token_trade_crypto_amount",
        ).trim();
      const cryptoAsset =
        valueOf(
          "token_trade_crypto_asset",
        ).trim();
      const fiatAmount =
        valueOf(
          "token_trade_fiat_amount",
        ).trim();
      const fiatCurrency =
        valueOf(
          "token_trade_fiat_currency",
        ).trim();
      const paymentMethod =
        valueOf(
          "token_trade_payment_method",
        ).trim();
      const paymentDeadline =
        valueOf(
          "token_trade_payment_deadline",
        ).trim();

      return {
        dealType:
          selectedTemplate.storedDealType,
        asset: cryptoAsset,
        amount: cryptoAmount,
        paymentTerms: [
          `${
            direction ===
            "buy_crypto"
              ? "Buy"
              : "Sell"
          } ${cryptoAmount} ${cryptoAsset} for ${fiatAmount} ${fiatCurrency}`,
          paymentMethod &&
            `Payment: ${paymentMethod}`,
          paymentDeadline &&
            `Deadline: ${paymentDeadline}`,
        ]
          .filter(Boolean)
          .join(" · "),
        conditions:
          "Off-chain fiat payment is confirmed by the parties before crypto settlement.",
      };
    }

    if (
      selectedTemplateId ===
      "physical_goods"
    ) {
      const item =
        valueOf(
          "physical_goods_item",
        ).trim();
      const quantity =
        valueOf(
          "physical_goods_quantity",
        ).trim();
      const totalPrice =
        valueOf(
          "physical_goods_total_price",
        ).trim();
      const paymentAsset =
        valueOf(
          "physical_goods_payment_asset",
        ).trim();
      const deliveryMethod =
        valueOf(
          "physical_goods_delivery_method",
        ).trim();
      const deliveryDeadline =
        valueOf(
          "physical_goods_delivery_deadline",
        ).trim();
      const inspectionWindow =
        valueOf(
          "physical_goods_inspection_window",
        ).trim();

      return {
        dealType:
          selectedTemplate.storedDealType,
        asset: paymentAsset,
        amount: totalPrice,
        paymentTerms: [
          `${quantity} × ${item}`,
          deliveryMethod &&
            `Delivery: ${deliveryMethod}`,
          deliveryDeadline &&
            `Due: ${deliveryDeadline}`,
        ]
          .filter(Boolean)
          .join(" · "),
        conditions:
          inspectionWindow
            ? `Inspection window: ${inspectionWindow}`
            : undefined,
      };
    }

    if (
      selectedTemplateId ===
      "digital_goods"
    ) {
      const item =
        valueOf(
          "digital_goods_item",
        ).trim();
      const price =
        valueOf(
          "digital_goods_price",
        ).trim();
      const paymentAsset =
        valueOf(
          "digital_goods_payment_asset",
        ).trim();
      const licenseRights =
        valueOf(
          "digital_goods_license_rights",
        ).trim();
      const deliveryMethod =
        valueOf(
          "digital_goods_delivery_method",
        ).trim();
      const acceptanceWindow =
        valueOf(
          "digital_goods_acceptance_window",
        ).trim();

      return {
        dealType:
          selectedTemplate.storedDealType,
        asset: paymentAsset,
        amount: price,
        paymentTerms: [
          item,
          deliveryMethod &&
            `Delivery: ${deliveryMethod}`,
        ]
          .filter(Boolean)
          .join(" · "),
        conditions: [
          licenseRights &&
            `Rights: ${licenseRights}`,
          acceptanceWindow &&
            `Acceptance: ${acceptanceWindow}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (
      selectedTemplateId ===
      "bounty"
    ) {
      const task =
        valueOf(
          "bounty_task",
        ).trim();
      const rewardAmount =
        valueOf(
          "bounty_reward_amount",
        ).trim();
      const rewardAsset =
        valueOf(
          "bounty_reward_asset",
        ).trim();
      const deadline =
        valueOf(
          "bounty_deadline",
        ).trim();
      const successCriteria =
        valueOf(
          "bounty_success_criteria",
        ).trim();
      const submissionMethod =
        valueOf(
          "bounty_submission_method",
        ).trim();

      return {
        dealType:
          selectedTemplate.storedDealType,
        asset: rewardAsset,
        amount: rewardAmount,
        paymentTerms: [
          `Task: ${task}`,
          deadline &&
            `Deadline: ${deadline}`,
        ]
          .filter(Boolean)
          .join(" · "),
        conditions: [
          successCriteria &&
            `Success: ${successCriteria}`,
          submissionMethod &&
            `Submit: ${submissionMethod}`,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (
      selectedTemplateId ===
      "nft_deal"
    ) {
      const collection =
        valueOf(
          "nft_deal_collection",
        ).trim();
      const tokenId =
        valueOf(
          "nft_deal_token_id",
        ).trim();
      const price =
        valueOf(
          "nft_deal_price",
        ).trim();
      const paymentAsset =
        valueOf(
          "nft_deal_payment_asset",
        ).trim();
      const transferDeadline =
        valueOf(
          "nft_deal_transfer_deadline",
        ).trim();
      const transferCondition =
        valueOf(
          "nft_deal_transfer_condition",
        ).trim();

      return {
        dealType:
          selectedTemplate.storedDealType,
        asset: paymentAsset,
        amount: price,
        paymentTerms: [
          `${collection} #${tokenId}`,
          transferDeadline &&
            `Transfer: ${transferDeadline}`,
        ]
          .filter(Boolean)
          .join(" · "),
        conditions:
          transferCondition,
      };
    }

    const title =
      valueOf(
        "custom_deal_title",
      ).trim();
    const value =
      valueOf(
        "custom_deal_value",
      ).trim();
    const valueAsset =
      valueOf(
        "custom_deal_value_asset",
      ).trim();
    const terms =
      valueOf(
        "custom_deal_terms",
      ).trim();
    const completionCondition =
      valueOf(
        "custom_deal_completion_condition",
      ).trim();
    const deadline =
      valueOf(
        "custom_deal_deadline",
      ).trim();

    return {
      dealType:
        selectedTemplate.storedDealType,
      asset: valueAsset,
      amount: value,
      paymentTerms: [
        `Deal: ${title}`,
        terms,
        deadline &&
          `Deadline: ${deadline}`,
      ]
        .filter(Boolean)
        .join(" · "),
      conditions:
        completionCondition,
    };
  }

  function reviewValue(
    field: OfferTemplateField,
  ): string {
    const value =
      valueOf(field.id);

    if (
      field.type !== "choice"
    ) {
      return value;
    }

    return (
      field.choices?.find(
        (choice) =>
          choice.value === value,
      )?.label ?? value
    );
  }

  const coreTemplateFields =
    selectedTemplate.fields.filter(
      (field) => !field.advanced,
    );

  const additionalTemplateFields =
    selectedTemplate.fields.filter(
      (field) => field.advanced,
    );

  const canPrepare =
    Boolean(session) &&
    Boolean(channelKey) &&
    Boolean(targetAddress) &&
    !busy &&
    currentTemplateIsValid();

  async function handleSubmit() {
    if (
      !targetAddress ||
      !canPrepare
    ) {
      return;
    }

    const terms =
      buildOfferTerms();

    const ok =
      counterSource &&
      counterAction
        ? await onCounter(
            counterSource,
            terms,
          )
        : await onCreate(
            targetAddress,
            terms,
          );

    if (!ok) {
      return;
    }

    setReviewing(false);
    onSubmitted();
  }

  function renderField(
    field: OfferTemplateField,
  ) {
    const value =
      valueOf(field.id);

    const fieldIndex =
      selectedTemplate.fields.findIndex(
        (candidate) =>
          candidate.id === field.id,
      );

    const previousField =
      fieldIndex > 0
        ? selectedTemplate.fields[
            fieldIndex - 1
          ]
        : null;

    const nextField =
      fieldIndex >= 0
        ? selectedTemplate.fields[
            fieldIndex + 1
          ] ?? null
        : null;

    const pairedAssetField =
      field.type === "number" &&
      nextField?.type === "payment_asset"
        ? nextField
        : null;

    if (
      field.type === "payment_asset" &&
      previousField?.type === "number"
    ) {
      return null;
    }

    if (
      field.type === "payment_asset"
    ) {
      return (
        <div key={field.id}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
              {field.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {["STRK", "USDC"].map(
              (asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() =>
                    setTemplateValue(
                      field.id,
                      asset,
                    )
                  }
                  disabled={busy}
                  className={
                    value === asset
                      ? "border border-signal/40 bg-signal/[0.045] px-3 py-2.5 text-center font-display text-[9px] uppercase tracking-widest text-signal/80"
                      : "border border-wire px-3 py-2.5 text-center font-display text-[9px] uppercase tracking-widest text-paper/40 transition hover:border-signal/25 disabled:opacity-40"
                  }
                >
                  {asset}
                </button>
              ),
            )}
          </div>
        </div>
      );
    }

    if (
      field.type === "choice"
    ) {
      return (
        <div
          key={field.id}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-[10px] uppercase tracking-widest text-paper/40">
              {field.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {field.choices?.map(
              (choice) => (
                <button
                  key={
                    choice.value
                  }
                  type="button"
                  onClick={() =>
                    setTemplateValue(
                      field.id,
                      choice.value,
                    )
                  }
                  disabled={busy}
                  className={
                    value ===
                    choice.value
                      ? "border border-signal/40 bg-signal/[0.045] px-3 py-3 text-left text-xs text-signal/80"
                      : "border border-wire px-3 py-3 text-left text-xs text-paper/45 transition hover:border-signal/25 disabled:opacity-40"
                  }
                >
                  {choice.label}
                </button>
              ),
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={field.id}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label
            htmlFor={field.id}
            className="font-display text-[10px] uppercase tracking-widest text-paper/40"
          >
            {field.label}
          </label>

          {field.optional && (
            <span className="text-[10px] text-paper/25">
              Optional
            </span>
          )}
        </div>

        {field.type ===
        "textarea" ? (
          <textarea
            id={field.id}
            value={value}
            onChange={(event) =>
              setTemplateValue(
                field.id,
                event.target.value,
              )
            }
            placeholder={
              field.placeholder
            }
            disabled={busy}
            className="min-h-24 w-full resize-y border border-wire bg-transparent px-3 py-3 text-sm leading-relaxed text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:opacity-40"
          />
        ) : pairedAssetField ? (
          <div className="relative flex w-full items-stretch border border-wire bg-transparent focus-within:border-signal">
            <input
              id={field.id}
              value={value}
              onChange={(event) =>
                setTemplateValue(
                  field.id,
                  event.target.value,
                )
              }
              inputMode="decimal"
              placeholder={
                field.placeholder
              }
              disabled={busy}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 disabled:opacity-40"
            />

            <details className="group relative shrink-0 border-l border-wire">
              <summary className="flex h-full min-w-[86px] cursor-pointer list-none items-center justify-center gap-2 px-3 font-display text-[9px] uppercase tracking-widest text-signal/75 [&::-webkit-details-marker]:hidden">
                {valueOf(
                  pairedAssetField.id,
                ) || "Token"}
                <span
                  aria-hidden="true"
                  className="text-[8px] text-paper/30 transition group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>

              <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[110px] overflow-hidden rounded-xl border border-wire bg-vault shadow-2xl">
                {["STRK", "USDC"].map(
                  (asset) => {
                    const selected =
                      valueOf(
                        pairedAssetField.id,
                      ) === asset;

                    return (
                      <button
                        key={asset}
                        type="button"
                        onClick={(event) => {
                          setTemplateValue(
                            pairedAssetField.id,
                            asset,
                          );

                          const details =
                            event.currentTarget.closest(
                              "details",
                            );

                          if (details) {
                            details.open = false;
                          }
                        }}
                        disabled={busy}
                        className={
                          selected
                            ? "flex w-full items-center justify-between px-3 py-2.5 text-left font-display text-[9px] uppercase tracking-widest text-signal"
                            : "flex w-full items-center justify-between px-3 py-2.5 text-left font-display text-[9px] uppercase tracking-widest text-paper/55 transition hover:bg-paper/[0.04] hover:text-paper"
                        }
                      >
                        <span>
                          {asset}
                        </span>

                        {selected && (
                          <span
                            aria-hidden="true"
                            className="text-signal/70"
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </details>
          </div>
        ) : (
          <input
            id={field.id}
            value={value}
            onChange={(event) =>
              setTemplateValue(
                field.id,
                event.target.value,
              )
            }
            inputMode={
              field.type ===
              "number"
                ? "decimal"
                : undefined
            }
            placeholder={
              field.placeholder
            }
            disabled={busy}
            autoComplete="off"
            className="w-full border border-wire bg-transparent px-3 py-3 text-sm text-paper outline-none placeholder:text-paper/25 focus:border-signal disabled:opacity-40"
          />
        )}

        {field.type ===
          "number" &&
          value.trim() &&
          !isPositiveNumber(
            value,
          ) && (
            <p className="mt-1.5 text-[10px] text-danger/70">
              Enter a value greater than zero.
            </p>
          )}
      </div>
    );
  }

  return (
    <section className="relative border border-wire bg-vault/40">
      <div className="border-b border-wire px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-sm text-paper">
                {counterSource
                  ? "Counter this offer"
                  : "Create an offer"}
              </h3>

              
            </div>

            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              {targetAddress
                ? `Private deal with ${shortAddress(
                    targetAddress,
                  )}`
                : "Open a private Chat and choose a participant before creating an offer."}
            </p>

          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-paper/30">
              {reviewing
                ? "Step 2 · Review"
                : "Step 1 · Terms"}
            </span>

            {!reviewing && (
              <button
                type="button"
                onClick={() =>
                  setHelpTopic(
                    (current) =>
                      current === "terms"
                        ? null
                        : "terms",
                  )
                }
                aria-label="How do I fill this Offer?"
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-wire/70 text-[7px] leading-none text-paper/35 transition hover:border-signal/40 hover:text-signal"
              >
                ?
              </button>
            )}
          </div>
        </div>
      </div>

      {!targetAddress ? (
        <div className="p-4">
          <div className="border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm text-paper/70">
              Select someone in Chat first.
            </p>

            <p className="mt-1 text-xs leading-relaxed text-paper/35">
              Offers are direct and never appear in a Group conversation.
            </p>
          </div>
        </div>
      ) : reviewing ? (
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-4 border border-wire bg-paper/[0.015] px-4 py-3">
            <div>
              <p className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/30">
                Template
              </p>

              <p className="mt-1 text-sm text-paper/70">
                {selectedTemplate.label}
              </p>
            </div>

            <div className="text-right">
              <p className="font-display text-[8px] uppercase tracking-[0.14em] text-paper/30">
                Counterparty
              </p>

              <p
                className="mt-1 font-mono text-xs text-paper/55"
                title={targetAddress}
              >
                {shortAddress(
                  targetAddress,
                )}
              </p>
            </div>
          </div>

          <div className="divide-y divide-wire/60 border border-wire bg-vault/45">
            {selectedTemplate.fields
              .filter(
                (field) =>
                  !field.optional ||
                  valueOf(
                    field.id,
                  ).trim(),
              )
              .map((field) => (
                <div
                  key={field.id}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <span className="font-display text-[8px] uppercase tracking-[0.13em] text-paper/30">
                    {field.label}
                  </span>

                  <span className="max-w-[66%] text-right text-xs leading-relaxed text-paper/65">
                    {reviewValue(
                      field,
                    ) ||
                      "Not specified"}
                  </span>
                </div>
              ))}
          </div>

          <div className="border border-wire bg-paper/[0.015] p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-[9px] uppercase tracking-widest text-paper/35">
                    Private Offer action fee
                  </p>

                  
                </div>

                <p className="mt-1 text-[10px] text-paper/30">
                  Wallet-backed private Offer action
                </p>
              </div>

              <span className="shrink-0 text-sm text-signal/75">
                1 STRK
              </span>
            </div>

          </div>

          <div className="border border-signal/20 bg-signal/[0.03] p-3">
            <p className="text-[10px] leading-relaxed text-paper/40">
              Deal terms and participant addresses are encrypted with the pairwise direct key. Creating this Offer does not fund escrow.
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-paper/55">
              {counterSource
                ? "This Counter does not change Escrow roles: the original Offer sender remains the Payer."
                : "If accepted, your wallet becomes the Escrow Payer and the recipient wallet becomes the Payee."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setReviewing(false)
              }
              disabled={busy}
              className="border border-wire px-4 py-3 font-display text-[10px] uppercase tracking-widest text-paper/45 transition hover:border-paper/30 hover:text-paper disabled:opacity-30"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() =>
                void handleSubmit()
              }
              disabled={
                !canPrepare
              }
              className="border border-signal px-4 py-3 font-display text-[10px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
            >
              {busy
                ? "Waiting for wallet…"
                : counterSource
                  ? "Send Counter"
                  : "Create Offer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="font-display text-[10px] uppercase tracking-widest text-paper/40">
                  Deal type
                </label>

                
              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                setChoosingTemplate(
                  (value) => !value,
                )
              }
              disabled={busy}
              aria-expanded={
                choosingTemplate
              }
              className="w-full rounded-xl border border-wire/80 bg-black/10 px-4 py-3 text-left transition hover:border-signal/35 disabled:opacity-40"
            >
              <div className="flex items-start justify-between gap-4 bg-transparent">
                <div>
                  <p className="text-sm text-paper/75">
                    {selectedTemplate.label}
                  </p>

                </div>

                <span className="mt-0.5 font-display text-[9px] uppercase tracking-widest text-signal/60">
                  {choosingTemplate
                    ? "Close"
                    : "Change"}
                </span>
              </div>
            </button>

            {choosingTemplate && (
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-wire/70 bg-black/10 p-2">
                {OFFER_TEMPLATES.map(
                  (template) => {
                    const selected =
                      template.id ===
                      selectedTemplateId;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(
                            template.id,
                          );
                          setReviewing(false);
                          setChoosingTemplate(
                            false,
                          );
                          setShowMoreTerms(
                            false,
                          );
                        }}
                        className={
                          selected
                            ? "flex min-h-14 items-center justify-between gap-2 rounded-lg border border-signal/45 bg-signal/[0.055] px-3 py-2.5 text-left"
                            : "flex min-h-14 items-center justify-between gap-2 rounded-lg border border-wire/60 bg-vault/10 px-3 py-2.5 text-left transition hover:border-signal/25 hover:bg-signal/[0.025]"
                        }
                      >
                        <span
                          className={
                            selected
                              ? "text-[11px] font-medium text-signal/85"
                              : "text-[11px] text-paper/60"
                          }
                        >
                          {template.label}
                        </span>

                        {selected && (
                          <span
                            className="shrink-0 text-[10px] text-signal/70"
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          <div className="border-t border-wire/70 pt-4">
            <div className="space-y-4">
              {coreTemplateFields.map(
                renderField,
              )}

              {additionalTemplateFields.length >
                0 && (
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setShowMoreTerms(
                        (value) => !value,
                      )
                    }
                    disabled={busy}
                    aria-expanded={
                      showMoreTerms
                    }
                    className="flex w-full items-center justify-between border border-wire/70 bg-paper/[0.012] px-3 py-3 text-left transition hover:border-signal/25 disabled:opacity-40"
                  >
                    <p className="font-display text-[9px] uppercase tracking-[0.13em] text-paper/45">
                      More terms
                    </p>

                    <span className="font-display text-[9px] uppercase tracking-widest text-signal/60">
                      {showMoreTerms
                        ? "Hide"
                        : "Add"}
                    </span>
                  </button>

                  {showMoreTerms && (
                    <div className="mt-4 space-y-4 border-l border-wire/70 pl-3">
                      {additionalTemplateFields.map(
                        renderField,
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedTemplateId ===
                "token_trade" && (
                <div className="border border-amber-400/15 bg-amber-400/[0.025] p-3">
                  <p className="text-[10px] leading-relaxed text-paper/35">
                    Off-chain fiat payment must be confirmed by the parties. VINSS cannot independently verify a bank transfer.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border border-wire bg-paper/[0.015] p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-[9px] uppercase tracking-widest text-paper/35">
                  Private Offer action fee
                </p>

              </div>

              <span className="shrink-0 text-sm text-signal/75">
                1 STRK
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setReviewing(true)
            }
            disabled={!canPrepare}
            className="flex w-full items-center justify-center gap-2 border border-signal px-4 py-3 font-display text-xs uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
          >
            {counterSource
              ? "Review Counter →"
              : "Review Offer →"}
          </button>

          {counterSource && (
            <button
              type="button"
              onClick={
                onCancelCounter
              }
              disabled={busy}
              className="w-full px-4 py-2 font-display text-[9px] uppercase tracking-widest text-paper/30 transition hover:text-paper/60 disabled:opacity-30"
            >
              Cancel counter
            </button>
          )}
        </div>
      )}

      {helpTopic && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setHelpTopic(null)}
            className="fixed inset-0 z-[80] bg-transparent"
          />

          <div
            role="dialog"
            aria-modal="false"
            className="fixed left-4 right-4 top-1/2 z-[90] mx-auto max-h-[70vh] max-w-md -translate-y-1/2 overflow-y-auto rounded-2xl border border-signal/20 bg-[#11161b]/95 p-4 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-4 bg-transparent">
              <div className="min-w-0 bg-transparent">
                <p className="font-display text-[8px] uppercase tracking-[0.16em] text-signal/65">
                  VINSS Guide
                </p>

                <h4 className="mt-1.5 text-[15px] font-medium text-paper/80">
                  {OFFER_HELP[helpTopic].title}
                </h4>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHelpTopic(null)
                }
                aria-label="Close explanation"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-wire/70 bg-transparent text-xs text-paper/40 transition hover:border-signal/35 hover:text-signal"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {OFFER_HELP[
                helpTopic
              ].paragraphs.map(
                (paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[11px] leading-relaxed text-paper/42"
                  >
                    {paragraph}
                  </p>
                ),
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
