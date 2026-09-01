"use client";

import Link from "next/link";
import { WalletConnectButton } from "@/components/WalletConnectButton";

interface RoomHeaderProps {
  label: string;
  roomId: string;
}


export function RoomHeader({
  label,
  roomId,
}: RoomHeaderProps) {
  return (
    <header className="mb-4">
      <div className="flex items-center gap-2.5">
        <Link
          href="/#rooms"
          aria-label="Back to rooms"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vault/55 text-lg text-paper/55 ring-1 ring-wire/60 transition hover:text-signal hover:ring-signal/25"
        >
          ←
        </Link>

        <div className="min-w-0 flex-1">
          <p className="font-display text-[8px] uppercase tracking-[0.17em] text-signal/55">
            Private Deal Room
          </p>

          <h1 className="mt-0.5 truncate text-[18px] font-medium tracking-tight text-paper">
            {label}
          </h1>

          <p className="mt-0.5 hidden truncate font-mono text-[8px] text-paper/18 sm:block">
            {roomId}
          </p>
        </div>

        <div className="shrink-0 scale-[0.88] origin-right">
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
