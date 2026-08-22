"use client";

const EVENTS = [
  "MESSAGE",
  "OFFER · CREATE",
  "OFFER · COUNTER",
  "OFFER · ACCEPT",
  "OFFER · REJECT",
  "ESCROW · PREPARE",
  "REKBER · FUND",
  "SETTLEMENT · RELEASE",
  "SETTLEMENT · REFUND",
];

export function LiveTxFeed() {
  return (
    <section className="border border-wire bg-vault/20 p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.2em] text-signal">
            VINSS LIVE TX
          </p>
          <p className="mt-1 text-xs text-paper/30">
            Private deal activity stream
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-signal">
          ● Live
        </span>
      </div>

      <div className="space-y-2">
        {EVENTS.map((event) => (
          <div
            key={event}
            className="flex justify-between border-t border-wire/60 py-3 text-xs"
          >
            <span className="font-display text-paper/70">{event}</span>
            <span className="text-paper/25">waiting</span>
          </div>
        ))}
      </div>
    </section>
  );
}
