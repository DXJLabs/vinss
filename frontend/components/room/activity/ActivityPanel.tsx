"use client";

import type {
  ConversationEntry,
} from "@/components/room/conversation/types";
import {
  LoyaltyPanel,
} from "@/components/room/loyalty/LoyaltyPanel";

interface ActivityPanelProps {
  entries: ConversationEntry[];
}

export function ActivityPanel({
  entries,
}: ActivityPanelProps) {
  const recent = [...entries]
    .sort(
      (left, right) =>
        new Date(
          right.sentAt,
        ).getTime() -
        new Date(
          left.sentAt,
        ).getTime(),
    )
    .slice(0, 8);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-vault/25 ring-1 ring-wire/60">
        <div className="border-b border-wire/55 px-4 py-3.5">
          <p className="text-sm font-medium text-paper/75">
            Activity
          </p>
          <p className="mt-1 text-[10px] text-paper/30">
            Recent room actions and proofs.
          </p>
        </div>

        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-paper/30">
            No activity yet.
          </div>
        ) : (
          <div className="divide-y divide-wire/45">
            {recent.map((entry) => (
              <div
                key={`${entry.kind}:${entry.id}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-[10px] text-signal/65 ring-1 ring-wire/55">
                  {entry.kind ===
                  "offer"
                    ? "◇"
                    : "✦"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-paper/62">
                    {entry.summary ||
                      (entry.kind ===
                      "offer"
                        ? "Offer activity"
                        : "Message")}
                  </p>
                  <p className="mt-0.5 text-[9px] text-paper/25">
                    {new Date(
                      entry.sentAt,
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 px-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-paper/35">
            Loyalty
          </p>
        </div>

        <LoyaltyPanel />
      </div>
    </section>
  );
}
