"use client";

import { useState } from "react";

type ActionIconKind =
  | "file"
  | "evidence"
  | "offer"
  | "escrow"
  | "agent";

function ActionIcon({
  kind,
}: {
  kind: ActionIconKind;
}) {
  return (
    <svg
      aria-hidden="true"
      className="h-[17px] w-[17px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.55"
    >
      {kind === "file" && (
        <>
          <path d="M7 3.8h7l4 4V20H7Z" />
          <path d="M14 3.8V8h4M10 12h5M10 15.5h5" />
        </>
      )}

      {kind === "evidence" && (
        <>
          <path d="M8.5 12.8 13.8 7.5a3 3 0 1 1 4.2 4.2l-7.1 7.1a4.2 4.2 0 0 1-6-6l7.3-7.3" />
          <path d="m8.1 16.1 7.2-7.2" />
        </>
      )}

      {kind === "offer" && (
        <>
          <path d="m12 3.8 6.8 8.2-6.8 8.2L5.2 12 12 3.8Z" />
          <path d="M9 12h6" />
        </>
      )}

      {kind === "escrow" && (
        <>
          <path d="M12 3.6 18.5 6v5c0 4-2.4 7-6.5 9-4.1-2-6.5-5-6.5-9V6L12 3.6Z" />
          <rect x="9.2" y="10.3" width="5.6" height="4.5" rx="1" />
          <path d="M10.4 10.3V9a1.6 1.6 0 0 1 3.2 0v1.3" />
        </>
      )}

      {kind === "agent" && (
        <>
          <path d="m12 3.5 1.65 4.85L18.5 10l-4.85 1.65L12 16.5l-1.65-4.85L5.5 10l4.85-1.65L12 3.5Z" />
          <path d="m18.2 15.2.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
        </>
      )}
    </svg>
  );
}

interface ConversationActionsProps {
  connected: boolean;
  busy: boolean;
  onAddFile?: () => void;
  onAddOffer?: () => void;
  onAddEscrow?: () => void;
  onSubmitWork?: () => void;
  submitEvidenceLabel?: string;
}

export function ConversationActions({
  connected,
  busy,
  onAddFile,
  onAddOffer,
  onAddEscrow,
  onSubmitWork,
  submitEvidenceLabel = "Submit evidence",
}: ConversationActionsProps) {
  const [open, setOpen] =
    useState(false);

  function openAgent() {
    window.dispatchEvent(
      new Event("vinss:open-agent"),
    );
  }

  const actionClass =
    "group flex h-11 shrink-0 snap-start items-center gap-2.5 rounded-xl border border-wire/60 bg-vault/35 px-2.5 pr-3.5 text-[10px] font-medium text-paper/62 transition hover:border-signal/25 hover:bg-signal/[0.045] hover:text-paper disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <section className="border-x border-wire/70 bg-[#070c10]/95 px-3 py-2.5">
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal/70 shadow-[0_0_10px_rgba(94,234,212,0.45)]" />
          <span className="font-display text-[8px] font-medium uppercase tracking-[0.16em] text-paper/36">
            Actions
          </span>
        </span>

        <span
          className="text-[11px] text-paper/25"
          aria-hidden="true"
        >
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max snap-x snap-mandatory gap-2">
            {onAddFile && (
              <button
                type="button"
                onClick={onAddFile}
                disabled={!connected || busy}
                className={actionClass}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal/[0.055] text-signal/70 ring-1 ring-signal/10 transition group-hover:bg-signal/[0.09] group-hover:text-signal">
                  <ActionIcon kind="file" />
                </span>
                <span>File</span>
              </button>
            )}

            {onSubmitWork && (
              <button
                type="button"
                onClick={onSubmitWork}
                disabled={!connected || busy}
                className={actionClass}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal/[0.055] text-signal/70 ring-1 ring-signal/10 transition group-hover:bg-signal/[0.09] group-hover:text-signal">
                  <ActionIcon kind="evidence" />
                </span>
                <span>
                  {submitEvidenceLabel}
                </span>
              </button>
            )}

            {onAddOffer && (
              <button
                type="button"
                onClick={onAddOffer}
                disabled={!connected || busy}
                className={actionClass}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal/[0.055] text-signal/70 ring-1 ring-signal/10 transition group-hover:bg-signal/[0.09] group-hover:text-signal">
                  <ActionIcon kind="offer" />
                </span>
                <span>Offer</span>
              </button>
            )}

            {onAddEscrow && (
              <button
                type="button"
                onClick={onAddEscrow}
                disabled={!connected || busy}
                className={actionClass}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal/[0.055] text-signal/70 ring-1 ring-signal/10 transition group-hover:bg-signal/[0.09] group-hover:text-signal">
                  <ActionIcon kind="escrow" />
                </span>
                <span>Escrow</span>
              </button>
            )}

            <button
              type="button"
              onClick={openAgent}
              disabled={busy}
              className={`${actionClass} border-signal/15 bg-signal/[0.045] text-signal/85`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal/[0.1] text-signal ring-1 ring-signal/15">
                <ActionIcon kind="agent" />
              </span>
              <span>VINSS Agent</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
