/**
 * Escrow Rekber domain module.
 *
 * One product feature has two technical layers:
 *
 * 1) Private Escrow coordination
 *    - same encrypted V2 envelope shape as Direct Offer:
 *      [version, locator, sender_tag, recipient_tag,
 *       commitment, chunk_count, ...ciphertext]
 *    - deal type, accepted Offer terms and participant identities stay inside
 *      ciphertext.
 *
 * 2) Rekber custody / settlement
 *    - public commitment-based calldata because this contract actually
 *      receives and returns ERC-20 custody.
 *    - all Offer templates use the same generic settlement primitive:
 *      the accepted Offer decides the payment asset, amount and private terms;
 *      the Rekber contract only needs token/base-unit amount, commitments and
 *      the refund boundary.
 */

import type { WalletAccountV6 } from "starknet";
import { hash, num } from "starknet";
import {
  CONTRACTS,
} from "../starknet/constants";
import {
  decryptPayload,
  encryptPayload,
  generateActionLocator,
  shortStringToFelt,
  toFelt,
  type ChannelKey,
} from "@/lib/privacy/envelope";
import type {
  EscrowActionPayload,
  SendActionResult,
} from "@/types/deal-room";
import {
  GROUP_RECIPIENT_IDENTITY,
  deriveMessageRoutingTag,
  type MessageRoute,
} from "@/lib/privacy/messageRouting";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";

const PRIVATE_ESCROW_ENVELOPE_VERSION = 2;
const ESCROW_COMMITMENT_DOMAIN =
  "VINSS_PRIVATE_ESCROW_COMMIT_V2";

const RELEASE_COMMITMENT_DOMAIN =
  "VINSS_ESCROW_RELEASE_V1";
const REFUND_COMMITMENT_DOMAIN =
  "VINSS_ESCROW_REFUND_V1";

export interface PreparedEscrowSend {
  actionLocator: bigint;
  payloadCommitment: bigint;
}

function commitPrivateEscrowPayloadV2(
  actionLocator: bigint,
  senderTag: bigint,
  recipientTag: bigint,
  ciphertextChunks: bigint[],
): bigint {
  const inputs = [
    shortStringToFelt(ESCROW_COMMITMENT_DOMAIN),
    BigInt(PRIVATE_ESCROW_ENVELOPE_VERSION),
    actionLocator,
    senderTag,
    recipientTag,
    BigInt(ciphertextChunks.length),
    ...ciphertextChunks,
  ];

  return BigInt(
    hash.computePoseidonHashOnElements(
      inputs.map(String),
    ),
  );
}

async function invokeHelper(
  account: WalletAccountV6,
  contractAddress: string,
  calldata: string[],
): Promise<{ transaction_hash: string }> {
  return account.strk20InvokeTransaction([
    {
      type: "invoke",
      contract: contractAddress,
      calldata: [
        toFelt(calldata.length),
        ...calldata,
      ],
    },
  ]);
}

// ---------------------------------------------------------------------------
// Accepted Offer -> generic Rekber settlement model
// ---------------------------------------------------------------------------
//
// Re-export the pure production mapping so existing callers keep the same API
// while scenario tests can exercise the mapping without wallet/browser state.
export {
  buildEscrowOfferSnapshot,
  parseSettlementAmount,
  resolveSettlementAsset,
  type SettlementAsset,
} from "./escrowSettlement";

// ---------------------------------------------------------------------------
// Private Escrow coordination
// ---------------------------------------------------------------------------

