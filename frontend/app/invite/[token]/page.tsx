"use client";

import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";
import {
  decodeInviteToken,
} from "@/lib/vinss-sdk/invite";

interface LocalRoom {
  id: string;
  label: string;
  roomSecret: string;
  createdAt: string;
}

const ROOM_STORAGE_KEY = "vinss:local-rooms";
const CONSUMED_STORAGE_KEY =
  "vinss:consumed-invites:v2";

function loadConsumedInviteIds(): string[] {
  try {
    const raw = window.localStorage.getItem(
      CONSUMED_STORAGE_KEY,
    );

    return raw
      ? (JSON.parse(raw) as string[])
      : [];
  } catch {
    return [];
  }
}

function markInviteConsumed(inviteId: string) {
  const existing = loadConsumedInviteIds();

  const next = [
    inviteId,
    ...existing.filter((id) => id !== inviteId),
  ].slice(0, 100);

  window.localStorage.setItem(
    CONSUMED_STORAGE_KEY,
    JSON.stringify(next),
  );
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = params.token;

      if (!token) {
        setError("Invalid invitation.");
        return;
      }

      // #k never reached the HTTP server. Read it only in the browser.
      const fragment = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );

      const inviteKey = fragment.get("k");

      // Remove the secret fragment from the visible address/history as
      // early as possible after reading it.
      window.history.replaceState(
        null,
        "",
        window.location.pathname,
      );

      if (!inviteKey) {
        setError(
          "This invitation is missing its private access key.",
        );
        return;
      }

      const invite = await decodeInviteToken(
        token,
        inviteKey,
      );

      if (cancelled) return;

      if (!invite) {
        setError(
          "This invitation is invalid, corrupted, or expired.",
        );
        return;
      }

      const consumed = loadConsumedInviteIds();

      if (consumed.includes(invite.inviteId)) {
        setError(
          "This invitation has already been used on this device.",
        );
        return;
      }

      try {
        const room: LocalRoom = {
          id: invite.roomId,
          label: invite.label || "Joined room",
          roomSecret: invite.roomSecret,
          createdAt: new Date().toISOString(),
        };

        const raw = window.localStorage.getItem(
          ROOM_STORAGE_KEY,
        );

        const rooms = raw
          ? (JSON.parse(raw) as LocalRoom[])
          : [];

        const next = [
          room,
          ...rooms.filter(
            (existing) => existing.id !== room.id,
          ),
        ];

        window.localStorage.setItem(
          ROOM_STORAGE_KEY,
          JSON.stringify(next),
        );

        markInviteConsumed(invite.inviteId);

        router.replace(`/room/${room.id}`);
      } catch {
        setError(
          "The invitation was decrypted but could not be stored.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.token, router]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-10">
        <section className="w-full border border-wire bg-vault/30 p-6 sm:p-8">
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-danger">
            Invitation unavailable
          </p>

          <h1 className="mt-3 font-display text-2xl text-paper">
            This private invite cannot be opened
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-paper/40">
            {error}
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex h-11 items-center justify-center border border-wire px-5 font-display text-xs uppercase tracking-widest text-paper/60 transition hover:border-signal hover:text-signal"
          >
            Back to VINSS
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.22em] text-signal">
          Encrypted invitation
        </p>

        <p className="mt-3 font-display text-xs uppercase tracking-widest text-paper/30">
          Decrypting private room access…
        </p>
      </div>
    </main>
  );
}
