"use client";

interface RekberTimelineNoticeProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

/*
 * Rekber notices are derived from authoritative contract state.
 * They look like timeline notifications but never create another paid
 * MessageHelper transaction just to mirror information already on Starknet.
 */
export function RekberTimelineNotice({
  title,
  body,
  actionLabel,
  onAction,
}: RekberTimelineNoticeProps) {
  return (
    <li className="flex justify-center">
      <div className="w-[94%] max-w-md rounded-xl border border-signal/20 bg-signal/[0.035] px-4 py-3">
        <p className="font-display text-[8px] uppercase tracking-[0.15em] text-signal/75">
          Rekber update
        </p>

        <p className="mt-1.5 text-sm font-medium text-paper/75">
          {title}
        </p>

        <p className="mt-1 text-[10px] leading-relaxed text-paper/40">
          {body}
        </p>

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-3 w-full rounded-lg border border-signal/25 px-3 py-2 font-display text-[8px] uppercase tracking-[0.12em] text-signal"
          >
            {actionLabel} →
          </button>
        )}
      </div>
    </li>
  );
}
