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

const ROOM_ICON_COUNT = 6;

function roomIconIndex(roomId: string) {
  let hash = 0;

  for (let index = 0; index < roomId.length; index += 1) {
    hash = (hash * 31 + roomId.charCodeAt(index)) >>> 0;
  }

  return hash % ROOM_ICON_COUNT;
}

function RoomIcon({ variant }: { variant: number }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.5,
  };

  if (variant === 0) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
        <path d="M12 3.5 18.5 6v5c0 4.1-2.5 7.1-6.5 9-4-1.9-6.5-4.9-6.5-9V6L12 3.5Z" />
        <path d="m9.2 12 1.8 1.8 3.9-4" />
      </svg>
    );
  }

  if (variant === 1) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
        <circle cx="8" cy="12" r="3" />
        <path d="M11 12h8m-2 0v2m-3-2v2" />
      </svg>
    );
  }

  if (variant === 2) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
        <path d="M5 8.5h14v10H5z" />
        <path d="M9 8.5V6.7c0-.7.6-1.2 1.2-1.2h3.6c.7 0 1.2.6 1.2 1.2v1.8M5 12h14" />
      </svg>
    );
  }

  if (variant === 3) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
        <path d="M7 4.5h7l3 3V19.5H7z" />
        <path d="M14 4.5v3h3M9.5 12h5M9.5 15h4" />
      </svg>
    );
  }

  if (variant === 4) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
        <path d="M8.5 14.5 5 18m10.5-8.5L19 6" />
        <path d="M8 6.5h4.5v4.5H8zM11.5 13h4.5v4.5h-4.5z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      <path d="M8.7 14.7 7 16.4a3 3 0 0 1-4.2-4.2l3-3A3 3 0 0 1 10 9" />
      <path d="m15.3 9.3 1.7-1.7a3 3 0 0 1 4.2 4.2l-3 3A3 3 0 0 1 14 15" />
      <path d="m9 15 6-6" />
    </svg>
  );
}

