import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between border-y border-wire/75 py-3">
        <Link className="font-display text-sm tracking-[0.2em] text-paper" href="/">
          VINSS
        </Link>
        <Link
          className="font-display text-[8px] uppercase tracking-[0.17em] text-signal"
          href="/"
        >
          Back home →
        </Link>
      </header>

      <article className="py-12 sm:py-16">
        <p className="font-display text-[9px] uppercase tracking-[0.26em] text-signal">
          Product terms
        </p>
        <h1 className="mt-4 text-4xl font-medium tracking-tight text-paper">
          Terms of use
        </h1>
        <p className="mt-4 text-sm leading-7 text-paper/45">
          VINSS is under active development. These plain-language terms describe
          the current product boundary and are not a promise of features that
          have not been verified.
        </p>

        <div className="mt-10 divide-y divide-wire/70 border-y border-wire/70">
          <section className="py-6">
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-paper/80">
              User control
            </h2>
            <p className="mt-3 text-sm leading-7 text-paper/42">
              You control your wallet, approvals, room invitations, and private
              deal context. VINSS Agent must not sign or move funds on your
              behalf.
            </p>
          </section>

          <section className="py-6">
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-paper/80">
              Privacy boundary
            </h2>
            <p className="mt-3 text-sm leading-7 text-paper/42">
              Client-side encryption does not erase public blockchain metadata.
              Pool interactions, timing, commitments, contract interactions, and
              settlement results may remain publicly observable.
            </p>
          </section>

          <section className="py-6">
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-paper/80">
              Early-stage software
            </h2>
            <p className="mt-3 text-sm leading-7 text-paper/42">
              Review deal terms and wallet prompts before approving an action.
              Features marked integration or pending must not be treated as
              production-verified settlement guarantees.
            </p>
          </section>

          <section className="py-6">
            <h2 className="font-display text-xs uppercase tracking-[0.16em] text-paper/80">
              No custody by interface
            </h2>
            <p className="mt-3 text-sm leading-7 text-paper/42">
              The VINSS interface coordinates wallet and contract actions. The
              interface itself does not receive your wallet private key.
            </p>
          </section>
        </div>

        <p className="mt-8 font-display text-[8px] uppercase leading-5 tracking-[0.13em] text-paper/25">
          Last updated · August 22, 2026
        </p>
      </article>
    </main>
  );
}
