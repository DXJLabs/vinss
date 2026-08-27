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
import {
  computeDisputeCaseFeltCommitment,
} from "./evidence.js";
import type {
  DisputeCase,
  DisputeRole,
} from "./types.js";

const DOMAIN_TYPES = [
  {
    name: "name",
    type: "shortstring",
  },
  {
    name: "version",
    type: "shortstring",
  },
  {
    name: "chainId",
    type: "shortstring",
  },
  {
    name: "revision",
    type: "shortstring",
  },
];

function domain(
  config: AppConfig,
) {
  return {
    name:
      "VINSS Dispute",
    version: "1",
    chainId:
      config.network ===
      "mainnet"
        ? constants
            .StarknetChainId
            .SN_MAIN
        : constants
            .StarknetChainId
            .SN_SEPOLIA,
    revision: "1",
  };
}

function walletForRole(
  disputeCase: DisputeCase,
  role: DisputeRole,
): string {
  return role === "payer"
    ? disputeCase.payer
        .walletAddress
    : disputeCase.payee
        .walletAddress;
}

/**
 * Signing means: "I consent to submit this exact combined dispute case to the
 * VINSS Dispute Agent for review." It does NOT mean the signer agrees with the
 * counterparty's factual claims.
 */
export function buildDisputeAttestationTypedData(
  config: AppConfig,
  disputeCase: DisputeCase,
  role: DisputeRole,
): TypedData {
  const wallet =
    walletForRole(
      disputeCase,
      role,
    );

  return {
    types: {
      StarknetDomain:
        DOMAIN_TYPES,
      DisputeAttestation: [
        {
          name: "Case",
          type: "felt",
        },
        {
          name: "Custody",
          type: "felt",
        },
        {
          name: "Role",
          type: "shortstring",
        },
        {
          name: "Wallet",
          type: "ContractAddress",
        },
        {
          name: "Consent",
          type: "shortstring",
        },
      ],
    },
    primaryType:
      "DisputeAttestation",
    domain:
      domain(config),
    message: {
      Case:
        computeDisputeCaseFeltCommitment(
          disputeCase,
        ),
      Custody:
        num.toHex(
          disputeCase
            .custodyCommitment,
        ),
      Role:
        role === "payer"
          ? "Payer"
          : "Payee",
      Wallet:
        num.toHex(wallet),
      Consent:
        "Review",
    },
  };
}

export interface DisputeAttestations {
  payer: string[];
  payee: string[];
}

function parseSignature(
  value: unknown,
  role: DisputeRole,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 16
  ) {
    throw new Error(
      `${role} signature is invalid.`,
    );
  }

  return value.map(
    (item) => {
      if (
        typeof item !==
          "string" ||
        !/^0x[0-9a-fA-F]+$/.test(
          item,
        )
      ) {
        throw new Error(
          `${role} signature contains an invalid felt.`,
        );
      }

      return num.toHex(
        item,
      );
    },
  );
}

export function sanitizeDisputeAttestations(
  value: unknown,
): DisputeAttestations {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "payer and payee attestations are required.",
    );
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return {
    payer:
      parseSignature(
        record.payer,
        "payer",
      ),
    payee:
      parseSignature(
        record.payee,
        "payee",
      ),
  };
}

export async function verifyDisputeAttestations(
  config: AppConfig,
  disputeCase: DisputeCase,
  attestations: DisputeAttestations,
): Promise<void> {
  const provider =
    new RpcProvider({
      nodeUrl:
        config.rpcUrl,
    });

  for (
    const role of
    [
      "payer",
      "payee",
    ] as const
  ) {
    const wallet =
      walletForRole(
        disputeCase,
        role,
      );

    let valid = false;

    try {
      valid =
        await verifyMessageInStarknet(
          provider,
          buildDisputeAttestationTypedData(
            config,
            disputeCase,
            role,
          ),
          attestations[role],
          wallet,
        );
    } catch {
      valid = false;
    }

    if (!valid) {
      throw new Error(
        `${role} dispute attestation is not valid for the declared wallet.`,
      );
    }
  }
}
