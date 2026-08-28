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

interface SetupBinding {
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

interface AcceptanceBinding {
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

function parseSetup(
  value: unknown,
): SetupBinding {
  const v =
    asRecord(
      value,
      "Rekber setup binding",
    );

  return {
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

export function sanitizeDisputeRekberBinding(
  value: unknown,
): DisputeRekberBinding {
  const v =
    asRecord(
      value,
      "Rekber arbitration binding",
    );

  return {
    setup:
      parseSetup(v.setup),
    acceptance:
      parseAcceptance(
        v.acceptance,
      ),
  };
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

function setupTypedData(
  config: AppConfig,
  setup: SetupBinding,
): TypedData {
  return {
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
}

function acceptanceTypedData(
  config: AppConfig,
  setup: SetupBinding,
  acceptance: AcceptanceBinding,
): TypedData {
  return {
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
    ["fulfillment chain", acceptance.fulfillmentChainHead, custody.fulfillmentChainHead],
    ["revision chain", setup.revisionChainHead, custody.revisionChainHead],
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
