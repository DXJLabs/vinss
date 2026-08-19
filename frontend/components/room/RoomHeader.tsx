"use client";

import Link from "next/link";
import { WalletConnectButton } from "@/components/WalletConnectButton";

interface RoomHeaderProps {
  label: string;
  roomId: string;
}

export function RoomHeader({ label, roomId }: RoomHeaderProps) {
  return (
    <div className="mb-8 border-b border-wire pb-6">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <Link
            href="/rooms"
            className="text-xs text-paper/40 transition hover:text-signal"
          >
            ← Rooms
          </Link>

          <h1 className="mt-2 font-display text-xl tracking-tight text-paper">
            {label}{" "}
            <span className="text-paper/30">
              #{roomId.slice(0, 8)}
            </span>
          </h1>
        </div>

        <div className="shrink-0">
          <WalletConnectButton />
        </div>
      </div>
    </div>
  );
}
