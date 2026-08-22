"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveTxFeed } from "@/components/rooms/LiveTxFeed";

/**
 * VINSS rooms are local bookkeeping only.
 * No reusable room identifier is stored publicly on-chain.
 */
interface LocalRoom {
  id: string;
  label: string;
  roomSecret: string;
  createdAt: string;
}

const STORAGE_KEY = "vinss:local-rooms";

function loadRooms(): LocalRoom[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalRoom[]) : [];
  } catch {
    return [];
  }
}

function saveRooms(rooms: LocalRoom[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [label, setLabel] = useState("");
  const [joinId, setJoinId] = useState("");
  const [joinSecret, setJoinSecret] = useState("");

  useEffect(() => {
    setRooms(loadRooms());
  }, []);

  async function createRoom() {
    if (!label.trim()) return;

    const { generateRoomSecret } = await import(
      "@/lib/privacy/channelKey"
    );

    const room: LocalRoom = {
      id: crypto.randomUUID(),
      label: label.trim(),
      roomSecret: generateRoomSecret(),
      createdAt: new Date().toISOString(),
    };

    const next = [room, ...rooms];

    setRooms(next);
    saveRooms(next);
    setLabel("");
  }

  function joinRoom() {
    if (!joinId.trim() || !joinSecret.trim()) return;

    const room: LocalRoom = {
      id: joinId.trim(),
      label: "Joined room",
      roomSecret: joinSecret.trim(),
      createdAt: new Date().toISOString(),
    };

    const next = [
      room,
      ...rooms.filter((r) => r.id !== room.id),
    ];

    setRooms(next);
    saveRooms(next);
    setJoinId("");
    setJoinSecret("");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="mb-12 flex items-end justify-between border-b border-wire pb-6 sm:mb-16">
        <div>
          <p className="mb-2 font-display text-[10px] uppercase tracking-[0.28em] text-signal/70">
            Private workspace
          </p>

          <h1 className="font-display text-3xl font-medium tracking-tight text-paper sm:text-4xl">
            Rooms
          </h1>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-paper/45">
            Private spaces for negotiation, encrypted messaging and settlement.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <Link
            href="/loyalty"
            className="group text-right transition hover:text-signal"
          >
            <span className="block font-display text-[10px] uppercase tracking-widest text-paper/35 group-hover:text-signal/70">
              Loyalty
            </span>
            <span className="mt-1 block font-display text-xs text-paper/70 group-hover:text-signal">
              0 pts →
            </span>
          </Link>

          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-paper/40 transition hover:text-signal"
          >
            <span className="hidden sm:inline">← Back to home</span>
            <span className="sm:hidden">← Home</span>
          </Link>
        </div>
      </header>

      {/* =====================================================
          DESKTOP GRID / MOBILE STACK
          ===================================================== */}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">

        {/* ===================================================
            ROOMS
            =================================================== */}

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-paper/35">
                Your rooms
              </p>

              <p className="mt-1 text-xs text-paper/25">
                Stored locally on this device
              </p>
            </div>

            <span className="font-display text-xs text-paper/25">
              {rooms.length.toString().padStart(2, "0")}
            </span>
          </div>

          {rooms.length === 0 ? (
            <div className="border border-dashed border-wire bg-vault/20 px-6 py-16 text-center sm:px-10">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-signal/20 text-signal/70">
                +
              </div>

              <h2 className="font-display text-lg text-paper/80">
                No rooms yet
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-paper/35">
                Create your first private deal room to start a negotiation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <article
                  key={room.id}
                  className="group border border-wire bg-vault/25 transition duration-200 hover:border-signal/30 hover:bg-vault/45"
                >
                  <Link
                    href={`/room/${room.id}`}
                    className="block p-5 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="mb-2 font-display text-base text-paper sm:text-lg">
                          {room.label}
                        </p>

                        <p className="text-xs text-paper/35">
                          Created {formatDate(room.createdAt)}
                        </p>
                      </div>

                      <StatusBadge tone="wire">
                        Draft
                      </StatusBadge>
                    </div>

                    <div className="mt-6 flex items-end justify-end border-t border-wire/70 pt-4">
                      <span className="shrink-0 text-xs uppercase tracking-widest text-signal/60 transition group-hover:text-signal">
                        Open room →
                      </span>
                    </div>
                  </Link>

                  <div className="border-t border-wire/50 px-5 py-3 sm:px-6">
                    <Link
                      href={`/room/${room.id}?access=1`}
                      className="text-[10px] uppercase tracking-widest text-paper/25 transition hover:text-paper/60"
                    >
                      Invite to Chat / Group →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ===================================================
            CREATE / JOIN PANEL
            =================================================== */}

        <aside className="space-y-4">

          {/* CREATE */}

          <section className="border border-signal/25 bg-signal/[0.025] p-5 sm:p-6">
            <div className="mb-6">
              <p className="font-display text-xs uppercase tracking-[0.2em] text-signal">
                New room
              </p>

              <h2 className="mt-2 text-lg text-paper">
                Create a private workspace
              </h2>

              <p className="mt-2 text-xs leading-relaxed text-paper/35">
                Choose a local label. Chat and Group invitations are created
                separately inside the room.
              </p>
            </div>

            <label className="mb-2 block text-[10px] uppercase tracking-widest text-paper/35">
              Room name
            </label>

            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createRoom();
              }}
              placeholder="e.g. Supplier Agreement"
              className="mb-3 h-12 w-full border border-wire bg-ink/50 px-3 text-sm text-paper outline-none transition placeholder:text-paper/20 focus:border-signal/60"
            />

            <button
              onClick={createRoom}
              disabled={!label.trim()}
              className="flex h-12 w-full items-center justify-center border border-signal bg-signal px-4 font-display text-xs uppercase tracking-[0.16em] text-ink transition hover:bg-transparent hover:text-signal disabled:cursor-not-allowed disabled:opacity-30"
            >
              Create room →
            </button>
          </section>

          {/* JOIN */}

          <details className="group border border-wire bg-vault/15">
            <summary className="cursor-pointer list-none px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-xs uppercase tracking-[0.18em] text-paper/45">
                    Join a room
                  </p>

                  <p className="mt-1 text-xs text-paper/25">
                    Open a private invitation shared with you
                  </p>
                </div>

                <span className="text-paper/30 transition group-open:rotate-45">
                  +
                </span>
              </div>
            </summary>

            <div className="border-t border-wire px-5 pb-5 pt-5 sm:px-6">
              <label className="mb-2 block text-[10px] uppercase tracking-widest text-paper/30">
                Invite link
              </label>

              <input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && joinId.trim()) {
                    window.location.assign(joinId.trim());
                  }
                }}
                placeholder="Paste your private invite link"
                className="mb-3 h-11 w-full border border-wire bg-ink/50 px-3 text-sm text-paper outline-none placeholder:text-paper/20 focus:border-signal/50"
              />

              <button
                type="button"
                onClick={() => {
                  if (joinId.trim()) {
                    window.location.assign(joinId.trim());
                  }
                }}
                disabled={!joinId.trim()}
                className="h-11 w-full border border-wire px-4 font-display text-xs uppercase tracking-widest text-paper/55 transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-25"
              >
                Open invitation →
              </button>

              <p className="mt-4 text-[10px] leading-relaxed text-paper/20">
                No Room ID or Room Secret is required. Your counterparty only
                needs to send you the private invitation link.
              </p>
            </div>
          </details>

          {/* PRIVACY NOTE */}

          <div className="border-t border-wire pt-5">
            <p className="font-display text-[10px] uppercase tracking-[0.18em] text-paper/25">
              Local by design
            </p>

            <p className="mt-2 text-xs leading-relaxed text-paper/25">
              Room labels and secrets are kept in your browser. VINSS does
              not maintain a public on-chain room index.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
