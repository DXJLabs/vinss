import fs from "node:fs";
import path from "node:path";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const termsPath = path.join(
  process.cwd(),
  "content",
  "legal",
  "terms-of-service.md",
);

const terms = fs.readFileSync(termsPath, "utf8");

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between border-y border-wire/75 py-3">
        <Link
          className="font-display text-sm tracking-[0.2em] text-paper"
          href="/"
        >
          VINSS
        </Link>

        <Link
          className="font-display text-[8px] uppercase tracking-[0.17em] text-signal"
          href="/"
        >
          Back home →
        </Link>
      </header>

      <article
        className="
          py-10 text-sm leading-7 text-paper/55
          [&_h1]:mb-3 [&_h1]:mt-3
          [&_h1]:text-3xl [&_h1]:font-medium
          [&_h1]:tracking-tight [&_h1]:text-paper
          sm:[&_h1]:text-4xl

          [&_h2]:mb-4 [&_h2]:mt-12
          [&_h2]:border-t [&_h2]:border-wire/60
          [&_h2]:pt-7 [&_h2]:font-display
          [&_h2]:text-sm [&_h2]:uppercase
          [&_h2]:tracking-[0.13em] [&_h2]:text-paper/85

          [&_h3]:mb-2 [&_h3]:mt-7
          [&_h3]:font-display [&_h3]:text-xs
          [&_h3]:text-paper/75

          [&_p]:my-4
          [&_strong]:font-medium [&_strong]:text-paper/80

          [&_ul]:my-4 [&_ul]:list-disc
          [&_ul]:space-y-1 [&_ul]:pl-6

          [&_ol]:my-4 [&_ol]:list-decimal
          [&_ol]:space-y-1 [&_ol]:pl-6

          [&_blockquote]:my-6
          [&_blockquote]:border-l-2
          [&_blockquote]:border-signal/50
          [&_blockquote]:bg-signal/[0.025]
          [&_blockquote]:px-4
          [&_blockquote]:py-2
          [&_blockquote]:text-paper/50

          [&_pre]:my-5
          [&_pre]:overflow-x-auto
          [&_pre]:border
          [&_pre]:border-wire/60
          [&_pre]:bg-ink/70
          [&_pre]:p-4
          [&_pre]:font-mono
          [&_pre]:text-xs
          [&_pre]:leading-6
          [&_pre]:text-paper/55

          [&_a]:text-signal
          [&_a]:underline
          [&_a]:underline-offset-4

          [&_hr]:my-8
          [&_hr]:border-wire/60
        "
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {terms}
        </ReactMarkdown>
      </article>
    </main>
  );
}
