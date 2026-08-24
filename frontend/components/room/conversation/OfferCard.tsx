"use client";

import { useEffect, useRef } from "react";
import type { ConversationEntry } from "@/components/room/conversation/types";
import { sameStarknetAddress } from "@/lib/privacy/participantKeys";
import {
  formatUsd,
  useUsdPrice,
} from "@/components/room/escrow/EscrowPricing";
import { VINSS_FEES } from "@/lib/fees";

interface OfferCardProps {
  entry: ConversationEntry;
  walletAddress?: string;
  busy: boolean;
  actionable: boolean;
  rekberStarted?: boolean;
  onAccept: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onReject: (
    entry: ConversationEntry,
  ) => Promise<boolean>;
  onCounter: (
    entry: ConversationEntry,
  ) => void;
  onOpenEscrow?: (
    entry: ConversationEntry,
  ) => void;
  onViewProof?: (
    entry: ConversationEntry,
  ) => void;
  onSeen?: (
    entry: ConversationEntry,
  ) => void | Promise<void>;
}

function cardTitle(
  kind: NonNullable<
    ConversationEntry[
      "offerAction"
    ]
  >["kind"],
): string {
  if (kind === "counter") {
    return "Counter";
  }

  if (kind === "accept") {
    return "Agreement";
  }

  if (kind === "reject") {
    return "Response";
  }

  return "Offer";
}

function stateLabel(
  kind: NonNullable<
    ConversationEntry[
      "offerAction"
    ]
  >["kind"],
  ownAction: boolean,
  actionable: boolean,
): string {
  if (kind === "accept") {
    return ownAction
      ? "Accepted by you"
      : "Accepted";
  }

  if (kind === "reject") {
    return ownAction
      ? "Rejected by you"
      : "Rejected";
  }

  if (actionable) {
    return "Response needed";
  }

  return ownAction
    ? "Waiting"
    : "Received";
}


type OfferAction =
  NonNullable<
    ConversationEntry["offerAction"]
  >;

interface OfferDetailRow {
  label: string;
  value: string;
}

function splitOfferSegments(
  value?: string,
): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function prefixedValue(
  part: string,
  label: string,
): string | null {
  const prefix = `${label}:`;

  if (
    !part
      .toLowerCase()
      .startsWith(
        prefix.toLowerCase(),
      )
  ) {
    return null;
  }

  return part
    .slice(prefix.length)
    .trim();
}

function findPrefixed(
  parts: string[],
  label: string,
): string | null {
  for (const part of parts) {
    const value =
      prefixedValue(
        part,
        label,
      );

    if (value) {
      return value;
    }
  }

  return null;
}

function findPlain(
  parts: string[],
  knownLabels: string[],
): string | null {
  return (
    parts.find(
      (part) =>
        !knownLabels.some(
          (label) =>
            prefixedValue(
              part,
              label,
            ) !== null,
        ),
    ) ?? null
  );
}

function cleanLooseLabel(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  return (
    value
      .replace(
        /^[A-Za-z][A-Za-z ]{1,30}:\s*/,
        "",
      )
      .trim() || null
  );
}

function normalizeGoodsLine(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  // Old Counter prefill could produce:
  // 1 × 1 × Item
  return value.replace(
    /^(\d+(?:[.,]\d+)?)\s*×\s*\1\s*×\s*/i,
    "$1 × ",
  );
}

