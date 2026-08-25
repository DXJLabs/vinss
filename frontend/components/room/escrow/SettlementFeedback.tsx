"use client";

import {
  useState,
} from "react";
import type {
  DealType,
} from "@/types/deal-room";
import {
  BACKEND_URL,
  NETWORK,
} from "@/lib/starknet/constants";

interface SettlementFeedbackProps {
  outcome:
    | "released"
    | "refunded";
  role:
    | "payer"
    | "payee"
    | null;
  dealType?: DealType;
}

type FeedbackStatus =
  | "idle"
  | "sending"
  | "sent"
  | "error"
  | "dismissed";

export function SettlementFeedback({
  outcome,
  role,
  dealType,
}: SettlementFeedbackProps) {
  const [rating, setRating] =
    useState(0);

  const [comment, setComment] =
    useState("");

  const [status, setStatus] =
    useState<FeedbackStatus>(
      "idle",
    );

  async function sendFeedback() {
    if (
      rating < 1 ||
      rating > 5 ||
      status === "sending"
    ) {
      return;
    }

    setStatus("sending");

    try {
      const response =
        await fetch(
          `${BACKEND_URL}/feedback`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              outcome,
              role:
                role ?? "unknown",
              dealType,
              network: NETWORK,
              rating,
              comment:
                comment.trim(),
            }),
          },
        );

      if (!response.ok) {
        throw new Error(
          `Feedback failed: ${response.status}`,
        );
      }

      setStatus("sent");
      setComment("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "dismissed") {
    return null;
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl bg-signal/[0.045] p-4 ring-1 ring-signal/15">
        <p className="text-xs font-medium text-signal">
          Thanks for the feedback ✓
        </p>
        <p className="mt-1 text-[10px] text-paper/35">
          Your feedback helps improve VINSS.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-paper/[0.025] p-4 ring-1 ring-wire/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-paper/70">
            How was your VINSS experience?
          </p>

          <p className="mt-1 text-[10px] text-paper/30">
            Optional · no wallet address or private chat is included.
          </p>
        </div>

        <span className="text-[8px] uppercase tracking-[0.12em] text-paper/25">
          Feedback
        </span>
      </div>

      <div
        className="mt-4 flex gap-1"
        aria-label="Feedback rating"
      >
        {[1, 2, 3, 4, 5].map(
          (value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star`}
              onClick={() =>
                setRating(value)
              }
              className={
                value <= rating
                  ? "flex h-9 w-9 items-center justify-center rounded-lg bg-signal/[0.1] text-lg text-signal ring-1 ring-signal/25"
                  : "flex h-9 w-9 items-center justify-center rounded-lg bg-paper/[0.025] text-lg text-paper/25 ring-1 ring-wire/50"
              }
            >
              ★
            </button>
          ),
        )}
      </div>

      <textarea
        value={comment}
        onChange={(event) =>
          setComment(
            event.target.value,
          )
        }
        maxLength={2000}
        rows={3}
        placeholder="Tell us what worked or what could be better…"
        className="mt-3 w-full resize-none rounded-xl bg-black/10 px-3 py-3 text-xs text-paper/70 outline-none ring-1 ring-wire/55 placeholder:text-paper/20 focus:ring-signal/25"
      />

      {status === "error" && (
        <p className="mt-2 text-[10px] text-danger">
          Feedback could not be sent. You can try again.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={
            rating === 0 ||
            status === "sending"
          }
          onClick={() =>
            void sendFeedback()
          }
          className="flex-1 rounded-xl bg-signal px-3 py-2.5 text-xs font-medium text-ink disabled:opacity-30"
        >
          {status === "sending"
            ? "Sending…"
            : "Send feedback"}
        </button>

        <button
          type="button"
          disabled={
            status === "sending"
          }
          onClick={() =>
            setStatus(
              "dismissed",
            )
          }
          className="rounded-xl border border-wire/60 px-3 py-2.5 text-xs text-paper/40 disabled:opacity-30"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
