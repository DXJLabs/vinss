/**
 * Wallet-authenticated Rekber coordination.
 *
 * Direct room payloads use a pairwise symmetric encryption key. Encryption
 * keeps the payload private, but by itself it cannot prove which peer authored
 * a decrypted payload because both peers know that key. These SNIP-12
 * signatures add explicit wallet authorship to the payer setup and payee
 * acceptance before any funds are allowed to move.
 *
 * Signatures stay inside encrypted coordination payloads. Verification sends
 * only the typed-data hash and signature to the signer's account contract.
 */

import type {
  Signature,
  TypedData,
  WalletAccountV6,
} from "starknet";
import {
  constants,
  num,
  verifyMessageInStarknet,
} from "starknet";
import type {
  EscrowActionPayload,
  OfferActionPayload,
} from "@/types/deal-room";
import {
  NETWORK,
} from "@/lib/starknet/constants";
import {
  getProvider,
} from "@/lib/starknet/walletClient";
import {
  canonicalStarknetAddress,
} from "@/lib/privacy/participantKeys";

export const REKBER_COORDINATION_VERSION = 2;
const FELT_PRIME =
  2n ** 251n + 17n * 2n ** 192n + 1n;

const DOMAIN_TYPES = [
  { name: "name", type: "shortstring" },
  { name: "version", type: "shortstring" },
  { name: "chainId", type: "shortstring" },
  { name: "revision", type: "shortstring" },
];

function required(
  value: string | undefined,
  label: string,
): string {
  if (!value) {
    throw new Error(
      `Rekber authorization is missing ${label}.`,
    );
  }

  return value;
}

function decimalFelt(
  value: string | undefined,
  label: string,
): string {
  return num.toHex(
    BigInt(required(value, label)),
  );
}

function locatorFelt(
  value: string | undefined,
  label: string,
): string {
  const raw = required(value, label)
    .replace(/^0x/, "")
    .toLowerCase();

  if (!/^[0-9a-f]+$/.test(raw)) {
    throw new Error(
      `Rekber authorization has an invalid ${label}.`,
    );
  }

  return num.toHex(`0x${raw}`);
}

function address(
  value: string | undefined,
  label: string,
): string {
  return num.toHex(
    required(value, label),
  );
}

function domain() {
  return {
    name: "VINSS Rekber",
    version: "2",
    chainId:
      NETWORK === "mainnet"
        ? constants.StarknetChainId.SN_MAIN
        : constants.StarknetChainId.SN_SEPOLIA,
    revision: "1",
  };
}

/**
 * Bind the wallet approvals to the exact private Offer fields the UI showed.
 * The digest stays inside encrypted Rekber coordination and is never emitted
 * by the public custody contract.
 */
export async function computeDealTermsCommitment(
  offer: OfferActionPayload,
): Promise<string> {
  const canonicalTerms = JSON.stringify([
    offer.kind,
    offer.parentOfferLocator ?? "",
    offer.rootOfferLocator ?? "",
    offer.dealType ?? "",
    offer.asset.trim(),
    offer.amount.trim(),
    offer.paymentTerms.trim(),
    offer.conditions?.trim() ?? "",
    offer.expiresAt ?? "",
    canonicalStarknetAddress(
      offer.senderAddress ?? "",
    ),
    canonicalStarknetAddress(
      offer.recipientAddress ?? "",
    ),
  ]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      canonicalTerms,
    ),
  );
  const value = BigInt(
    `0x${Array.from(
      new Uint8Array(digest),
    )
      .map((byte) =>
        byte.toString(16).padStart(2, "0"),
      )
      .join("")}`,
  ) % FELT_PRIME;

  return value.toString();
}

export function buildRekberSetupTypedData(
  setup: EscrowActionPayload,
): TypedData {
  if (setup.kind !== "create") {
    throw new Error(
      "Only a Rekber setup can be signed as a payer setup.",
    );
  }

  return {
    types: {
      StarknetDomain: DOMAIN_TYPES,
      RekberSetup: [
        { name: "Custody", type: "felt" },
        { name: "Deal", type: "felt" },
        {
          name: "Private Terms",
          type: "felt",
        },
        { name: "Payer", type: "ContractAddress" },
        { name: "Payee", type: "ContractAddress" },
        {
          name: "Release Authorization",
          type: "felt",
        },
        { name: "Refund", type: "felt" },
        {
          name: "Payer Certificate",
          type: "felt",
        },
        { name: "Refund After", type: "u128" },
      ],
    },
    primaryType: "RekberSetup",
    domain: domain(),
    message: {
      Custody: decimalFelt(
        setup.custodyCommitment,
        "custody commitment",
      ),
      Deal: locatorFelt(
        setup.dealOfferLocator,
        "accepted Offer locator",
      ),
      "Private Terms": decimalFelt(
        setup.dealTermsCommitment,
        "private terms commitment",
      ),
      Payer: address(
        setup.senderAddress,
        "payer address",
      ),
      Payee: address(
        setup.recipientAddress,
        "payee address",
      ),
      "Release Authorization": decimalFelt(
        setup.releaseAuthorizationCommitment,
        "release commitment",
      ),
      Refund: decimalFelt(
        setup.refundCommitment,
        "refund commitment",
      ),
      "Payer Certificate": decimalFelt(
        setup.payerCertificateCommitment,
        "payer certificate commitment",
      ),
      "Refund After": decimalFelt(
        setup.refundAfter,
        "refund boundary",
      ),
    },
  };
}

