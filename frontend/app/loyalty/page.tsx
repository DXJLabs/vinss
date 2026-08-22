import Link from "next/link";

const FUTURE_EVENTS = [
  "Verified settlement release",
  "Optional NFT certificate claim",
  "Post-settlement feedback",
] as const;

export default function LoyaltyPage() {
  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between border-b border-wire/70 pb-4">
          <Link
            href="/"
            className="font-display text-[9px] uppercase tracking-[0.18em] text-paper/45 hover:text-signal"
          >
            ← VINSS
          </Link>
          <span className="border border-wire/70 px-2 py-1 font-display text-[7px] uppercase tracking-[0.14em] text-paper/30">
            Not enabled
          </span>
        </header>

        <section className="py-12 sm:py-16">
          <p className="font-display text-[9px] uppercase tracking-[0.25em] text-signal">
            VINSS Loyalty
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-medium leading-tight tracking-tight sm:text-5xl">
            Rewards must follow verified activity.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-paper/45">
            VINSS does not currently issue redeemable Loyalty points. The old
            browser demo balance and VINS/DXJ redemption preview have been
            removed because they were not backed by authenticated settlement
            evidence.
          </p>
        </section>

        <section className="border border-wire/70 bg-vault/30">
          <header className="border-b border-wire/60 px-4 py-3">
            <p className="font-display text-[8px] uppercase tracking-[0.18em] text-paper/38">
              Required before launch
            </p>
          </header>
          <div className="grid gap-px bg-wire/55 sm:grid-cols-3">
            {[
              ["01", "Authenticated issuer", "Only verified protocol activity may create points."],
              ["02", "Idempotent ledger", "One on-chain event can be rewarded only once."],
              ["03", "Published rules", "Rates, eligibility and redemption must be explicit."],
            ].map(([number, title, body]) => (
              <article
                key={number}
                className="bg-[#090c0f] p-4"
              >
                <span className="font-display text-[8px] text-paper/22">
                  {number}
                </span>
                <h2 className="mt-5 text-sm font-medium text-paper/70">
                  {title}
                </h2>
                <p className="mt-2 text-[11px] leading-5 text-paper/32">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 border border-wire/70 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-[8px] uppercase tracking-[0.18em] text-paper/38">
                Future eligible signals
              </p>
              <ul className="mt-4 space-y-3">
                {FUTURE_EVENTS.map((event) => (
                  <li
                    key={event}
                    className="flex items-center gap-3 text-xs text-paper/48"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-paper/20" />
                    {event}
                  </li>
                ))}
              </ul>
            </div>
            <span className="font-display text-[8px] uppercase tracking-[0.14em] text-amber/70">
              Coming later
            </span>
          </div>
        </section>

        <footer className="mt-8 border-t border-wire/60 pt-5 text-[10px] leading-5 text-paper/25">
          Loyalty is not royalty. Loyalty means user reward points; royalty
          means revenue paid to a creator or rights holder. VINSS currently
          implements neither as valuable mainnet state.
        </footer>
      </div>
    </main>
  );
}