export async function sendEscrowCoordinationAction(
  account: WalletAccountV6,
  channelKey: ChannelKey,
  payload: EscrowActionPayload,
  route?: MessageRoute,
  onPrepared?: (
    prepared: PreparedEscrowSend,
  ) => void | Promise<void>,
): Promise<SendActionResult> {
  if (!CONTRACTS.privateEscrowHelper) {
    throw new Error(
      "NEXT_PUBLIC_PRIVATE_ESCROW_HELPER_ADDRESS is not set — see .env.local.example.",
    );
  }

  const encryptionKey =
    route?.encryptionKey ?? channelKey;
  const routingKey =
    route?.routingKey ?? encryptionKey;
  const recipientIdentity =
    route?.recipientIdentity ??
    GROUP_RECIPIENT_IDENTITY;

  const actionLocator =
    generateActionLocator(encryptionKey);

  const [senderTag, recipientTag] =
    await Promise.all([
      deriveMessageRoutingTag(
        routingKey,
        "sender",
        account.address,
        actionLocator,
      ),
      deriveMessageRoutingTag(
        routingKey,
        "recipient",
        recipientIdentity,
        actionLocator,
      ),
    ]);

  const ciphertextChunks =
    await encryptPayload(
      encryptionKey,
      payload,
    );

  const payloadCommitment =
    commitPrivateEscrowPayloadV2(
      actionLocator,
      senderTag,
      recipientTag,
      ciphertextChunks,
    );

  if (onPrepared) {
    await onPrepared({
      actionLocator,
      payloadCommitment,
    });
  }

  const calldata = [
    PRIVATE_ESCROW_ENVELOPE_VERSION,
    actionLocator,
    senderTag,
    recipientTag,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);

  const response = await invokeHelper(
    account,
    CONTRACTS.privateEscrowHelper,
    calldata,
  );

  return {
    transactionHash:
      response.transaction_hash,
    actionLocator,
    payloadCommitment,
  };
}

export async function discoverEscrowActions(
  backendUrl: string,
  channelKey: ChannelKey,
  route?: MessageRoute | MessageRoute[],
): Promise<
  Array<{
    actionLocator: string;
    payloadCommitment: string;
    senderTag: string;
    recipientTag: string;
    action: EscrowActionPayload;
    blockNumber: number;
    transactionHash: string;
  }>
> {
  const res = await fetch(
    `${backendUrl}/discover`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        kind: "escrow",
      }),
    },
  );

  if (!res.ok) {
    throw new Error(
      `Escrow discovery failed: ${res.status} ${await res.text()}`,
    );
  }

  const records =
    (await res.json()) as Array<{
      actionLocator: string;
      payloadCommitment: string;
      senderTag?: string;
      recipientTag?: string;
      ciphertextChunks: string[];
      blockNumber: number;
      transactionHash: string;
    }>;

  const candidateRoutes: MessageRoute[] =
    route == null
      ? [
          {
            recipientIdentity:
              GROUP_RECIPIENT_IDENTITY,
            encryptionKey: channelKey,
            routingKey: channelKey,
          },
        ]
      : Array.isArray(route)
        ? route
        : [route];

  const decrypted: Array<{
    actionLocator: string;
    payloadCommitment: string;
    senderTag: string;
    recipientTag: string;
    action: EscrowActionPayload;
    blockNumber: number;
    transactionHash: string;
  }> = [];

  for (const record of records) {
    if (
      !record.senderTag ||
      !record.recipientTag
    ) {
      continue;
    }

    const actionLocator =
      BigInt(record.actionLocator);

    for (const candidate of candidateRoutes) {
      try {
        const encryptionKey =
          candidate.encryptionKey ??
          channelKey;
        const routingKey =
          candidate.routingKey ??
          encryptionKey;

        const expectedRecipientTag =
          await deriveMessageRoutingTag(
            routingKey,
            "recipient",
            candidate.recipientIdentity,
            actionLocator,
          );

        if (
          BigInt(record.recipientTag) !==
          expectedRecipientTag
        ) {
          continue;
        }

        const action =
          (await decryptPayload(
            encryptionKey,
            record.ciphertextChunks.map(
              BigInt,
            ),
          )) as EscrowActionPayload;

        if (action.senderAddress) {
          const expectedSenderTag =
            await deriveMessageRoutingTag(
              routingKey,
              "sender",
              action.senderAddress,
              actionLocator,
            );

          if (
            BigInt(record.senderTag) !==
            expectedSenderTag
          ) {
            continue;
          }
        }

        if (
          action.recipientAddress &&
          !sameStarknetAddress(
            action.recipientAddress,
            candidate.recipientIdentity,
          )
        ) {
          continue;
        }

        decrypted.push({
          actionLocator:
            record.actionLocator,
          payloadCommitment:
            record.payloadCommitment,
          senderTag:
            record.senderTag,
          recipientTag:
            record.recipientTag,
          action,
          blockNumber:
            record.blockNumber,
          transactionHash:
            record.transactionHash,
        });

        break;
      } catch {
        // Unrelated ciphertext/key mismatch is expected during local discovery.
      }
    }
  }

  return decrypted;
}

// ---------------------------------------------------------------------------
// Rekber custody / settlement
// ---------------------------------------------------------------------------

export interface EscrowSecrets {
  releaseSecret: bigint;
  refundSecret: bigint;
}

