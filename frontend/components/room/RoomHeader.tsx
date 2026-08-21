"use client";

import Link from "next/link";
import { WalletConnectButton } from "@/components/WalletConnectButton";

interface RoomHeaderProps {
  label: string;
  roomId: string;
  participantCount?: number;
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9.3 12 1.8 1.8 3.7-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3" />
      <path
        d="M3.5 19a5.5 5.5 0 0 1 11 0"
        strokeLinecap="round"
      />
      <path
        d="M16 6.5a2.7 2.7 0 0 1 0 5.2M17 14.5a4.7 4.7 0 0 1 3.5 4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RoomHeader({
  label,
  roomId,
  participantCount = 0,
}: RoomHeaderProps) {
  return (
    <header className="mb-4">
      <div className="flex items-center gap-2.5">
        <Link
          href="/rooms"
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

      <div className="mt-3 flex items-center gap-2.5 pl-[50px] text-[10px] text-paper/35">
        <span
          className="inline-flex items-center gap-1.5 text-signal/65"
          title="End-to-end encrypted"
        >
          <ShieldIcon />
          Encrypted
        </span>

        {participantCount > 0 && (
          <>
            <span
              className="text-paper/18"
              aria-hidden="true"
            >
              ·
            </span>

            <span className="inline-flex items-center gap-1.5">
              <PeopleIcon />
              {participantCount} participant{participantCount === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
