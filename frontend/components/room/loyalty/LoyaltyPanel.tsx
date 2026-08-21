"use client";

export function LoyaltyPanel() {
  return (
    <section className="rounded-2xl bg-vault/25 p-4 ring-1 ring-wire/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-paper/72">
            VINSS Loyalty
          </p>
          <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-paper/30">
            Rewards will be tied to verified deal activity. Point accounting is not enabled in this MVP yet.
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-signal/[0.06] px-2.5 py-1 text-[8px] uppercase tracking-[0.12em] text-signal/60 ring-1 ring-signal/15">
          Planned
        </span>
      </div>
    </section>
  );
}