function offerDetailRows(
  action: OfferAction,
): OfferDetailRow[] {
  const terms =
    splitOfferSegments(
      action.paymentTerms,
    );

  const conditions =
    splitOfferSegments(
      action.conditions,
    );

  const rows: OfferDetailRow[] =
    [];

  const add = (
    label: string,
    value:
      | string
      | null
      | undefined,
  ) => {
    const clean =
      value?.trim();

    if (!clean) {
      return;
    }

    if (
      rows.some(
        (row) =>
          row.label === label &&
          row.value === clean,
      )
    ) {
      return;
    }

    rows.push({
      label,
      value: clean,
    });
  };

  switch (action.dealType) {
    case "freelance": {
      add(
        "Project",
        findPrefixed(
          terms,
          "Project",
        ) ??
          findPlain(
            terms,
            ["Deadline"],
          ),
      );

      add(
        "Deadline",
        findPrefixed(
          terms,
          "Deadline",
        ),
      );

      add(
        "Deliverables",
        findPrefixed(
          conditions,
          "Deliverables",
        ),
      );

      add(
        "Acceptance",
        findPrefixed(
          conditions,
          "Acceptance",
        ),
      );

      add(
        "Revisions",
        findPrefixed(
          conditions,
          "Revisions",
        ),
      );

      add(
        "Work stages",
        findPrefixed(
          conditions,
          "Work stages",
        ),
      );

      if (
        rows.length <= 2 &&
        conditions.length > 0
      ) {
        add(
          "Additional terms",
          cleanLooseLabel(
            findPlain(
              conditions,
              [
                "Deliverables",
                "Acceptance",
                "Revisions",
                "Work stages",
              ],
            ),
          ),
        );
      }

      break;
    }

    case "otc": {
      add(
        "Trade",
        terms[0],
      );

      add(
        "Payment",
        findPrefixed(
          terms,
          "Payment",
        ),
      );

      add(
        "Deadline",
        findPrefixed(
          terms,
          "Deadline",
        ),
      );

      if (
        action.conditions
          ?.trim()
      ) {
        add(
          "Settlement",
          action.conditions,
        );
      }

      break;
    }

    case "goods": {
      const item =
        normalizeGoodsLine(
          findPlain(
            terms,
            [
              "Delivery",
              "Due",
            ],
          ),
        );

      add(
        "Item",
        item,
      );

      const deliveries =
        terms
          .map((part) =>
            prefixedValue(
              part,
              "Delivery",
            ),
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          );

      add(
        "Delivery",
        deliveries[0],
      );

      add(
        "Due",
        findPrefixed(
          terms,
          "Due",
        ),
      );

      add(
        "Inspection",
        findPrefixed(
          conditions,
          "Inspection window",
        ),
      );

      // Graceful rendering for older malformed
      // cards where a condition inherited
      // the wrong label.
      if (
        conditions.length > 0 &&
        !findPrefixed(
          conditions,
          "Inspection window",
        )
      ) {
        add(
          "Additional terms",
          cleanLooseLabel(
            conditions.join(
              " · ",
            ),
          ),
        );
      }

      for (
        let index = 1;
        index <
        deliveries.length;
        index += 1
      ) {
        add(
          "Additional terms",
          deliveries[index],
        );
      }

      break;
    }

    case "digital_goods": {
      add(
        "Item",
        findPlain(
          terms,
          ["Delivery"],
        ),
      );

      add(
        "Delivery",
        findPrefixed(
          terms,
          "Delivery",
        ),
      );

      add(
        "Rights",
        findPrefixed(
          conditions,
          "Rights",
        ),
      );

      add(
        "Acceptance",
        findPrefixed(
          conditions,
          "Acceptance",
        ),
      );

      break;
    }

    case "bounty": {
      add(
        "Task",
        findPrefixed(
          terms,
          "Task",
        ) ??
          findPlain(
            terms,
            ["Deadline"],
          ),
      );

      add(
        "Deadline",
        findPrefixed(
          terms,
          "Deadline",
        ),
      );

      add(
        "Success",
        findPrefixed(
          conditions,
          "Success",
        ),
      );

      add(
        "Submission",
        findPrefixed(
          conditions,
          "Submit",
        ),
      );

      break;
    }

    case "nft": {
      add(
        "NFT",
        findPlain(
          terms,
          ["Transfer"],
        ),
      );

      add(
        "Transfer",
        findPrefixed(
          terms,
          "Transfer",
        ),
      );

      if (
        action.conditions
          ?.trim()
      ) {
        add(
          "Condition",
          cleanLooseLabel(
            action.conditions,
          ),
        );
      }

      break;
    }

    case "other":
    default: {
      add(
        "Deal",
        findPrefixed(
          terms,
          "Deal",
        ) ??
          terms[0],
      );

      const plainTerms =
        terms.filter(
          (part) =>
            prefixedValue(
              part,
              "Deal",
            ) === null &&
            prefixedValue(
              part,
              "Deadline",
            ) === null,
        );

      if (
        plainTerms.length
      ) {
        add(
          "Terms",
          plainTerms.join(
            " · ",
          ),
        );
      }

      add(
        "Deadline",
        findPrefixed(
          terms,
          "Deadline",
        ),
      );

      if (
        action.conditions
          ?.trim()
      ) {
        add(
          "Completion",
          cleanLooseLabel(
            action.conditions,
          ),
        );
      }

      break;
    }
  }

  if (rows.length === 0) {
    add(
      "Terms",
      action.paymentTerms ||
        "Not specified",
    );

    add(
      "Additional terms",
      action.conditions,
    );
  }

  return rows;
}

