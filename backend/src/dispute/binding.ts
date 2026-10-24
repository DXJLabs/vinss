import type {
  TypedData,
} from "starknet";
import {
  RpcProvider,
  constants,
  num,
  verifyMessageInStarknet,
} from "starknet";

import type {
  AppConfig,
} from "../config.js";
import type {
  VerifiedRekberCustody,
} from "./chain.js";
import type {
  DisputeCase,
} from "./types.js";

const DOMAIN_TYPES = [
  { name: "name", type: "shortstring" },
  { name: "version", type: "shortstring" },
  { name: "chainId", type: "shortstring" },
  { name: "revision", type: "shortstring" },
];

interface RailBinding {
  transactionMode?: "shield" | "unshield";
  publicRailAddress?: string;
  publicRekberAddress?: string;
}

interface SetupBinding extends RailBinding {
  custodyCommitment: string;
  dealOfferLocator: string;
  dealTermsCommitment: string;
  payerAddress: string;
  payeeAddress: string;
  releaseAuthorizationCommitment: string;
  refundCommitment: string;
  payerConfirmationCommitment: string;
  payerDisputeCommitment: string;
  revisionChainHead: string;
  payerCertificateCommitment: string;
  fulfillmentDeadline: string;
  signature: string[];
}

interface AcceptanceBinding extends RailBinding {
  custodyCommitment: string;
  dealOfferLocator: string;
  dealTermsCommitment: string;
  payerAddress: string;
  payeeAddress: string;
  payeeClaimCommitment: string;
  payeeDisputeCommitment: string;
  payeeRefundConsentCommitment: string;
  fulfillmentChainHead: string;
  payeeCertificateCommitment: string;
  fulfillmentDeadline: string;
  signature: string[];
}

export interface DisputeRekberBinding {
  setup: SetupBinding;
  acceptance: AcceptanceBinding;
}

function asRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} is required.`);
  }

  return value as Record<string, unknown>;
}

function text(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function signature(
  value: unknown,
  label: string,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 16
  ) {
    throw new Error(
      `${label} signature is invalid.`,
    );
  }

  return value.map((item) => {
    const felt =
      text(
        item,
        `${label} signature felt`,
      );

    if (
      !/^0x[0-9a-fA-F]+$/.test(
        felt,
      )
    ) {
      throw new Error(
        `${label} signature contains an invalid felt.`,
      );
    }

    return num.toHex(felt);
  });
}

function parseRail(v: Record<string, unknown>): RailBinding {
  if (v.transactionMode === undefined || v.transactionMode === "shield") {
    if (v.publicRailAddress !== undefined || v.publicRekberAddress !== undefined) {
      throw new Error("Shield Rekber binding cannot contain public deployment fields.");
    }
    return v.transactionMode === "shield" ? { transactionMode: "shield" } : {};
  }
  if (v.transactionMode !== "unshield") throw new Error("Unsupported Rekber transaction mode.");
  const parseAddress = (value: unknown, label: string) => {
    const raw = text(value, label);
    if (!/^0x[0-9a-fA-F]+$/.test(raw) || BigInt(raw) <= 0n || BigInt(raw) >= 1n << 251n) {
      throw new Error(`${label} is not a valid Starknet address.`);
    }
    return num.toHex(raw);
  };
  return {
    transactionMode: "unshield",
    publicRailAddress: parseAddress(v.publicRailAddress, "public rail"),
    publicRekberAddress: parseAddress(v.publicRekberAddress, "public custody contract"),
  };
}

function assertMatchingRails(binding: DisputeRekberBinding): void {
  const setup = parseRail(binding.setup as unknown as Record<string, unknown>);
  const acceptance = parseRail(binding.acceptance as unknown as Record<string, unknown>);
  if ((setup.transactionMode ?? "shield") !== (acceptance.transactionMode ?? "shield") ||
      setup.publicRailAddress !== acceptance.publicRailAddress ||
      setup.publicRekberAddress !== acceptance.publicRekberAddress) {
    throw new Error("Rekber approvals use different transaction rails.");
  }
}

/** The configured Rekber is the actual custody source on this backend. */
export function assertDisputeBindingDeployment(config: AppConfig, binding: DisputeRekberBinding): void {
  assertMatchingRails(binding);
  const setup = binding.setup;
  if (setup.transactionMode === "unshield") {
    if (!config.contracts.publicRailAdapter) throw new Error("Public arbitration is not configured on this backend.");
    if (!sameFelt(setup.publicRailAddress!, config.contracts.publicRailAdapter) ||
        !sameFelt(setup.publicRekberAddress!, config.contracts.escrowRekber)) {
      throw new Error("Rekber binding does not match this public deployment.");
    }
  } else if (config.contracts.publicRailAdapter) {
    throw new Error("Shield arbitration cannot use a public backend custody contract.");
  }
}

function bindTypedRail(data: TypedData, binding: RailBinding): TypedData {
  if (binding.transactionMode === "unshield") {
    data.types[data.primaryType]!.push({ name: "Public Rail", type: "ContractAddress" }, { name: "Custody Contract", type: "ContractAddress" });
    (data.message as Record<string, unknown>)["Public Rail"] = num.toHex(binding.publicRailAddress!);
    (data.message as Record<string, unknown>)["Custody Contract"] = num.toHex(binding.publicRekberAddress!);
  }
  return data;
}

function parseSetup(
  value: unknown,
): SetupBinding {
  const v =
    asRecord(
      value,
      "Rekber setup binding",
    );

  return {
    ...parseRail(v),
    custodyCommitment:
      text(v.custodyCommitment, "setup custody"),
    dealOfferLocator:
      text(v.dealOfferLocator, "setup deal"),
    dealTermsCommitment:
      text(v.dealTermsCommitment, "setup private terms"),
    payerAddress:
      text(v.payerAddress, "setup payer"),
    payeeAddress:
      text(v.payeeAddress, "setup payee"),
    releaseAuthorizationCommitment:
      text(v.releaseAuthorizationCommitment, "setup release"),
    refundCommitment:
      text(v.refundCommitment, "setup refund"),
    payerConfirmationCommitment:
      text(v.payerConfirmationCommitment, "setup confirmation"),
    payerDisputeCommitment:
      text(v.payerDisputeCommitment, "setup dispute"),
    revisionChainHead:
      text(v.revisionChainHead, "setup revision chain"),
    payerCertificateCommitment:
      text(v.payerCertificateCommitment, "setup certificate"),
    fulfillmentDeadline:
      text(v.fulfillmentDeadline, "setup deadline"),
    signature:
      signature(v.signature, "setup"),
  };
}

function parseAcceptance(
  value: unknown,
): AcceptanceBinding {
  const v =
    asRecord(
      value,
      "Rekber acceptance binding",
    );

  return {
    ...parseRail(v),
    custodyCommitment:
      text(v.custodyCommitment, "acceptance custody"),
    dealOfferLocator:
      text(v.dealOfferLocator, "acceptance deal"),
    dealTermsCommitment:
      text(v.dealTermsCommitment, "acceptance private terms"),
    payerAddress:
      text(v.payerAddress, "acceptance payer"),
    payeeAddress:
      text(v.payeeAddress, "acceptance payee"),
    payeeClaimCommitment:
      text(v.payeeClaimCommitment, "acceptance claim"),
    payeeDisputeCommitment:
      text(v.payeeDisputeCommitment, "acceptance dispute"),
    payeeRefundConsentCommitment:
      text(v.payeeRefundConsentCommitment, "acceptance refund consent"),
    fulfillmentChainHead:
      text(v.fulfillmentChainHead, "acceptance fulfillment chain"),
    payeeCertificateCommitment:
      text(v.payeeCertificateCommitment, "acceptance certificate"),
    fulfillmentDeadline:
      text(v.fulfillmentDeadline, "acceptance deadline"),
    signature:
      signature(v.signature, "acceptance"),
  };
}

const FELT_PRIME = 2n ** 251n + 17n * 2n ** 192n + 1n;

function assertSignedFieldRanges(binding: SetupBinding | AcceptanceBinding): void {
  for (const [key, value] of Object.entries(binding)) {
    if (key === "transactionMode" || key === "publicRailAddress" || key === "publicRekberAddress") continue;
    if (key === "signature") {
      if ((value as string[]).some(item => BigInt(item) >= FELT_PRIME)) throw new Error("Rekber signature contains an invalid felt.");
      continue;
    }
    const raw = value as string;
    const locator = key === "dealOfferLocator";
    if (!(locator ? /^(0x)?[0-9a-fA-F]+$/ : /^(0x[0-9a-fA-F]+|[0-9]+)$/).test(raw)) {
      throw new Error(`Rekber ${key} is not a valid felt.`);
    }
    const numeric = BigInt(locator ? `0x${raw.replace(/^0x/, "")}` : raw);
    const limit = key === "fulfillmentDeadline" ? 1n << 128n : FELT_PRIME;
    if (numeric >= limit || ((key === "payerAddress" || key === "payeeAddress") && numeric === 0n)) {
      throw new Error(`Rekber ${key} is outside its allowed range.`);
    }
  }
}

export function sanitizeDisputeRekberBinding(
  value: unknown,
): DisputeRekberBinding {
  const v =
    asRecord(
      value,
      "Rekber arbitration binding",
    );

  const binding = {
    setup:
      parseSetup(v.setup),
    acceptance:
      parseAcceptance(
        v.acceptance,
      ),
  };
  assertMatchingRails(binding);
  assertSignedFieldRanges(binding.setup);
  assertSignedFieldRanges(binding.acceptance);
  return binding;
}

function sameFelt(
  left: string,
  right: string,
): boolean {
  try {
    return (
      BigInt(left) ===
      BigInt(right)
    );
  } catch {
    return false;
  }
}

function dealFelt(
  value: string,
): string {
  const raw =
    value
      .replace(/^0x/, "")
      .toLowerCase();

  if (!/^[0-9a-f]+$/.test(raw)) {
    throw new Error(
      "Rekber deal locator is invalid.",
    );
  }

  return num.toHex(`0x${raw}`);
}

function domain(
  config: AppConfig,
) {
  return {
    name: "VINSS Rekber",
    version: "3",
    chainId:
      config.network === "mainnet"
        ? constants
            .StarknetChainId
            .SN_MAIN
        : constants
            .StarknetChainId
            .SN_SEPOLIA,
    revision: "1",
  };
}

export function setupTypedData(
  config: AppConfig,
  setup: SetupBinding,
): TypedData {
  const data: TypedData = {
    types: {
      StarknetDomain:
        DOMAIN_TYPES,
      RekberSetup: [
        { name: "Custody", type: "felt" },
        { name: "Deal", type: "felt" },
        { name: "Private Terms", type: "felt" },
        { name: "Payer", type: "ContractAddress" },
        { name: "Payee", type: "ContractAddress" },
        { name: "Release Authorization", type: "felt" },
        { name: "Refund", type: "felt" },
        { name: "Payer Confirmation", type: "felt" },
        { name: "Payer Dispute", type: "felt" },
        { name: "Revision Chain", type: "felt" },
        { name: "Payer Certificate", type: "felt" },
        { name: "Fulfillment Deadline", type: "u128" },
      ],
    },
    primaryType:
      "RekberSetup",
    domain:
      domain(config),
    message: {
      Custody:
        num.toHex(
          BigInt(
            setup.custodyCommitment,
          ),
        ),
      Deal:
        dealFelt(
          setup.dealOfferLocator,
        ),
      "Private Terms":
        num.toHex(
          BigInt(
            setup.dealTermsCommitment,
          ),
        ),
      Payer:
        num.toHex(
          setup.payerAddress,
        ),
      Payee:
        num.toHex(
          setup.payeeAddress,
        ),
      "Release Authorization":
        num.toHex(
          BigInt(
            setup.releaseAuthorizationCommitment,
          ),
        ),
      Refund:
        num.toHex(
          BigInt(
            setup.refundCommitment,
          ),
        ),
      "Payer Confirmation":
        num.toHex(
          BigInt(
            setup.payerConfirmationCommitment,
          ),
        ),
      "Payer Dispute":
        num.toHex(
          BigInt(
            setup.payerDisputeCommitment,
          ),
        ),
      "Revision Chain":
        num.toHex(
          BigInt(
            setup.revisionChainHead,
          ),
        ),
      "Payer Certificate":
        num.toHex(
          BigInt(
            setup.payerCertificateCommitment,
          ),
        ),
      "Fulfillment Deadline":
        num.toHex(
          BigInt(
            setup.fulfillmentDeadline,
          ),
        ),
    },
  };
  return bindTypedRail(data, setup);
}

export function acceptanceTypedData(
  config: AppConfig,
  setup: SetupBinding,
  acceptance: AcceptanceBinding,
): TypedData {
  const data: TypedData = {
    types: {
      StarknetDomain:
        DOMAIN_TYPES,
      RekberAcceptance: [
        { name: "Custody", type: "felt" },
        { name: "Deal", type: "felt" },
        { name: "Private Terms", type: "felt" },
        { name: "Payer", type: "ContractAddress" },
        { name: "Payee", type: "ContractAddress" },
        { name: "Release Authorization", type: "felt" },
        { name: "Payee Claim", type: "felt" },
        { name: "Refund", type: "felt" },
        { name: "Payer Confirmation", type: "felt" },
        { name: "Payer Dispute", type: "felt" },
        { name: "Payee Dispute", type: "felt" },
        { name: "Refund Consent", type: "felt" },
        { name: "Fulfillment Chain", type: "felt" },
        { name: "Revision Chain", type: "felt" },
        { name: "Payer Certificate", type: "felt" },
        { name: "Payee Certificate", type: "felt" },
        { name: "Fulfillment Deadline", type: "u128" },
      ],
    },
    primaryType:
      "RekberAcceptance",
    domain:
      domain(config),
    message: {
      Custody:
        num.toHex(
          BigInt(
            acceptance.custodyCommitment,
          ),
        ),
      Deal:
        dealFelt(
          acceptance.dealOfferLocator,
        ),
      "Private Terms":
        num.toHex(
          BigInt(
            acceptance.dealTermsCommitment,
          ),
        ),
      Payer:
        num.toHex(
          acceptance.payerAddress,
        ),
      Payee:
        num.toHex(
          acceptance.payeeAddress,
        ),
      "Release Authorization":
        num.toHex(
          BigInt(
            setup.releaseAuthorizationCommitment,
          ),
        ),
      "Payee Claim":
        num.toHex(
          BigInt(
            acceptance.payeeClaimCommitment,
          ),
        ),
      Refund:
        num.toHex(
          BigInt(
            setup.refundCommitment,
          ),
        ),
      "Payer Confirmation":
        num.toHex(
          BigInt(
            setup.payerConfirmationCommitment,
          ),
        ),
      "Payer Dispute":
        num.toHex(
          BigInt(
            setup.payerDisputeCommitment,
          ),
        ),
      "Payee Dispute":
        num.toHex(
          BigInt(
            acceptance.payeeDisputeCommitment,
          ),
        ),
      "Refund Consent":
        num.toHex(
          BigInt(
            acceptance.payeeRefundConsentCommitment,
          ),
        ),
      "Fulfillment Chain":
        num.toHex(
          BigInt(
            acceptance.fulfillmentChainHead,
          ),
        ),
      "Revision Chain":
        num.toHex(
          BigInt(
            setup.revisionChainHead,
          ),
        ),
      "Payer Certificate":
        num.toHex(
          BigInt(
            setup.payerCertificateCommitment,
          ),
        ),
      "Payee Certificate":
        num.toHex(
          BigInt(
            acceptance.payeeCertificateCommitment,
          ),
        ),
      "Fulfillment Deadline":
        num.toHex(
          BigInt(
            acceptance.fulfillmentDeadline,
          ),
        ),
    },
  };
  assertMatchingRails({ setup, acceptance });
  return bindTypedRail(data, acceptance);
}

/*
 * Rekber identities are not public contract fields. During a dispute only,
 * both clients explicitly disclose their ORIGINAL Agreement signatures.
 * The backend binds those signatures to every public capability commitment.
 */
export async function verifyDisputeRekberBinding(
  config: AppConfig,
  disputeCase: DisputeCase,
  custody: VerifiedRekberCustody,
  binding: DisputeRekberBinding,
): Promise<void> {
  assertDisputeBindingDeployment(config, binding);
  const setup =
    binding.setup;
  const acceptance =
    binding.acceptance;

  const checks: Array<
    [string, string, string]
  > = [
    ["setup custody", setup.custodyCommitment, custody.custodyCommitment],
    ["acceptance custody", acceptance.custodyCommitment, custody.custodyCommitment],
    ["release", setup.releaseAuthorizationCommitment, custody.releaseAuthorizationCommitment],
    ["payee claim", acceptance.payeeClaimCommitment, custody.payeeClaimCommitment],
    ["refund", setup.refundCommitment, custody.refundCommitment],
    ["payer confirmation", setup.payerConfirmationCommitment, custody.payerConfirmationCommitment],
    ["payer dispute", setup.payerDisputeCommitment, custody.payerDisputeCommitment],
    ["payee dispute", acceptance.payeeDisputeCommitment, custody.payeeDisputeCommitment],
    ["refund consent", acceptance.payeeRefundConsentCommitment, custody.payeeRefundConsentCommitment],

    /*
     * fulfillment_chain_head and revision_chain_head are intentionally
     * mutable one-way chain cursors. Rekber advances them after a valid
     * fulfillment/revision secret is revealed, so comparing the ORIGINAL
     * signed head with the CURRENT live head would reject every progressed
     * custody.
     *
     * Their original values remain bound by the payer/payee Agreement
     * signatures below, while custodyCommitment and all immutable capability
     * commitments are still matched against live Rekber storage here.
     */
    ["payer certificate", setup.payerCertificateCommitment, custody.payerCertificateCommitment],
    ["payee certificate", acceptance.payeeCertificateCommitment, custody.payeeCertificateCommitment],
    ["setup deadline", setup.fulfillmentDeadline, custody.fulfillmentDeadline],
    ["acceptance deadline", acceptance.fulfillmentDeadline, custody.fulfillmentDeadline],
  ];

  for (
    const [label, left, right]
    of checks
  ) {
    if (!sameFelt(left, right)) {
      throw new Error(
        `Rekber ${label} does not match custody.`,
      );
    }
  }

  if (
    !sameFelt(
      setup.dealTermsCommitment,
      acceptance.dealTermsCommitment,
    ) ||
    dealFelt(
      setup.dealOfferLocator,
    ) !==
      dealFelt(
        acceptance.dealOfferLocator,
      )
  ) {
    throw new Error(
      "The two Rekber Agreement signatures do not describe the same deal.",
    );
  }

  if (
    !sameFelt(
      setup.payerAddress,
      disputeCase.payer.walletAddress,
    ) ||
    !sameFelt(
      setup.payeeAddress,
      disputeCase.payee.walletAddress,
    ) ||
    !sameFelt(
      acceptance.payerAddress,
      disputeCase.payer.walletAddress,
    ) ||
    !sameFelt(
      acceptance.payeeAddress,
      disputeCase.payee.walletAddress,
    )
  ) {
    throw new Error(
      "Dispute wallets are not the original Rekber Payer and Payee.",
    );
  }

  const provider =
    new RpcProvider({
      nodeUrl:
        config.rpcUrl,
    });

  const payerValid =
    await verifyMessageInStarknet(
      provider,
      setupTypedData(
        config,
        setup,
      ),
      setup.signature,
      setup.payerAddress,
    );

  if (!payerValid) {
    throw new Error(
      "Payer Rekber Agreement signature is invalid.",
    );
  }

  const payeeValid =
    await verifyMessageInStarknet(
      provider,
      acceptanceTypedData(
        config,
        setup,
        acceptance,
      ),
      acceptance.signature,
      acceptance.payeeAddress,
    );

  if (!payeeValid) {
    throw new Error(
      "Payee Rekber Agreement signature is invalid.",
    );
  }
}
