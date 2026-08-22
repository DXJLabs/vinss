"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

export interface DealNetworkRoom {
  id: string;
  label: string;
  createdAt: string;
}

interface DealNetworkProps {
  className?: string;
  rooms: DealNetworkRoom[];
  streamOnline: boolean;
  onCreateRoom: () => void;
}

const NODE_POSITIONS = [
  "left-[4%] top-[15%] sm:left-[8%] sm:top-[16%]",
  "right-[4%] top-[20%] sm:right-[8%] sm:top-[18%]",
  "bottom-[12%] left-[7%] sm:bottom-[13%] sm:left-[12%]",
  "bottom-[10%] right-[5%] sm:bottom-[12%] sm:right-[11%]",
];

const NODE_PATHS = [
  "M 50 50 L 20 24",
  "M 50 50 L 80 26",
  "M 50 50 L 23 76",
  "M 50 50 L 78 77",
];

const PARTICLES = [
  [12, 18, "0s"],
  [24, 65, "-1.8s"],
  [37, 12, "-3.2s"],
  [45, 82, "-0.7s"],
  [58, 21, "-4.6s"],
  [66, 73, "-2.4s"],
  [79, 11, "-5.1s"],
  [87, 56, "-1.2s"],
  [92, 83, "-3.9s"],
  [7, 88, "-2.9s"],
] as const;

function roomInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "PR";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DealNetwork({
  className = "",
  rooms,
  streamOnline,
  onCreateRoom,
}: DealNetworkProps) {
  const visibleRooms = rooms.slice(0, NODE_POSITIONS.length);

  return (
    <section className={`vinss-network-panel relative overflow-hidden border border-wire/90 bg-[#090c0f]/90 ${className}`}>
      <div className="vinss-network-grid pointer-events-none absolute inset-0" />
      <div className="vinss-network-scan pointer-events-none absolute inset-x-0 top-0 h-px" />

      {PARTICLES.map(([left, top, delay], index) => (
        <span
          aria-hidden="true"
          className="vinss-particle pointer-events-none absolute h-0.5 w-0.5 rounded-full bg-paper/45"
          key={`${left}-${top}`}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            animationDelay: delay,
            animationDuration: `${4.6 + (index % 4) * 0.7}s`,
          }}
        />
      ))}

      <div className="relative z-10 flex items-start justify-between gap-4 border-b border-wire/70 px-4 py-4 sm:px-5">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.24em] text-paper/38">
            Deal topology
          </p>
          <p className="mt-1 font-display text-xs uppercase tracking-[0.16em] text-paper/75">
            Local private network
          </p>
        </div>

        <div className="flex items-center gap-2 font-display text-[9px] uppercase tracking-[0.18em] text-signal">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              streamOnline
                ? "vinss-live-dot bg-signal"
                : "bg-paper/20"
            }`}
          />
          {streamOnline ? "Index live" : "Connecting"}
        </div>
      </div>

      <div className="relative z-10 h-[310px] sm:h-[380px]">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <circle
            className="vinss-orbit-line"
            cx="50"
            cy="50"
            fill="none"
            r="19"
          />
          <circle
            className="vinss-orbit-line vinss-orbit-line--wide"
            cx="50"
            cy="50"
            fill="none"
            r="31"
          />

          {visibleRooms.map((room, index) => (
            <path
              className="vinss-network-link"
              d={NODE_PATHS[index]}
              key={room.id}
            />
          ))}

          {visibleRooms.map((room, index) => (
            <circle
              className="vinss-data-packet"
              key={`packet-${room.id}`}
              r="0.75"
            >
              <animateMotion
                begin={`${index * -0.7}s`}
                dur={`${2.35 + index * 0.3}s`}
                path={NODE_PATHS[index]}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center sm:h-36 sm:w-36">
          {[0, 1, 2].map((pulse) => (
            <span
              aria-hidden="true"
              className="vinss-core-pulse absolute inset-5 rounded-full border border-signal/35"
              key={pulse}
              style={{ animationDelay: `${pulse * -1.05}s` }}
            />
          ))}
          <div className="vinss-radar-field absolute inset-2 overflow-hidden rounded-full border border-signal/10">
            <div className="vinss-radar-sweep absolute inset-0" />
          </div>
          <div className="vinss-core-ring absolute inset-0 rounded-full border border-signal/25" />
          <div className="vinss-core-ring vinss-core-ring--inner absolute inset-3 rounded-full border border-signal/20" />
          <div className="relative flex h-14 w-14 flex-col items-center justify-center rounded-full border border-signal/55 bg-[#0b1213] shadow-[0_0_46px_rgba(94,234,212,.16)] sm:h-[72px] sm:w-[72px]">
            <span className="font-display text-base tracking-[0.12em] text-signal sm:text-lg">
              V
            </span>
            <span className="mt-0.5 font-display text-[6px] uppercase tracking-[0.18em] text-paper/35 sm:text-[7px]">
              core
            </span>
          </div>
        </div>

        {visibleRooms.map((room, index) => (
          <Link
            aria-label={`Open ${room.label}`}
            className={`vinss-deal-node group absolute w-[106px] border border-wire bg-[#0d1115]/95 p-2.5 shadow-[0_14px_36px_rgba(0,0,0,.34)] transition hover:border-signal/55 hover:bg-[#101719] sm:w-36 sm:p-3 ${NODE_POSITIONS[index]}`}
            href={`/room/${room.id}`}
            key={room.id}
            style={{
              "--vinss-node-delay": `${index * -1.1}s`,
            } as CSSProperties}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-signal/25 bg-signal/[0.045] font-display text-[8px] text-signal sm:h-7 sm:w-7 sm:text-[9px]">
                {roomInitials(room.label)}
              </span>
              <span className="flex items-center gap-1 font-display text-[6px] uppercase tracking-[0.16em] text-signal/70 sm:text-[7px]">
                <span className="vinss-live-dot h-1 w-1 rounded-full bg-signal" />
                Private
              </span>
            </div>
            <p className="mt-2 truncate font-display text-[10px] text-paper/80 transition group-hover:text-paper sm:text-xs">
              {room.label}
            </p>
            <p className="mt-1 font-display text-[6px] uppercase tracking-[0.16em] text-paper/25 sm:text-[7px]">
              Open channel →
            </p>
          </Link>
        ))}

        {rooms.length === 0 && (
          <div className="absolute inset-x-5 bottom-5 text-center sm:bottom-7">
            <p className="text-xs text-paper/35">
              No local room nodes detected.
            </p>
            <button
              className="mt-3 font-display text-[10px] uppercase tracking-[0.2em] text-signal transition hover:text-paper"
              onClick={onCreateRoom}
              type="button"
            >
              Initialize first room →
            </button>
          </div>
        )}

        {rooms.length > visibleRooms.length && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 border border-wire bg-ink/90 px-2.5 py-1 font-display text-[8px] uppercase tracking-[0.16em] text-paper/40">
            +{rooms.length - visibleRooms.length} more nodes
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-wire/70 px-4 py-3 font-display text-[8px] uppercase tracking-[0.18em] text-paper/25 sm:px-5">
        <span>{rooms.length.toString().padStart(2, "0")} local nodes</span>
        <span className="text-signal/55">Room secrets never enter the feed</span>
      </div>
    </section>
  );
}
