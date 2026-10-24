import { parseTransactionMode, type TransactionMode } from "./transactionMode.ts";
/** Reject corrupt or conflicting persisted rails; only absent legacy mode defaults to Shield. */
export function resolvePersistedRoomMode(rooms: unknown, roomId: string, locked: unknown): TransactionMode {
  if (!Array.isArray(rooms)) throw new Error("Invalid local room storage.");
  const room = rooms.find(value => value && typeof value === "object" && value.id === roomId) as { transactionMode?: unknown } | undefined;
  const stored = parseTransactionMode(room?.transactionMode);
  if (locked !== null && locked !== undefined) {
    const pinned = parseTransactionMode(locked);
    if (room?.transactionMode !== undefined && pinned !== stored) throw new Error("Stored room mode conflicts with its locked onchain rail.");
    return pinned;
  }
  return stored;
}
