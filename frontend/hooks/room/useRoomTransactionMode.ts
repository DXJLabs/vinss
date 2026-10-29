"use client";
import { useEffect, useState } from "react";
import { parseTransactionMode, type TransactionMode } from "@/lib/starknet/transactionMode";
import { resolvePersistedRoomMode } from "@/lib/starknet/roomMode";

export function useRoomTransactionMode(roomId: string) {
  const [mode, setMode] = useState<TransactionMode>("shield");
  const [loadedRoomId, setLoadedRoomId] = useState<string | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);
  useEffect(() => {
    setLoadedRoomId(null);
    setModeError(null);
    try {
      const rooms: unknown = JSON.parse(window.localStorage.getItem("vinss:local-rooms") ?? "[]");
      setMode(resolvePersistedRoomMode(rooms, roomId, window.localStorage.getItem(`vinss:rail-lock:${roomId}`)));
    } catch {
      setModeError("This room's transaction mode cannot be verified. Restore its correct local room data before transacting.");
    }
    setLoadedRoomId(roomId);
  }, [roomId]);
  function changeMode(next: TransactionMode) {
    if (modeError || loadedRoomId !== roomId) throw new Error("Room mode is not verified.");
    parseTransactionMode(next);
    const rooms = JSON.parse(window.localStorage.getItem("vinss:local-rooms") ?? "[]") as Array<{ id: string; transactionMode?: TransactionMode }>;
    if (!rooms.some(room => room.id === roomId)) throw new Error("Local room is missing.");
    window.localStorage.setItem("vinss:local-rooms", JSON.stringify(rooms.map(room => room.id === roomId ? { ...room, transactionMode: next } : room)));
    window.localStorage.removeItem(`vinss:rail-lock:${roomId}`);
    setMode(next);
  }
  return { mode, hydrated: loadedRoomId === roomId, changeMode, modeError };
}
