import type { DealType } from "@/types/deal-room";

/*
 * Offer templates are domain configuration, not React state.
 * Keep the stored DealType values stable because they are part of the
 * encrypted Offer payload schema and older rooms must remain readable.
 */
export type OfferTemplateId =
  | "freelance"
  | "token_trade"
  | "physical_goods"
  | "digital_goods"
  | "bounty"
  | "nft_deal"
  | "custom_deal";


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

export interface OfferTemplateField {
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


export const OFFER_TEMPLATES: OfferTemplateDefinition[] = [
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

export const INITIAL_TEMPLATE_VALUES: Record<
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


/*
 * Translate persisted deal types back to the current UI template.
 * This compatibility boundary should change only with an explicit
 * encrypted-payload migration.
 */
export function templateIdFromStoredDealType(
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

export function isPositiveNumber(
  value: string,
): boolean {
  const numberValue = Number(value);

  return (
    Number.isFinite(numberValue) &&
    numberValue > 0
  );
}