export function OfferCard({
  entry,
  walletAddress,
  busy,
  actionable,
  rekberStarted = false,
  onAccept,
  onReject,
  onCounter,
  onOpenEscrow,
  onSeen,
  onViewProof,
}: OfferCardProps) {
  const action =
    entry.offerAction;

  if (!action) {
    return null;
  }

  const ownAction =
    sameStarknetAddress(
      action.senderAddress,
      walletAddress,
    );

  const offerCardRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      ownAction ||
      !entry.transactionHash ||
      !onSeen
    ) {
      return;
    }

    const node = offerCardRef.current;
    if (!node) return;

    const observer =
      new IntersectionObserver(
        (records) => {
          const visible = records.some(
            (record) =>
              record.isIntersecting &&
              record.intersectionRatio >= 0.6,
          );

          if (!visible) return;

          void onSeen(entry);
          observer.disconnect();
        },
        {
          threshold: [0.6],
        },
      );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [
    ownAction,
    entry.actionLocator,
    entry.transactionHash,
    onSeen,
  ]);

  const accepted =
    action.kind === "accept";

  const rejected =
    action.kind === "reject";

  const detailRows =
    offerDetailRows(action);

  const numericAmount =
    Number(action.amount);

  const {
    price: usdPrice,
  } = useUsdPrice(
    action.asset,
  );

  const usdValue =
    Number.isFinite(
      numericAmount,
    ) &&
    numericAmount > 0 &&
    usdPrice !== null
      ? numericAmount *
        usdPrice
      : null;

  return (
    <div
      ref={offerCardRef}
      className={
        ownAction
          ? "ml-auto w-[88%] max-w-sm"
          : "mr-auto w-[88%] max-w-sm"
      }
    >
      <div
        className={
          accepted
            ? "border border-signal/25 border-l-2 border-l-signal bg-vault/35 px-3.5 py-3"
            : rejected
              ? "border border-danger/20 border-l-2 border-l-danger/60 bg-vault/35 px-3.5 py-3"
              : "border border-wire border-l-2 border-l-amber-400/60 bg-vault/35 px-3.5 py-3"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-[8px] uppercase tracking-[0.16em] text-amber-300/70">
            {cardTitle(
              action.kind,
            )}
            {" · "}
            {ownAction
              ? "Sent"
              : "Received"}
          </span>

          <div className="flex items-center gap-2">
            <span
              className={
                accepted
                  ? "text-[9px] text-signal/70"
                  : rejected
                    ? "text-[9px] text-danger/70"
                    : "text-[9px] text-paper/30"
              }
            >
              {stateLabel(
                action.kind,
                ownAction,
                actionable,
              )}
            </span>

            {ownAction &&
              entry.transactionHash && (
                <span
                  className={
                    entry.readAt
                      ? "text-[10px] text-signal"
                      : "text-[10px] text-paper/35"
                  }
                  title={
                    entry.readAt
                      ? "Read"
                      : "Sent"
                  }
                >
                  {entry.readAt ? "✓✓" : "✓"}
                </span>
              )}
          </div>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {detailRows[0] && (
              <p className="break-words text-[13px] font-medium leading-relaxed text-paper/72">
                {detailRows[0].value}
              </p>
            )}

            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[16px] font-medium text-paper/82">
                {action.amount}{" "}
                {action.asset}
              </span>

              {usdValue !== null && (
                <span className="text-[9px] text-paper/30">
                  ≈ {formatUsd(usdValue)}
                </span>
              )}
            </div>
          </div>

          {action.dealType && (
            <span className="max-w-[42%] shrink-0 truncate rounded-md border border-wire/65 px-2 py-1 font-display text-[7px] uppercase tracking-[0.12em] text-paper/32">
              {action.dealType === "otc"
                ? "Token Trade"
                : action.dealType === "freelance"
                  ? "Freelance"
                  : action.dealType === "goods"
                    ? "Physical Goods"
                    : action.dealType === "digital_goods"
                      ? "Digital Goods"
                      : action.dealType === "bounty"
                        ? "Bounty"
                        : action.dealType === "nft"
                          ? "NFT Deal"
                          : "Custom Deal"}
            </span>
          )}
        </div>

        {detailRows.length > 0 && (
          <div className="mt-3 border-t border-wire/55 pt-3">
            {detailRows.length > 1 && (
              <div className="mt-2.5 space-y-1.5">
                {detailRows
                  .slice(1)
                  .map((row) => (
                    <p
                      key={`${row.label}:${row.value}`}
                      className="break-words text-[10px] leading-relaxed text-paper/42"
                    >
                      <span className="text-paper/27">
                        {row.label}
                      </span>

                      <span className="px-1.5 text-paper/18">
                        ·
                      </span>

                      <span className="text-paper/55">
                        {row.value}
                      </span>
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {entry.transactionHash && onViewProof && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-wire/60 pt-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-signal/25 text-[8px] text-signal">
                ✓
              </span>
              <span className="text-[9px] text-paper/35">
                Recorded on Starknet
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onViewProof(entry)
              }
              className="font-display text-[8px] uppercase tracking-[0.14em] text-signal/65 transition hover:text-signal"
            >
              Proof ↗
            </button>
          </div>
        )}

        {actionable && (
          <div className="mt-3 border-t border-wire/60 pt-3">
            <p className="mb-2 text-[8px] leading-relaxed text-paper/25">
              Each Accept, Reject, or Counter action costs{" "}
              {VINSS_FEES.offer.strk} STRK. Pool/network fee appears
              separately in Ready X.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  void onReject(
                    entry,
                  )
                }
                disabled={busy}
                className="h-9 border border-danger/25 px-2 font-display text-[8px] uppercase tracking-widest text-danger/75 transition hover:bg-danger/10 disabled:opacity-30"
              >
                Reject
              </button>

              <button
                type="button"
                onClick={() =>
                  onCounter(entry)
                }
                disabled={busy}
                className="h-9 border border-wire px-2 font-display text-[8px] uppercase tracking-widest text-paper/50 transition hover:border-amber-400/40 hover:text-amber-300 disabled:opacity-30"
              >
                Counter
              </button>

              <button
                type="button"
                onClick={() =>
                  void onAccept(
                    entry,
                  )
                }
                disabled={busy}
                className="h-9 border border-signal/35 px-2 font-display text-[8px] uppercase tracking-widest text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
              >
                Accept
              </button>
            </div>
          </div>
        )}

        {accepted && (
          <div className="mt-3 border-t border-signal/15 pt-2.5">
            <p className="text-[10px] text-signal/65">
              {rekberStarted
                ? "✓ Escrow is active for this agreement"
                : "Agreement ready · continue to Escrow"}
            </p>

            {onOpenEscrow && (
              <button
                type="button"
                onClick={() =>
                  onOpenEscrow(entry)
                }
                disabled={busy}
                className="mt-2.5 w-full border border-signal/30 px-3 py-2.5 font-display text-[8px] uppercase tracking-[0.13em] text-signal transition hover:bg-signal hover:text-ink disabled:opacity-30"
              >
                {rekberStarted
                  ? "Open Escrow →"
                  : "Prepare Escrow →"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
