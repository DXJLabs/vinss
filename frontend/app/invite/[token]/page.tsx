"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { decodeInviteToken } from "@/lib/vinss-sdk/invite";

interface LocalRoom {
  id: string;
  label: string;
  roomSecret: string;
  createdAt: string;
}

const STORAGE_KEY = "vinss:local-rooms";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();

  const [error, setError] = useState(false);

  useEffect(() => {
    const token = params.token;

    if (!token) {
      setError(true);
      return;
    }

    const invite = decodeInviteToken(token);

    if (!invite) {
      setError(true);
      return;
    }

    try {
      const room: LocalRoom = {
        id: invite.roomId,
        label: invite.label || "Joined room",
        roomSecret: invite.roomSecret,
        createdAt: new Date().toISOString(),
      };

      const raw = window.localStorage.getItem(STORAGE_KEY);
      const rooms = raw ? (JSON.parse(raw) as LocalRoom[]) : [];

      const next = [
        room,
        ...rooms.filter((existing) => existing.id !== room.id),
      ];

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      router.replace(`/room/${room.id}`);
    } catch {
      setError(true);
    }
  }, [params.token, router]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-10">
        <section className="w-full border border-wire bg-vault/30 p-6 sm:p-8">
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-danger">
            Invalid invitation
          </p>

          <h1 className="mt-3 font-display text-2xl text-paper">
            This invite is no longer valid
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-paper/40">
            The invitation link could not be opened. Ask your counterparty
            to create a new invitation.
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
          Private invitation
        </p>

        <p className="mt-3 font-display text-xs uppercase tracking-widest text-paper/30">
          Joining private room…
        </p>
      </div>
    </main>
  );
}
