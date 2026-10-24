"use client";

import Link from "next/link";
import { useState } from "react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useWallet } from "@/components/providers/WalletProvider";
import { UnshieldPanel } from "@/components/room/UnshieldPanel";

interface RoomHeaderProps {
  label: string;
  roomId: string;
}


export function RoomHeader({
  label,
  roomId,
}: RoomHeaderProps) {
  const { session } = useWallet();
  const [unshieldOpen, setUnshieldOpen] = useState(false);

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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-wire/60 bg-vault/25 px-3 py-2.5">
        <p className="text-[10px] text-paper/45">Transaction mode</p>
        <div role="group" aria-label="STRK20 transaction mode" className="flex gap-1 rounded-lg bg-ink/50 p-1">
          <button type="button" aria-pressed={!unshieldOpen}
            onClick={() => setUnshieldOpen(false)}
            className={unshieldOpen
              ? "rounded-md px-3 py-2 text-[10px] text-paper/45"
              : "rounded-md bg-signal/10 px-3 py-2 text-[10px] font-medium text-signal"}>
            Private · STRK20
          </button>
          <button type="button" aria-pressed={unshieldOpen}
            onClick={() => setUnshieldOpen(true)}
            className={unshieldOpen
              ? "rounded-md bg-signal/10 px-3 py-2 text-[10px] font-medium text-signal"
              : "rounded-md px-3 py-2 text-[10px] text-paper/45"}>
            Unshield
          </button>
        </div>
      </div>
      {unshieldOpen && <UnshieldPanel session={session} />}
    </header>
  );
}
