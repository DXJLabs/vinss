import type {
  ConversationEntry,
} from "@/components/room/conversation/types";
import type {
  DiscoveredEscrowAction,
} from "@/hooks/room/useRoomEscrow";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";
import {
  REKBER_COORDINATION_VERSION,
} from "@/lib/deal-room/rekberAuthorization";

/*
 * Normalize only for comparisons. Never rewrite persisted locators/custody
 * values because historical encrypted payloads must remain byte-compatible.
 */
export function canonicalCustodyKey(
  value: string | null | undefined,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "";
  }

  try {
    return BigInt(value)
      .toString(16)
      .toLowerCase();
  } catch {
    return value
      .replace(/^0x/, "")
      .toLowerCase();
  }
}

export function normalizeLocator(
  value: string | null | undefined,
): string {
  return typeof value === "string"
    ? value
        .replace(/^0x/, "")
        .toLowerCase()
    : "";
}

export function selectDirectPairEntries(
  entries: ConversationEntry[],
  offerEntries: ConversationEntry[],
  walletAddress: string | undefined,
  peerAddress: string,
): ConversationEntry[] {
  return [
    ...entries,
    ...offerEntries,
  ]
    .filter((entry) => {
      if (
        (entry.scope ?? "group") !==
        "direct"
      ) {
        return false;
      }

      const incoming =
        sameStarknetAddress(
          entry.senderAddress,
          peerAddress,
        ) &&
        sameStarknetAddress(
          entry.recipientAddress,
          walletAddress,
        );

      const outgoing =
        sameStarknetAddress(
          entry.senderAddress,
          walletAddress,
        ) &&
        sameStarknetAddress(
          entry.recipientAddress,
          peerAddress,
        );

      return incoming || outgoing;
    })
    .sort(
      (left, right) =>
        new Date(left.sentAt).getTime() -
        new Date(right.sentAt).getTime(),
    );
}

export function selectRekberCreateActions(
  escrowActions: DiscoveredEscrowAction[],
  walletAddress: string | undefined,
  peerAddress: string,
): DiscoveredEscrowAction[] {
  return escrowActions.filter((item) => {
    if (
      item.action.kind !== "create" ||
      item.action.coordinationVersion !==
        REKBER_COORDINATION_VERSION
    ) {
      return false;
    }

    const incoming =
      sameStarknetAddress(
        item.action.senderAddress,
        peerAddress,
      ) &&
      sameStarknetAddress(
        item.action.recipientAddress,
        walletAddress,
      );

    const outgoing =
      sameStarknetAddress(
        item.action.senderAddress,
        walletAddress,
      ) &&
      sameStarknetAddress(
        item.action.recipientAddress,
        peerAddress,
      );

    return incoming || outgoing;
  });
}

export interface PreparedCustody {
  key: string;
  custodyCommitment: string;
}

export function selectPreparedCustodies(
  actions: DiscoveredEscrowAction[],
): PreparedCustody[] {
  return actions
    .filter((item) =>
      Boolean(
        item.action.custodyCommitment,
      ),
    )
    .map((item) => ({
      key: canonicalCustodyKey(
        item.action.custodyCommitment,
      ),
      custodyCommitment:
        item.action.custodyCommitment!,
    }));
}
