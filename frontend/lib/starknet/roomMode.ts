import { parseTransactionMode, type TransactionMode } from "./transactionMode.ts";
/** The saved preference selects the next send. Legacy locks are migration hints only. */
export function resolvePersistedRoomMode(rooms: unknown, roomId: string, legacyLock: unknown): TransactionMode {
  if (!Array.isArray(rooms)) throw new Error("Invalid local room storage.");
  const room = rooms.find(value => value && typeof value === "object" && value.id === roomId) as { transactionMode?: unknown } | undefined;
  if (room?.transactionMode !== undefined) return parseTransactionMode(room.transactionMode);
  return parseTransactionMode(legacyLock ?? undefined);
}
