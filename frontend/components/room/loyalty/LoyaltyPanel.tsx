"use client";

const REWARDS = [
  ["Send message", "+1"],
  ["Create offer", "+25"],
  ["Offer accepted", "+50"],
  ["Start escrow", "+50"],
  ["Fund escrow", "+100"],
  ["Complete deal", "+250"],
] as const;

export function LoyaltyPanel() {
  return (
    <section className="space-y-6">
      <div className="border border-wire bg-vault/30 p-6">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-signal">
          VINSS Loyalty
        </p>

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-widest text-paper/35">
            Your rewards
          </p>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-4xl text-paper">0</span>
            <span className="font-display text-xs uppercase tracking-widest text-paper/35">
              points
            </span>
          </div>
        </div>
      </div>

      <div className="border border-wire">
        <div className="border-b border-wire px-4 py-3">
          <p className="font-display text-[10px] uppercase tracking-widest text-paper/40">
            Earn points
          </p>
        </div>

        <div className="divide-y divide-wire">
          {REWARDS.map(([label, points]) => (
            <div
              key={label}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm text-paper/70">{label}</span>
              <span className="font-display text-xs text-signal">{points}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-wire bg-vault/20 p-4">
        <p className="font-display text-[10px] uppercase tracking-widest text-paper/40">
          Reward path
        </p>

        <div className="mt-4 flex items-center justify-center gap-3 text-xs">
          <span className="border border-wire px-3 py-2 text-paper/60">
            POINTS
          </span>
          <span className="text-signal">→</span>
          <span className="border border-wire px-3 py-2 text-paper/60">
            VINSS
          </span>
          <span className="text-signal">→</span>
          <span className="border border-signal/40 px-3 py-2 text-signal">
            DXJ
          </span>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-paper/30">
          Earn points through activity in this Deal Room. Rewards can later be
          redeemed through the VINSS and DXJ ecosystem.
        </p>
      </div>
    </section>
  );
}
