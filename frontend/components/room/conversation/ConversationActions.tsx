"use client";

import { useState } from "react";

interface ConversationActionsProps {
  connected: boolean;
  busy: boolean;
  onAddOffer?: () => void;
  onAddEscrow?: () => void;
  onSubmitWork?: () => void;
}

export function ConversationActions({
  connected,
  busy,
  onAddOffer,
  onAddEscrow,
  onSubmitWork,
}: ConversationActionsProps) {
  const [open, setOpen] =
    useState(false);

  function openAgent() {
    window.dispatchEvent(
      new Event("vinss:open-agent"),
    );
  }

  const actionClass =
    "flex h-9 shrink-0 snap-start items-center gap-2 rounded-lg bg-vault/45 px-3 text-[10px] font-medium text-paper/58 transition hover:bg-vault/70 hover:text-signal disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <section className="bg-vault/[0.04] px-3 py-2">
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
      >
        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-paper/30">
          Actions
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
            <button
              type="button"
              onClick={onSubmitWork}
              disabled={
                !connected ||
                busy ||
                !onSubmitWork
              }
              title={
                onSubmitWork
                  ? "Attach work file"
                  : "File attachment is not available for this conversation yet"
              }
              className={actionClass}
            >
              <span className="text-signal/55">
                📎
              </span>
              <span>File</span>
            </button>

            <button
              type="button"
              onClick={onAddOffer}
              disabled={
                !connected ||
                busy ||
                !onAddOffer
              }
              className={actionClass}
            >
              <span className="text-signal/55">
                ◇
              </span>
              <span>Offer</span>
            </button>

            <button
              type="button"
              onClick={onAddEscrow}
              disabled={
                !connected ||
                busy ||
                !onAddEscrow
              }
              className={actionClass}
            >
              <span className="text-signal/55">
                ⬡
              </span>
              <span>Escrow</span>
            </button>

            <button
              type="button"
              onClick={openAgent}
              disabled={busy}
              className={`${actionClass} text-signal/75`}
            >
              <span>✦</span>
              <span>VINSS Agent</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
