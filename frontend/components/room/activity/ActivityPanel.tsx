"use client";

import type {
  ConversationEntry,
} from "@/components/room/conversation/types";
import {
  explorerUrl,
} from "@/components/room/conversation/chatFormat";

interface ActivityPanelProps {
  entries: ConversationEntry[];
}

function activityPresentation(
  entry: ConversationEntry,
) {
  const summary =
    entry.summary?.trim() ||
    (entry.kind === "offer"
      ? "Offer activity"
      : "Message");

  const [
    rawTitle = "",
    ...rest
  ] = summary.split(" — ");

  let title = rawTitle.trim();

  if (
    title.toLowerCase() ===
    "offer"
  ) {
    title = "Offer created";
  }

  const detail =
    rest.join(" — ").trim();

  const lower =
    summary.toLowerCase();

  if (
    lower.includes("rekber") ||
    lower.includes("escrow")
  ) {
    return {
      icon: "⬡",
      title,
      detail,
    };
  }

  if (
    lower.includes("accepted")
  ) {
    return {
      icon: "✓",
      title,
      detail,
    };
  }

  if (
    lower.includes("counter")
  ) {
    return {
      icon: "↔",
      title,
      detail,
    };
  }

  if (
    entry.kind === "offer"
  ) {
    return {
      icon: "◇",
      title,
      detail,
    };
  }

  return {
    icon: "✦",
    title,
    detail,
  };
}

function dayKey(date: Date) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, "0"),
    String(
      date.getDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function dayLabel(date: Date) {
  return date
    .toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
      },
    )
    .toUpperCase();
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );
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
    .slice(0, 12);

  const groups = new Map<
    string,
    {
      date: Date;
      entries: ConversationEntry[];
    }
  >();

  for (const entry of recent) {
    const date =
      new Date(entry.sentAt);

    const key = dayKey(date);

    const existing =
      groups.get(key);

    if (existing) {
      existing.entries.push(
        entry,
      );
    } else {
      groups.set(key, {
        date,
        entries: [entry],
      });
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-wire/70 bg-vault/15">
      <div className="border-b border-wire/55 px-4 py-3.5">
        <p className="text-sm font-medium text-paper/75">
          Recent activity
        </p>

        <p className="mt-1 text-[10px] text-paper/30">
          Offers, Escrow and verified room actions.
        </p>
      </div>

      {recent.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-signal/15 bg-signal/[0.04] text-signal/60">
            ◇
          </div>

          <p className="text-sm text-paper/60">
            No activity yet
          </p>

          <p className="mt-1.5 text-xs text-paper/30">
            Verified deal actions will appear here.
          </p>
        </div>
      ) : (
        <div>
          {Array.from(
            groups.values(),
          ).map((group) => (
            <div
              key={dayKey(
                group.date,
              )}
            >
              <div className="border-b border-wire/45 bg-black/10 px-4 py-2">
                <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-paper/30">
                  {dayLabel(
                    group.date,
                  )}
                </p>
              </div>

              <div className="divide-y divide-wire/45">
                {group.entries.map(
                  (entry) => {
                    const meta =
                      activityPresentation(
                        entry,
                      );

                    const date =
                      new Date(
                        entry.sentAt,
                      );

                    return (
                      <a
                        key={`${entry.kind}:${entry.id}`}
                        href={explorerUrl(
                          entry.transactionHash,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        title="View proof"
                        className="group flex items-center gap-3 px-4 py-3 transition hover:bg-signal/[0.025]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wire/60 bg-black/15 text-[11px] text-signal/65">
                          {
                            meta.icon
                          }
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-paper/65">
                            {
                              meta.title
                            }
                          </p>

                          {meta.detail && (
                            <p className="mt-0.5 truncate text-[10px] text-paper/30">
                              {
                                meta.detail
                              }
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[9px] text-paper/25">
                            {timeLabel(
                              date,
                            )}
                          </span>

                          <span
                            className="text-sm text-signal/35 transition group-hover:text-signal/70"
                            aria-hidden="true"
                          >
                            ›
                          </span>
                        </div>
                      </a>
                    );
                  },
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