export function HomeWorkspace() {
  const router = useRouter();
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [creating, setCreating] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<LocalRoom | null>(null);
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
      const { generateRoomSecret } = await import("@/lib/privacy/channelKey");
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

  function deleteLocalRoom(room: LocalRoom) {
    const next = rooms.filter((entry) => entry.id !== room.id);
    setRooms(next);
    saveRooms(next);

    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (
        key &&
        key !== STORAGE_KEY &&
        key.startsWith("vinss:") &&
        key.includes(room.id)
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) window.localStorage.removeItem(key);
    setRoomToDelete(null);
  }

  return (
    <>
      <section className="relative scroll-mt-6 pt-7 sm:pt-9" data-guide="rooms" id="rooms">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden bg-wire/60">
          <span className="vinss-network-scan absolute inset-y-0 left-0 w-full" />
        </div>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-[0_0_14px_rgba(94,234,212,.85)]" />
              <p className="font-display text-[9px] uppercase tracking-[0.28em] text-signal">
                Local workspace
              </p>
            </div>
            <h2 className="mt-3 font-display text-[1.45rem] uppercase tracking-[0.16em] text-paper sm:text-2xl">
              Private rooms
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-paper/45 sm:text-sm">
              One private room for each deal. Labels and room secrets stay on this device.
            </p>
          </div>

          <button
            className="group inline-flex min-h-11 self-start items-center gap-3 rounded-lg border border-signal/70 bg-signal px-4 font-display text-[8px] uppercase tracking-[0.17em] text-ink shadow-[0_12px_32px_rgba(34,231,211,.10)] transition hover:-translate-y-0.5 hover:bg-transparent hover:text-signal sm:self-auto sm:text-[9px]"
            onClick={() => setLauncherOpen(true)}
            type="button"
          >
            <span className="text-base leading-none transition group-hover:rotate-90">+</span>
            New room
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="relative overflow-hidden rounded-xl border border-[#315069]/70 bg-[linear-gradient(180deg,rgba(6,14,20,.96),rgba(5,10,15,.94))] shadow-[inset_0_1px_0_rgba(255,255,255,.025),0_28px_80px_rgba(0,0,0,.18)]">
            <div className="vinss-network-scan pointer-events-none absolute inset-x-0 top-0 h-px" />

            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[#294255]/70 px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="font-display text-[8px] uppercase tracking-[0.2em] text-paper/48">
                  Room registry
                </span>
                <span className="h-px min-w-4 flex-1 bg-gradient-to-r from-wire/75 to-transparent" />
              </div>
              <span className="rounded-full border border-wire/70 bg-black/20 px-2.5 py-1 font-display text-[7px] uppercase tracking-[0.14em] text-paper/34">
                {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
              </span>
            </header>

            {rooms.length === 0 ? (
              <div className="relative px-5 py-12 text-center sm:py-14">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-signal/15 bg-signal/[0.035] text-signal/70 shadow-[0_0_40px_rgba(94,234,212,.04)]">
                  <span className="font-display text-sm">00</span>
                </div>
                <p className="mt-5 font-display text-[11px] uppercase tracking-[0.16em] text-paper/72">
                  No room on this device
                </p>
                <p className="mx-auto mt-3 max-w-sm text-xs leading-5 text-paper/34">
                  Create a room for a specific agreement, or open a private invitation from your counterparty.
                </p>
                <button
                  className="mt-6 rounded-lg border border-signal/60 bg-signal/[0.045] px-4 py-2.5 font-display text-[8px] uppercase tracking-[0.18em] text-signal transition hover:bg-signal hover:text-ink"
                  onClick={() => setLauncherOpen(true)}
                  type="button"
                >
                  Create first room →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#243744]/70">
                {rooms.map((room, index) => (
                  <article
                    className="vinss-feed-entry group relative grid grid-cols-[minmax(0,1fr)_auto] items-stretch bg-[#071016]/70 transition hover:bg-[#0a151c]"
                    key={room.id}
                    style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
                  >
                    <Link
                      className="flex min-w-0 items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                      href={`/room/${room.id}`}
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-signal/25 bg-[radial-gradient(circle,rgba(94,234,212,.08),rgba(94,234,212,.018))] text-signal shadow-[inset_0_0_20px_rgba(94,234,212,.03)] [&_svg]:h-5 [&_svg]:w-5">
                        <RoomIcon variant={roomIconIndex(room.id)} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="font-display text-[7px] text-paper/22">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="truncate font-display text-sm text-paper/90 transition group-hover:text-signal sm:text-base">
                            {room.label}
                          </h3>
                        </div>
                        <p className="mt-1.5 truncate font-display text-[7px] uppercase tracking-[0.1em] text-paper/28">
                          {formatDate(room.createdAt)} · {shortRoomId(room.id)}
                        </p>
                      </div>
                    </Link>

                    <div className="flex min-w-[80px] flex-col items-end justify-center border-l border-[#263a47]/60 px-3 sm:min-w-[100px] sm:px-4">
                      <span className="flex items-center gap-1.5 rounded-full border border-signal/15 bg-signal/[0.025] px-2 py-1 font-display text-[7px] uppercase tracking-[0.14em] text-signal/80">
                        <span className="vinss-live-dot h-1.5 w-1.5 rounded-full bg-signal" />
                        Private
                      </span>
                      <button
                        className="mt-2.5 font-display text-[7px] uppercase tracking-[0.15em] text-danger/48 transition hover:text-danger"
                        onClick={() => setRoomToDelete(room)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <button
              className="group flex w-full items-center justify-between border-t border-[#294255]/70 px-4 py-3.5 text-left font-display text-[8px] uppercase tracking-[0.16em] text-paper/34 transition hover:bg-signal/[0.025] hover:text-signal sm:px-5"
              onClick={() => setLauncherOpen(true)}
              type="button"
            >
              <span>Open invitation</span>
              <span className="text-sm transition group-hover:rotate-90">+</span>
            </button>
          </section>

          <aside data-guide="live-tx" id="live-tx">
            <LiveTxFeed onSnapshot={handleActivitySnapshot} />
          </aside>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-wire/45 bg-black/15 px-3 py-2.5 font-display text-[7px] uppercase tracking-[0.14em] text-paper/24">
          <span>Room secrets never enter the public feed</span>
          <span className={`flex items-center gap-2 ${activity.online ? "text-signal/58" : "text-amber/58"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${activity.online ? "vinss-live-dot bg-signal" : "bg-amber"}`} />
            Public index {activity.online ? "live" : "reconnecting"} · {activity.count} proofs
          </span>
        </div>
      </section>

      {roomToDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/78 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRoomToDelete(null);
          }}
        >
          <section
            aria-labelledby="delete-room-title"
            aria-modal="true"
            className="vinss-dialog w-full rounded-t-2xl border border-wire bg-[#090d10] p-5 sm:max-w-md sm:rounded-xl sm:p-6"
            role="dialog"
          >
            <p className="font-display text-[8px] uppercase tracking-[0.2em] text-danger/70">Local room</p>
            <h2 className="mt-2 text-xl font-medium text-paper" id="delete-room-title">Delete this room?</h2>
            <p className="mt-2 font-display text-[10px] uppercase tracking-[0.12em] text-paper/55">{roomToDelete.label}</p>
            <p className="mt-4 text-xs leading-5 text-paper/38">
              This removes the room, room secret, and VINSS local data from this browser. On-chain transactions and proofs are not deleted.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                className="min-h-11 rounded-lg border border-wire font-display text-[8px] uppercase tracking-[0.16em] text-paper/45 transition hover:border-paper/35 hover:text-paper"
                onClick={() => setRoomToDelete(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-11 rounded-lg border border-danger/60 bg-danger/10 font-display text-[8px] uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-ink"
                onClick={() => deleteLocalRoom(roomToDelete)}
                type="button"
              >
                Delete room
              </button>
            </div>
          </section>
        </div>
      )}

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
            className="vinss-dialog vinss-launcher relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-wire bg-[#090d10] p-5 sm:max-w-lg sm:rounded-xl sm:p-6"
            role="dialog"
          >
            <div className="relative">
              <div className="flex items-start justify-between gap-5 border-b border-wire/70 pb-5">
                <div>
                  <p className="font-display text-[9px] uppercase tracking-[0.23em] text-signal">One room · One deal</p>
                  <h2 className="mt-2 text-xl font-medium text-paper" id="room-launcher-title">Create a private room</h2>
                  <p className="mt-2 text-xs leading-5 text-paper/38">The label and generated room secret stay on this device.</p>
                </div>
                <button
                  aria-label="Close room launcher"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-wire font-display text-sm text-paper/40 transition hover:border-signal/50 hover:text-signal"
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
                <label className="mb-2 block font-display text-[8px] uppercase tracking-[0.19em] text-paper/38" htmlFor="room-label">
                  Local room label
                </label>
                <input
                  autoFocus
                  className="h-12 w-full rounded-lg border border-wire bg-ink/70 px-3 text-sm text-paper outline-none transition placeholder:text-paper/18 focus:border-signal/65"
                  id="room-label"
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. Supplier Agreement"
                  value={label}
                />
                <button
                  className="mt-3 flex h-12 w-full items-center justify-center rounded-lg border border-signal bg-signal px-4 font-display text-[9px] uppercase tracking-[0.18em] text-ink transition hover:bg-transparent hover:text-signal disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!label.trim() || creating}
                  type="submit"
                >
                  {creating ? "Creating…" : "Create and open room →"}
                </button>
              </form>

              <details className="group mt-5 border-t border-wire/70 pt-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-[9px] uppercase tracking-[0.18em] text-paper/48">Have an invitation?</p>
                    <p className="mt-1 text-[10px] text-paper/28">Join an existing private room</p>
                  </div>
                  <span className="font-display text-paper/30 transition group-open:rotate-45">+</span>
                </summary>
                <div className="pt-4">
                  <input
                    className="h-11 w-full rounded-lg border border-wire bg-ink/70 px-3 text-xs text-paper outline-none transition placeholder:text-paper/18 focus:border-signal/55"
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
                    className="mt-3 h-11 w-full rounded-lg border border-wire font-display text-[9px] uppercase tracking-[0.17em] text-paper/50 transition hover:border-signal/50 hover:text-signal disabled:cursor-not-allowed disabled:opacity-25"
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
