import {
  generateRoomSecret,
} from "@/lib/privacy/channelKey";
import {
  canonicalStarknetAddress,
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";

export type GroupRole =
  | "admin"
  | "member";

export interface LocalGroupMember {
  address: string;
  role: GroupRole;
  joinedAt: string;
}

export interface LocalRoomGroup {
  id: string;
  roomId: string;
  name: string;
  groupSecret: string;
  ownerAddress: string;
  createdAt: string;
  members: LocalGroupMember[];
}

const STORAGE_PREFIX =
  "vinss:local-groups:v1:";

function storageKey(
  roomId: string,
): string {
  return `${STORAGE_PREFIX}${roomId}`;
}

export function loadLocalGroups(
  roomId: string,
): LocalRoomGroup[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        storageKey(roomId),
      );

    const parsed = raw
      ? (JSON.parse(raw) as LocalRoomGroup[])
      : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (group) =>
        group?.id &&
        group?.roomId === roomId &&
        group?.name &&
        group?.groupSecret &&
        group?.ownerAddress &&
        Array.isArray(group.members),
    );
  } catch {
    return [];
  }
}

export function saveLocalGroups(
  roomId: string,
  groups: LocalRoomGroup[],
): void {
  window.localStorage.setItem(
    storageKey(roomId),
    JSON.stringify(groups),
  );
}

function mergeMembers(
  existing: LocalGroupMember[],
  incoming: LocalGroupMember[],
): LocalGroupMember[] {
  const merged =
    new Map<string, LocalGroupMember>();

  for (const member of [
    ...existing,
    ...incoming,
  ]) {
    if (!member?.address) continue;

    const key =
      canonicalStarknetAddress(
        member.address,
      );

    const previous =
      merged.get(key);

    merged.set(key, {
      ...previous,
      ...member,
      role:
        previous?.role === "admin" ||
        member.role === "admin"
          ? "admin"
          : "member",
    });
  }

  return [...merged.values()];
}

export function createLocalGroup(
  roomId: string,
  name: string,
  ownerAddress: string,
): LocalRoomGroup {
  const now =
    new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    roomId,
    name: name.trim(),
    groupSecret:
      generateRoomSecret(),
    ownerAddress,
    createdAt: now,
    members: [
      {
        address: ownerAddress,
        role: "admin",
        joinedAt: now,
      },
    ],
  };
}

export function upsertLocalGroup(
  roomId: string,
  group: LocalRoomGroup,
): LocalRoomGroup[] {
  const current =
    loadLocalGroups(roomId);

  const existing =
    current.find(
      (item) =>
        item.id === group.id,
    );

  const normalized: LocalRoomGroup = {
    ...existing,
    ...group,
    roomId,
    members: mergeMembers(
      existing?.members ?? [],
      group.members ?? [],
    ),
  };

  const next = [
    normalized,
    ...current.filter(
      (item) =>
        item.id !== group.id,
    ),
  ];

  saveLocalGroups(roomId, next);
  return next;
}

export function addOrUpdateGroupMember(
  group: LocalRoomGroup,
  member: LocalGroupMember,
): LocalRoomGroup {
  return {
    ...group,
    members: mergeMembers(
      group.members,
      [member],
    ),
  };
}

export function isGroupAdmin(
  group: LocalRoomGroup,
  address:
    | string
    | null
    | undefined,
): boolean {
  return sameStarknetAddress(
    group.ownerAddress,
    address,
  );
}
