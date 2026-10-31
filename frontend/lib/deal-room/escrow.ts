import { assertRekberRail, verifyRekberSetup, verifyRekberAcceptance } from "./rekberAuthorization";
import { computeReleaseAuthorizationCommitment } from "./settlement";
import { verifyEnvelopeProof, felt } from "./envelopeProof";
import { contractsForAccount } from "@/lib/starknet/railConfig";
import { prepareActionLocator } from "@/lib/starknet/actionLocator";
import { invokeVinssActions, preflightVinssActions } from "@/lib/starknet/vinssExecution";
/** Private Rekber coordination and accepted-Offer settlement mapping. */

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
import {
  quoteRekberWorkflowFee,
} from "@/lib/starknet/feePolicy";

const PRIVATE_ESCROW_ENVELOPE_VERSION = 2;
const ESCROW_COMMITMENT_DOMAIN =
  "VINSS_PRIVATE_ESCROW_COMMIT_V2";

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
  revenueFee: bigint,
  locatorNonce?: string,
): Promise<{ transaction_hash: string }> {
  const CONTRACTS = contractsForAccount(account);
  const token =
    CONTRACTS.messageHelperOpenNoteToken;
  const rawTreasury =
    process.env
      .NEXT_PUBLIC_VINSS_TREASURY_ADDRESS;

  if (!token || !rawTreasury) {
    throw new Error(
      "STRK replay protection is not configured for private Escrow coordination.",
    );
  }

  /*
   * Create, accept and explicit dispute coordination use the workflow fee.
   * Background coordination uses 10 wei for native pool replay protection;
   * the public translator keeps that background path free.
   */
  const replayOrRevenueAmount =
    revenueFee > 0n
      ? revenueFee
      : 10n;

  return invokeVinssActions(account, [
    {
      type: "withdraw",
      token,
      amount: toFelt(
        replayOrRevenueAmount,
      ),
      recipient: num.toHex(rawTreasury),
    },
    {
      type: "invoke",
      contract: contractAddress,
      calldata: [
        toFelt(calldata.length),
        ...calldata,
      ],
    },
  ], { locatorNonce });
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
  const CONTRACTS = contractsForAccount(account);
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

  const { actionLocator, locatorNonce } = prepareActionLocator(account, encryptionKey);

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

  const calldata = [
    PRIVATE_ESCROW_ENVELOPE_VERSION,
    actionLocator,
    senderTag,
    recipientTag,
    payloadCommitment,
    ciphertextChunks.length,
    ...ciphertextChunks,
  ].map(toFelt);

  /*
   * Paid private Rekber coordination:
   * - payer Agreement
   * - payee Agreement
   * - every explicit dispute coordination action (reason/evidence/signature)
   *
   * Fund confirmations and other background synchronization remain replay-only.
   */
  const revenueFee =
    payload.kind === "create" ||
    payload.kind === "accept" ||
    payload.kind === "dispute"
      ? await quoteRekberWorkflowFee(account)
      : 0n;

  await preflightVinssActions(account);
  if (onPrepared) {
    await onPrepared({
      actionLocator,
      payloadCommitment,
    });
  }

  const response = await invokeHelper(
    account,
    CONTRACTS.privateEscrowHelper,
    calldata,
    revenueFee,
    locatorNonce,
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
  account?: object,
): Promise<
  Array<{
    actionLocator: string;
    payloadCommitment: string;
    senderTag: string;
    recipientTag: string;
    action: EscrowActionPayload;
    blockNumber: number;
    transactionHash: string;
    recoveryOnly?: boolean;
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
    recoveryOnly?: boolean;
  }> = [];

  if (!Array.isArray(records)) throw new Error("Invalid ciphertext discovery response.");
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    if (
      !record.senderTag ||
      !record.recipientTag
    ) {
      continue;
    }

    let actionLocator: bigint;
    try { actionLocator = felt(record.actionLocator); } catch { continue; }

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

        const proof = await verifyEnvelopeProof("escrow", record, account, ["create", "accept", "dispute"].includes(action.kind), action.custodyCommitment);
        decrypted.push({
          recoveryOnly: proof.recoveryOnly,
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

  // Shared-key peers may create ciphertext, but may not replace wallet-signed
  // agreement state or poison the release capability selected by the UI.
  const setups = new Map<string, EscrowActionPayload>();
  const authenticated: typeof decrypted = [];
  for (const record of decrypted) {
    if (record.action.kind !== "create") continue;
    try {
      assertRekberRail(account as WalletAccountV6, record.action);
      if (await verifyRekberSetup(record.action)) {
        setups.set(felt(record.action.custodyCommitment).toString(), record.action);
        authenticated.push(record);
      }
    } catch { /* Invalid or another-rail setup is never authoritative state. */ }
  }
  for (const record of decrypted) {
    const action = record.action;
    if (action.kind === "create") continue;
    try {
      const setup = action.custodyCommitment ? setups.get(felt(action.custodyCommitment).toString()) : undefined;
      if (action.kind === "accept") {
        assertRekberRail(account as WalletAccountV6, action);
        if (!setup || !await verifyRekberAcceptance(setup, action)) continue;
      }
      if (action.kind === "resolve" && action.releaseAuthorizationSecret) {
        if (!setup || computeReleaseAuthorizationCommitment(BigInt(action.custodyCommitment!), BigInt(action.releaseAuthorizationSecret)) !== BigInt(setup.releaseAuthorizationCommitment!)) continue;
      }
      authenticated.push(record);
    } catch { /* Skip malformed private coordination instead of suppressing valid history. */ }
  }
  return authenticated.sort((a,b) => a.blockNumber-b.blockNumber);

}
