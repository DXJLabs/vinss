"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  LiveTxFeed,
  type ActivitySnapshot,
} from "@/components/rooms/LiveTxFeed";

interface LocalRoom {
  id: string;
  label: string;
  roomSecret: string;
  createdAt: string;
}

const STORAGE_KEY = "vinss:local-rooms";

function isLocalRoom(value: unknown): value is LocalRoom {
  if (!value || typeof value !== "object") return false;

  const room = value as Partial<LocalRoom>;

  return (
    typeof room.id === "string" &&
    typeof room.label === "string" &&
    typeof room.roomSecret === "string" &&
    typeof room.createdAt === "string"
  );
}

function loadRooms(): LocalRoom[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed) ? parsed.filter(isLocalRoom) : [];
  } catch {
    return [];
  }
}

function saveRooms(rooms: LocalRoom[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Local room";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortRoomId(value: string) {
  if (value.length <= 15) return value;
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
}

function roomInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "PR";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function HomeWorkspace() {
  const router = useRouter();
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [creating, setCreating] = useState(false);
  const [activity, setActivity] = useState<ActivitySnapshot>({
    count: 0,
    online: false,
    lastUpdated: null,
  });

  useEffect(() => {
    setRooms(loadRooms());
  }, []);

  useEffect(() => {
    if (!launcherOpen) return;

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLauncherOpen(false);
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [launcherOpen]);

  const handleActivitySnapshot = useCallback((next: ActivitySnapshot) => {
    setActivity(next);
  }, []);

  async function createRoom() {
    if (!label.trim() || creating) return;

    setCreating(true);

    try {
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
      setLauncherOpen(false);
      router.push(`/room/${room.id}`);
    } finally {
      setCreating(false);
    }
  }

  function openInvitation() {
    const value = inviteLink.trim();
    if (!value) return;

    window.location.assign(value);
  }

  return (
    <>
      <section
        className="scroll-mt-6 border-t border-wire/80 pt-6 sm:pt-8"
        data-guide="rooms"
        id="rooms"
      >
        <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
          <div>
            <p className="font-display text-[9px] uppercase tracking-[0.28em] text-signal">
              Local workspace
            </p>
            <h2 className="mt-2 font-display text-xl uppercase tracking-[0.12em] text-paper sm:text-2xl">
              Private rooms
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-paper/38 sm:text-sm">
              One room holds one deal. Labels and room secrets stay in this
              browser.
            </p>
          </div>

          <button
            className="min-h-10 shrink-0 border border-signal bg-signal px-3 font-display text-[8px] uppercase tracking-[0.17em] text-ink transition hover:bg-transparent hover:text-signal sm:px-4 sm:text-[9px]"
            onClick={() => setLauncherOpen(true)}
            type="button"
          >
            + New room
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="overflow-hidden border border-wire/90 bg-[#090c0f]/92">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-wire/70 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-display text-[8px] uppercase tracking-[0.2em] text-paper/35">
                  Room registry
                </span>
                <span className="h-px min-w-4 flex-1 bg-wire/70" />
              </div>
              <span className="font-display text-[8px] uppercase tracking-[0.15em] text-paper/28">
                {rooms.length.toString().padStart(2, "0")} local
              </span>
            </header>

            {rooms.length === 0 ? (
              <div className="px-5 py-14 text-center sm:py-16">
                <p className="font-display text-xs uppercase tracking-[0.16em] text-paper/70">
                  No room on this device
                </p>
                <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-paper/35">
                  Create a room for a specific agreement, or open a private
                  invitation from your counterparty.
                </p>
                <button
                  className="mt-6 border border-signal px-4 py-2.5 font-display text-[8px] uppercase tracking-[0.18em] text-signal transition hover:bg-signal hover:text-ink"
                  onClick={() => setLauncherOpen(true)}
                  type="button"
                >
                  Create first room →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-wire/60">
                {rooms.map((room, index) => (
                  <article
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-stretch bg-[#0a0d10] transition hover:bg-[#0d1215]"
                    key={room.id}
                  >
                    <Link
                      className="flex min-w-0 items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                      href={`/room/${room.id}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-signal/25 bg-signal/[0.035] font-display text-[10px] text-signal">
                        {roomInitials(room.label)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-display text-[7px] text-paper/25">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="truncate font-display text-sm text-paper/90 transition group-hover:text-signal sm:text-base">
                            {room.label}
                          </h3>
                        </div>
                        <p className="mt-1.5 truncate font-display text-[7px] uppercase tracking-[0.1em] text-paper/28">
                          Created {formatDate(room.createdAt)} · {shortRoomId(room.id)}
                        </p>
                      </div>
                    </Link>

                    <div className="flex min-w-[72px] flex-col items-end justify-center border-l border-wire/50 px-3 sm:min-w-[96px] sm:px-4">
                      <span className="flex items-center gap-1.5 font-display text-[7px] uppercase tracking-[0.14em] text-signal/80">
                        <span className="h-1 w-1 rounded-full bg-signal" />
                        Private
                      </span>
                      <Link
                        className="mt-2 font-display text-[7px] uppercase tracking-[0.15em] text-paper/34 transition hover:text-signal"
                        href={`/room/${room.id}?access=1`}
                      >
                        Invite +
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <button
              className="flex w-full items-center justify-between border-t border-wire/70 px-4 py-3 text-left font-display text-[8px] uppercase tracking-[0.16em] text-paper/28 transition hover:text-signal sm:px-5"
              onClick={() => setLauncherOpen(true)}
              type="button"
            >
              <span>Open invitation or create room</span>
              <span>+</span>
            </button>
          </section>

          <aside data-guide="live-tx" id="live-tx">
            <LiveTxFeed onSnapshot={handleActivitySnapshot} />
          </aside>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-display text-[7px] uppercase tracking-[0.15em] text-paper/22">
          <span>Room secrets never enter the public feed</span>
          <span className={activity.online ? "text-signal/55" : "text-amber/55"}>
            Public index {activity.online ? "live" : "reconnecting"} · {activity.count} proofs
          </span>
        </div>
      </section>

      {launcherOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/78 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLauncherOpen(false);
          }}
        >
          <section
            aria-labelledby="room-launcher-title"
            aria-modal="true"
            className="vinss-dialog vinss-launcher relative max-h-[92vh] w-full overflow-y-auto border border-wire bg-[#090d10] p-5 sm:max-w-lg sm:p-6"
            role="dialog"
          >
            <div className="relative">
              <div className="flex items-start justify-between gap-5 border-b border-wire/70 pb-5">
                <div>
                  <p className="font-display text-[9px] uppercase tracking-[0.23em] text-signal">
                    One room · One deal
                  </p>
                  <h2
                    className="mt-2 text-xl font-medium text-paper"
                    id="room-launcher-title"
                  >
                    Create a private room
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-paper/38">
                    The label and generated room secret stay on this device.
                  </p>
                </div>

                <button
                  aria-label="Close room launcher"
                  className="flex h-9 w-9 shrink-0 items-center justify-center border border-wire font-display text-sm text-paper/40 transition hover:border-signal/50 hover:text-signal"
                  onClick={() => setLauncherOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>

              <form
                className="pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createRoom();
                }}
              >
                <label
                  className="mb-2 block font-display text-[8px] uppercase tracking-[0.19em] text-paper/38"
                  htmlFor="room-label"
                >
                  Local room label
                </label>
                <input
                  autoFocus
                  className="h-12 w-full border border-wire bg-ink/70 px-3 text-sm text-paper outline-none transition placeholder:text-paper/18 focus:border-signal/65"
                  id="room-label"
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. Supplier Agreement"
                  value={label}
                />

                <button
                  className="mt-3 flex h-12 w-full items-center justify-center border border-signal bg-signal px-4 font-display text-[9px] uppercase tracking-[0.18em] text-ink transition hover:bg-transparent hover:text-signal disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!label.trim() || creating}
                  type="submit"
                >
                  {creating ? "Creating…" : "Create and open room →"}
                </button>
              </form>

              <details className="group mt-5 border-t border-wire/70 pt-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-[9px] uppercase tracking-[0.18em] text-paper/48">
                      Have an invitation?
                    </p>
                    <p className="mt-1 text-[10px] text-paper/28">
                      Join an existing private room
                    </p>
                  </div>
                  <span className="font-display text-paper/30 transition group-open:rotate-45">
                    +
                  </span>
                </summary>

                <div className="pt-4">
                  <input
                    className="h-11 w-full border border-wire bg-ink/70 px-3 text-xs text-paper outline-none transition placeholder:text-paper/18 focus:border-signal/55"
                    onChange={(event) => setInviteLink(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        openInvitation();
                      }
                    }}
                    placeholder="Paste private invite link"
                    value={inviteLink}
                  />
                  <button
                    className="mt-3 h-11 w-full border border-wire font-display text-[9px] uppercase tracking-[0.17em] text-paper/50 transition hover:border-signal/50 hover:text-signal disabled:cursor-not-allowed disabled:opacity-25"
                    disabled={!inviteLink.trim()}
                    onClick={openInvitation}
                    type="button"
                  >
                    Open invitation →
                  </button>
                </div>
              </details>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
