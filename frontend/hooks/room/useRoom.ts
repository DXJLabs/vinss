"use client";

import { useEffect, useState } from "react";
import { deriveChannelKeyFromRoomSecret } from "@/lib/privacy/channelKey";

export interface LocalRoom {
  id: string;
  label: string;
  roomSecret: string;
  createdAt: string;
}

function loadRoom(roomId: string): LocalRoom | null {
  if (typeof window === "undefined") return null;

  // Read persisted room state defensively because local storage may contain stale data.
  try {
    // Load the serialized rooms stored only on this device.
    const raw = window.localStorage.getItem("vinss:local-rooms");
    const rooms = raw ? (JSON.parse(raw) as LocalRoom[]) : [];
    // Return only the room requested by the current route.
    return rooms.find((room) => room.id === roomId) ?? null;
  } catch (err) {
    console.error("[VINSS ROOM LOAD]", err);
    return null;
  }
}

export function useRoom(roomId: string) {
  const [room, setRoom] = useState<LocalRoom | null>(null);
  const [channelKey, setChannelKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    let cancelled = false;

    const nextRoom = loadRoom(roomId);
    setRoom(nextRoom);
    // Clear the previous room key so it cannot be reused across room changes.
    setChannelKey(null);

    // Stop before key derivation when this device does not know the room.
    if (!nextRoom) return;

    // Derive the in-memory encryption key from the persisted room secret.
    deriveChannelKeyFromRoomSecret(nextRoom.roomSecret)
      .then((key) => {
        // Ignore stale async results after the route changes or the component unmounts.
        if (!cancelled) setChannelKey(key);
      })
      .catch((err) => {
        // Keep the technical failure in developer diagnostics without exposing the key.
        console.error("[VINSS CHANNEL KEY]", err);
      });

    return () => {
      // Mark this effect as stale so a late derivation result cannot update state.
      cancelled = true;
    };
  }, [roomId]);

  return { room, channelKey };
}