export function buildRekberAcceptanceTypedData(
  setup: EscrowActionPayload,
  acceptance: EscrowActionPayload,
): TypedData {
  if (
    setup.kind !== "create" ||
    acceptance.kind !== "accept"
  ) {
    throw new Error(
      "A Rekber acceptance must reference a payer setup.",
    );
  }

  return {
    types: {
      StarknetDomain: DOMAIN_TYPES,
      RekberAcceptance: [
        { name: "Custody", type: "felt" },
        { name: "Deal", type: "felt" },
        {
          name: "Private Terms",
          type: "felt",
        },
        { name: "Payer", type: "ContractAddress" },
        { name: "Payee", type: "ContractAddress" },
        {
          name: "Release Authorization",
          type: "felt",
        },
        { name: "Payee Claim", type: "felt" },
        { name: "Refund", type: "felt" },
        {
          name: "Payer Certificate",
          type: "felt",
        },
        {
          name: "Payee Certificate",
          type: "felt",
        },
        { name: "Refund After", type: "u128" },
      ],
    },
    primaryType: "RekberAcceptance",
    domain: domain(),
    message: {
      Custody: decimalFelt(
        acceptance.custodyCommitment,
        "custody commitment",
      ),
      Deal: locatorFelt(
        acceptance.dealOfferLocator,
        "accepted Offer locator",
      ),
      "Private Terms": decimalFelt(
        acceptance.dealTermsCommitment,
        "private terms commitment",
      ),
      Payer: address(
        acceptance.recipientAddress,
        "payer address",
      ),
      Payee: address(
        acceptance.senderAddress,
        "payee address",
      ),
      "Release Authorization": decimalFelt(
        setup.releaseAuthorizationCommitment,
        "release commitment",
      ),
      "Payee Claim": decimalFelt(
        acceptance.payeeClaimCommitment,
        "payee claim commitment",
      ),
      Refund: decimalFelt(
        setup.refundCommitment,
        "refund commitment",
      ),
      "Payer Certificate": decimalFelt(
        setup.payerCertificateCommitment,
        "payer certificate commitment",
      ),
      "Payee Certificate": decimalFelt(
        acceptance.payeeCertificateCommitment,
        "payee certificate commitment",
      ),
      "Refund After": decimalFelt(
        acceptance.refundAfter,
        "refund boundary",
      ),
    },
  };
}

function signatureToStrings(
  signature: Signature,
): string[] {
  if (Array.isArray(signature)) {
    return signature.map((item) =>
      num.toHex(item),
    );
  }

  return [
    num.toHex(signature.r),
    num.toHex(signature.s),
  ];
}

export async function signRekberSetup(
  account: WalletAccountV6,
  setup: EscrowActionPayload,
): Promise<string[]> {
  return signatureToStrings(
    await account.signMessage(
      buildRekberSetupTypedData(setup),
    ),
  );
}

export async function signRekberAcceptance(
  account: WalletAccountV6,
  setup: EscrowActionPayload,
  acceptance: EscrowActionPayload,
): Promise<string[]> {
  return signatureToStrings(
    await account.signMessage(
      buildRekberAcceptanceTypedData(
        setup,
        acceptance,
      ),
    ),
  );
}

export async function verifyRekberSetup(
  setup: EscrowActionPayload,
): Promise<boolean> {
  if (
    setup.coordinationVersion !==
      REKBER_COORDINATION_VERSION ||
    !setup.coordinationSignature?.length ||
    !setup.senderAddress
  ) {
    return false;
  }

  try {
    return await verifyMessageInStarknet(
      getProvider(),
      buildRekberSetupTypedData(setup),
      setup.coordinationSignature,
      setup.senderAddress,
    );
  } catch {
    return false;
  }
}

export async function verifyRekberAcceptance(
  setup: EscrowActionPayload,
  acceptance: EscrowActionPayload,
): Promise<boolean> {
  if (
    acceptance.coordinationVersion !==
      REKBER_COORDINATION_VERSION ||
    !acceptance.coordinationSignature
      ?.length ||
    !acceptance.senderAddress
  ) {
    return false;
  }

  const sameAddress = (
    left: string | undefined,
    right: string | undefined,
  ) => {
    try {
      return (
        num.toHex(required(left, "address")) ===
        num.toHex(required(right, "address"))
      );
    } catch {
      return false;
    }
  };
  const sameDecimal = (
    left: string | undefined,
    right: string | undefined,
  ) => {
    try {
      return BigInt(
        required(left, "value"),
      ) === BigInt(required(right, "value"));
    } catch {
      return false;
    }
  };
  const sameLocator = (
    left: string | undefined,
    right: string | undefined,
  ) => {
    try {
      return (
        locatorFelt(left, "locator") ===
        locatorFelt(right, "locator")
      );
    } catch {
      return false;
    }
  };

  if (
    !sameAddress(
      acceptance.senderAddress,
      setup.recipientAddress,
    ) ||
    !sameAddress(
      acceptance.recipientAddress,
      setup.senderAddress,
    ) ||
    !sameDecimal(
      acceptance.custodyCommitment,
      setup.custodyCommitment,
    ) ||
    !sameLocator(
      acceptance.dealOfferLocator,
      setup.dealOfferLocator,
    ) ||
    !sameDecimal(
      acceptance.dealTermsCommitment,
      setup.dealTermsCommitment,
    ) ||
    !sameDecimal(
      acceptance.refundAfter,
      setup.refundAfter,
    )
  ) {
    return false;
  }

  try {
    return await verifyMessageInStarknet(
      getProvider(),
      buildRekberAcceptanceTypedData(
        setup,
        acceptance,
      ),
      acceptance.coordinationSignature,
      acceptance.senderAddress,
    );
  } catch {
    return false;
  }
}
