"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import type { ConversationParticipant } from "@/components/room/conversation/types";
import { ConversationAvatarIcon } from "@/components/room/conversation/ConversationAvatarIcon";
import {
  resolveStarkAddress,
} from "@/lib/starknet/identity";
import {
  sameStarknetAddress,
} from "@/lib/privacy/participantKeys";
import {
  useStarkIdentity,
} from "@/hooks/useStarkIdentity";

interface DirectConversationListProps {
  roomId: string;
  canInvite: boolean;
  participants: ConversationParticipant[];
  onOpenChat: (address: string) => void;
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path
        d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DirectParticipantRow({
  participant,
  onOpen,
}: {
  participant: ConversationParticipant;
  onOpen: () => void;
}) {
  const {
    label,
    profilePicture,
  } = useStarkIdentity(
    participant.address,
  );

  const [avatarFailed, setAvatarFailed] =
    useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [profilePicture]);

  /*
   * Starknet ID avatars are presentation-only. The row key, click target,
   * routing identity, and every later VINSS action continue to use the
   * participant's canonical Starknet address.
   */
  const showRemoteAvatar =
    Boolean(profilePicture) &&
    !avatarFailed &&
    !/\/identicons\/0(?:$|[?#])/i.test(
      profilePicture ?? "",
    );

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-signal/[0.035]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-signal/[0.045] text-signal/75 ring-1 ring-signal/15">
        {showRemoteAvatar ? (
          <img
            src={
              profilePicture ??
              undefined
            }
            alt=""
            referrerPolicy="no-referrer"
            onError={() =>
              setAvatarFailed(true)
            }
            className="h-full w-full object-cover"
          />
        ) : (
          <ConversationAvatarIcon
            seed={`chat:${participant.address}`}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm text-paper/72"
          title={participant.address}
        >
          {label}
        </p>
      </div>

      <span
        className="text-paper/25"
        aria-hidden="true"
      >
        →
      </span>
    </button>
  );
}

export function DirectConversationList({
  roomId,
  canInvite,
  participants,
  onOpenChat,
}: DirectConversationListProps) {
  const [
    identityQuery,
    setIdentityQuery,
  ] = useState("");

  const [
    identityBusy,
    setIdentityBusy,
  ] = useState(false);

  const [
    identityError,
    setIdentityError,
  ] = useState<string | null>(
    null,
  );

  async function openIdentity() {
    const query =
      identityQuery.trim();

    if (!query) {
      return;
    }

    setIdentityBusy(true);
    setIdentityError(null);

    try {
      let address: string | null =
        query;

      if (
        !query
          .toLowerCase()
          .startsWith("0x")
      ) {
        address =
          await resolveStarkAddress(
            query,
          );
      }

      if (!address) {
        setIdentityError(
          "Starknet ID not found.",
        );
        return;
      }

      /*
       * Resolving a .stark name never grants access. VINSS only opens the
       * conversation if the resolved address is already an admitted room
       * participant, preserving the existing one-time invite boundary.
       */
      const participant =
        participants.find(
          (item) =>
            sameStarknetAddress(
              item.address,
              address,
            ),
        );

      if (!participant) {
        setIdentityError(
          "This identity has not joined this room.",
        );
        return;
      }

      onOpenChat(
        participant.address,
      );
    } finally {
      setIdentityBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-b-2xl border border-t-0 border-wire/70 bg-black/[0.08]">
      {participants.length === 0 ? (
        <div className="flex min-h-[245px] flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal/[0.07] text-signal/80 ring-1 ring-signal/15">
            <ChatIcon />
          </div>

          <h3 className="mt-4 text-base font-medium text-paper/75">
            Start a private chat
          </h3>

          <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-paper/35">
            Invite one person to begin an encrypted 1-to-1 conversation.
          </p>

          {canInvite && (
            <Link
              href={`/room/${roomId}?access=chat`}
              className="mt-5 rounded-xl bg-signal px-4 py-2.5 text-[11px] font-semibold text-ink transition hover:brightness-105"
            >
              Invite person
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 border-b border-wire/50 px-4 py-2.5">
            <p className="text-[10px] text-paper/30">
              {participants.length} conversation{participants.length === 1 ? "" : "s"}
            </p>

            {canInvite && (
              <Link
                href={`/room/${roomId}?access=chat`}
                className="rounded-lg px-3 py-2 text-[10px] text-signal/70 ring-1 ring-signal/20 transition hover:bg-signal/[0.08]"
              >
                + Invite
              </Link>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void openIdentity();
            }}
            className="border-b border-wire/45 px-4 py-3"
          >
            <div className="flex gap-2">
              <input
                value={identityQuery}
                onChange={(event) => {
                  setIdentityQuery(
                    event.target.value,
                  );
                  setIdentityError(
                    null,
                  );
                }}
                placeholder="Open bob.stark or 0x…"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-wire/60 bg-black/10 px-3 py-2 text-[11px] text-paper/70 outline-none transition placeholder:text-paper/20 focus:border-signal/35"
              />

              <button
                type="submit"
                disabled={
                  identityBusy ||
                  !identityQuery.trim()
                }
                className="rounded-lg px-3 py-2 font-display text-[8px] uppercase tracking-[0.12em] text-signal/70 ring-1 ring-signal/20 transition hover:bg-signal/[0.07] disabled:opacity-30"
              >
                {identityBusy
                  ? "Resolving…"
                  : "Open"}
              </button>
            </div>

            {identityError && (
              <p className="mt-2 text-[9px] text-danger">
                {identityError}
              </p>
            )}
          </form>

          <div className="divide-y divide-wire/45">
            {participants.map(
              (participant) => (
                <DirectParticipantRow
                  key={
                    participant.address
                  }
                  participant={
                    participant
                  }
                  onOpen={() =>
                    onOpenChat(
                      participant.address,
                    )
                  }
                />
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