function randomFelt(): bigint {
  return BigInt(
    "0x" +
      Array.from(
        crypto.getRandomValues(
          new Uint8Array(31),
        ),
      )
        .map((b) =>
          b
            .toString(16)
            .padStart(2, "0"),
        )
        .join(""),
  );
}

export function generateEscrowSecrets(): EscrowSecrets {
  return {
    releaseSecret: randomFelt(),
    refundSecret: randomFelt(),
  };
}

export function generateCustodyCommitment(): bigint {
  return randomFelt();
}

export function computeReleaseCommitment(
  custodyCommitment: bigint,
  releaseSecret: bigint,
): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements([
      String(
        shortStringToFelt(
          RELEASE_COMMITMENT_DOMAIN,
        ),
      ),
      String(custodyCommitment),
      String(releaseSecret),
    ]),
  );
}

export function computeRefundCommitment(
  custodyCommitment: bigint,
  refundSecret: bigint,
): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements([
      String(
        shortStringToFelt(
          REFUND_COMMITMENT_DOMAIN,
        ),
      ),
      String(custodyCommitment),
      String(refundSecret),
    ]),
  );
}

export async function depositEscrow(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    releaseCommitment: bigint;
    refundCommitment: bigint;
    refundAfter: number;
    token: string;
    amount: bigint;
  },
): Promise<{
  transactionHash: string;
}> {
  if (!CONTRACTS.escrowRekber) {
    throw new Error(
      "NEXT_PUBLIC_ESCROW_REKBER_ADDRESS is not set.",
    );
  }

  const treasury =
    process.env
      .NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!treasury) {
    throw new Error(
      "NEXT_PUBLIC_VINSS_TREASURY_ADDRESS is not configured",
    );
  }

  const principal =
    params.amount;
  const fee =
    principal / 100n;

  if (fee <= 0n) {
    throw new Error(
      "Amount is too small for the 1% Rekber fee.",
    );
  }

  const total =
    principal + fee;
  const token =
    num.toHex(params.token);

  const calldata = [
    toFelt(1),
    toFelt(
      params.custodyCommitment,
    ),
    toFelt(
      params.releaseCommitment,
    ),
    toFelt(
      params.refundCommitment,
    ),
    toFelt(params.refundAfter),
    token,
    toFelt(principal),
  ];

  const response =
    await account.strk20InvokeTransaction([
      {
        type: "withdraw",
        token,
        amount: toFelt(total),
        recipient:
          CONTRACTS.escrowRekber,
      },
      {
        type: "transfer",
        token,
        amount: "OPEN",
        recipient: treasury,
      },
      {
        type: "invoke",
        contract:
          CONTRACTS.escrowRekber,
        calldata: [
          toFelt(
            calldata.length + 1,
          ),
          ...calldata,
          "${openNoteIds[0]}",
        ],
      },
    ]);

  return {
    transactionHash:
      response.transaction_hash,
  };
}

export async function releaseEscrow(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    releaseSecret: bigint;
    outputNoteId: bigint;
  },
): Promise<{
  transactionHash: string;
}> {
  if (!CONTRACTS.escrowRekber) {
    throw new Error(
      "NEXT_PUBLIC_ESCROW_REKBER_ADDRESS is not set — see .env.local.example.",
    );
  }

  const calldata = [
    toFelt(2),
    toFelt(
      params.custodyCommitment,
    ),
    toFelt(
      params.releaseSecret,
    ),
    toFelt(params.outputNoteId),
  ];

  const response =
    await invokeHelper(
      account,
      CONTRACTS.escrowRekber,
      calldata,
    );

  return {
    transactionHash:
      response.transaction_hash,
  };
}

export async function refundEscrow(
  account: WalletAccountV6,
  params: {
    custodyCommitment: bigint;
    refundSecret: bigint;
    outputNoteId: bigint;
  },
): Promise<{
  transactionHash: string;
}> {
  if (!CONTRACTS.escrowRekber) {
    throw new Error(
      "NEXT_PUBLIC_ESCROW_REKBER_ADDRESS is not set — see .env.local.example.",
    );
  }

  const calldata = [
    toFelt(3),
    toFelt(
      params.custodyCommitment,
    ),
    toFelt(
      params.refundSecret,
    ),
    toFelt(params.outputNoteId),
  ];

  const response =
    await invokeHelper(
      account,
      CONTRACTS.escrowRekber,
      calldata,
    );

  return {
    transactionHash:
      response.transaction_hash,
  };
}
